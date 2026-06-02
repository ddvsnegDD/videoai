import crypto from 'crypto';
import { randomUUID } from 'crypto';
import pool from './db.js';

// ── RFC 3986 encode (encodeURIComponent doesn't encode !*'()) ──
function rfc3986Encode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// ── Verify HMAC-SHA256 sign from YooMoney notification ──
export function verifyYooMoneySign(params, secret) {
  const received = params.sign;
  if (!received) return false;

  // All params except 'sign', sorted alphabetically
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort();

  const message = sorted
    .map(k => `${k}=${rfc3986Encode(params[k] ?? '')}`)
    .join('&');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  // Timing-safe compare (same length required)
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(received.toLowerCase(), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Build Quickpay URL ──
export function buildQuickpayUrl({ wallet, pkg, label, successUrl }) {
  const base = 'https://yoomoney.ru/quickpay/confirm';
  const params = new URLSearchParams({
    receiver: wallet,
    'quickpay-form': 'shop',
    targets: pkg.title,
    paymentType: 'AC', // AC=card, PC=wallet — front can pass preferred type
    sum: String(pkg.price),
    label,
    successURL: successUrl,
  });
  return `${base}?${params.toString()}`;
}

// ── Create pending payment record ──
export async function createPendingPayment({ userId, pkg, label }) {
  const result = await pool.query(
    `INSERT INTO payments (user_id, package_id, label, expected_amount, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
    [userId, pkg.id, label, pkg.price],
  );
  return result.rows[0].id;
}

// ── Process confirmed webhook (idempotent) ──
// Returns { ok, reason } — caller always responds 200.
export async function processYooMoneyWebhook({ params, secret }) {
  // Step 1: verify sign
  const signOk = verifyYooMoneySign(params, secret);
  if (!signOk) {
    console.warn('[YooMoney] Invalid sign. Params:', JSON.stringify(params));
    return { ok: false, reason: 'invalid_sign' };
  }

  // Step 2: test notification — valid sign, no credits
  if (params.test_notification === 'true') {
    console.log('[YooMoney] Test notification received and verified');
    return { ok: true, reason: 'test_notification' };
  }

  const { operation_id, label, amount } = params;

  if (!operation_id) {
    console.warn('[YooMoney] Missing operation_id');
    return { ok: false, reason: 'missing_operation_id' };
  }

  // Step 3: idempotency — already processed?
  const existing = await pool.query(
    `SELECT id, status FROM payments WHERE operation_id = $1 LIMIT 1`,
    [operation_id],
  );
  if (existing.rows.length > 0 && existing.rows[0].status === 'completed') {
    console.log(`[YooMoney] Duplicate notification for operation_id=${operation_id}, skipping`);
    return { ok: true, reason: 'already_processed' };
  }

  // Step 4: parse label → userId:packageId:nonce
  if (!label) {
    console.warn('[YooMoney] Missing label');
    return { ok: false, reason: 'missing_label' };
  }

  const parts = label.split(':');
  if (parts.length < 3) {
    console.warn(`[YooMoney] Bad label format: ${label}`);
    return { ok: false, reason: 'bad_label' };
  }

  const userId = Number(parts[0]);
  const packageId = parts[1];
  // nonce = parts[2] (not used after parsing, just ensures label uniqueness)

  if (!userId || !packageId) {
    console.warn(`[YooMoney] Could not parse userId/packageId from label: ${label}`);
    return { ok: false, reason: 'bad_label' };
  }

  // Find package on backend (never trust client price)
  const { getPackageById } = await import('../src/data/tariffs.js');
  const pkg = getPackageById(packageId);
  if (!pkg) {
    console.warn(`[YooMoney] Unknown packageId: ${packageId}`);
    return { ok: false, reason: 'unknown_package' };
  }

  // Step 4b: amount check
  // 'amount' = what the wallet received (may be after YooMoney commission).
  // Allow up to 10% below expected to handle commissions; log the delta.
  const paidAmount = parseFloat(amount || '0');
  const minAcceptable = pkg.price * 0.90;
  if (paidAmount < minAcceptable) {
    console.warn(
      `[YooMoney] Amount mismatch: expected ~${pkg.price}, got ${paidAmount} for operation ${operation_id}`,
    );
    // Record as mismatch but don't credit
    await pool.query(
      `INSERT INTO payments (user_id, package_id, label, expected_amount, paid_amount, operation_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'mismatch')
       ON CONFLICT (operation_id) DO NOTHING`,
      [userId, packageId, label, pkg.price, paidAmount, operation_id],
    ).catch(() => {});
    return { ok: false, reason: 'amount_mismatch' };
  }

  // Step 5: atomic credit + record (UNIQUE on operation_id prevents double-grant)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert completed payment — will fail on duplicate operation_id (idempotency guard)
    const insertResult = await client.query(
      `INSERT INTO payments
         (user_id, package_id, label, expected_amount, paid_amount, operation_id, credits_granted, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
       ON CONFLICT (operation_id) DO NOTHING
       RETURNING id`,
      [userId, packageId, label, pkg.price, paidAmount, operation_id, pkg.credits],
    );

    // If no row inserted — race condition caught by UNIQUE, already processed
    if (insertResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log(`[YooMoney] Race-condition duplicate for operation_id=${operation_id}, skipping`);
      return { ok: true, reason: 'already_processed' };
    }

    // Credit the user
    await client.query(
      'UPDATE users SET credits = credits + $1 WHERE id = $2',
      [pkg.credits, userId],
    );

    await client.query('COMMIT');

    console.log(
      `[YooMoney] ✓ Credited ${pkg.credits} credits to user ${userId} ` +
      `(package=${packageId}, operation=${operation_id}, amount=${paidAmount})`,
    );
    return { ok: true, reason: 'credited' };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[YooMoney] Transaction error:', err.message);
    return { ok: false, reason: 'db_error' };
  } finally {
    client.release();
  }
}
