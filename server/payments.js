/**
 * server/payments.js — YooKassa v3 API integration
 *
 * Принципы:
 * - Кредиты начисляются ТОЛЬКО после GET-верификации статуса (вебхуку вслепую не доверяем)
 * - Идемпотентность: UNIQUE index на yookassa_payment_id, ON CONFLICT DO NOTHING
 * - capture: true (СБП — только одностадийная оплата)
 * - receipt-объект НЕ передаём (самозанятый/НПД — чеки через "Мой налог")
 * - Чеки не блокируют начисление кредитов
 */

import { randomUUID } from 'crypto';
import pool from './db.js';

const YOOKASSA_API = 'https://api.yookassa.ru/v3';

// ── Helpers ──

function getAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) return null;
  return { shopId, secretKey };
}

function basicAuthHeader(shopId, secretKey) {
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
}

/**
 * Low-level YooKassa API request.
 */
async function yookassaRequest(method, path, { body, idempotenceKey } = {}) {
  const auth = getAuth();
  if (!auth) throw new Error('YooKassa credentials not configured');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': basicAuthHeader(auth.shopId, auth.secretKey),
  };
  if (idempotenceKey) {
    headers['Idempotence-Key'] = idempotenceKey;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${YOOKASSA_API}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data?.description || data?.message || `HTTP ${res.status}`;
    console.log(`[YooKassa] API error ${res.status}: ${errMsg}`, JSON.stringify(data));
    const err = new Error(`YooKassa API: ${errMsg}`);
    err.status = res.status;
    err.yookassaError = data;
    throw err;
  }

  return data;
}


// ══════════════════════════════════════════════════════════
// 1. CREATE PAYMENT
// ══════════════════════════════════════════════════════════

/**
 * Создаёт платёж в ЮKassa + pending-запись в БД.
 * Возвращает { confirmationUrl, paymentDbId }.
 */
export async function createPayment({ userId, pkg }) {
  const auth = getAuth();
  if (!auth) throw new Error('payments_not_configured');

  const idempotenceKey = randomUUID();
  const appUrl = process.env.APP_URL || 'https://ddvideoai.ru';

  // 1. Сначала создаём pending-запись в БД, чтобы получить paymentDbId для return_url
  const insertResult = await pool.query(
    `INSERT INTO payments
       (user_id, package_id, expected_amount, status, provider, idempotence_key, created_at)
     VALUES ($1, $2, $3, 'pending', 'yookassa', $4, NOW())
     RETURNING id`,
    [userId, pkg.id, pkg.price, idempotenceKey],
  );
  const paymentDbId = insertResult.rows[0].id;

  // 2. Создаём платёж в ЮKassa (paymentDbId в return_url для фронтенда)
  const yooPayment = await yookassaRequest('POST', '/payments', {
    idempotenceKey,
    body: {
      amount: {
        value: String(pkg.price) + '.00',
        currency: 'RUB',
      },
      capture: true, // одностадийная — обязательно для СБП
      confirmation: {
        type: 'redirect',
        return_url: `${appUrl}/payment/result?paymentId=${paymentDbId}`,
      },
      description: `${pkg.title} — ${pkg.credits} кредитов`,
      metadata: {
        user_id: String(userId),
        package_id: pkg.id,
      },
    },
  });

  console.log(`[YooKassa] Payment created: id=${yooPayment.id}, status=${yooPayment.status}, dbId=${paymentDbId}`);

  // 3. Обновляем запись с yookassa_payment_id
  await pool.query(
    `UPDATE payments SET yookassa_payment_id = $1 WHERE id = $2`,
    [yooPayment.id, paymentDbId],
  );

  const confirmationUrl = yooPayment.confirmation?.confirmation_url;
  if (!confirmationUrl) {
    console.log(`[YooKassa] WARNING: No confirmation_url in response:`, JSON.stringify(yooPayment));
    throw new Error('no_confirmation_url');
  }

  return {
    confirmationUrl,
    paymentDbId,
    yookassaPaymentId: yooPayment.id,
  };
}


// ══════════════════════════════════════════════════════════
// 2. VERIFY PAYMENT (GET /payments/{id})
// ══════════════════════════════════════════════════════════

/**
 * Проверяет статус платежа в ЮKassa через GET.
 * Возвращает полный объект платежа.
 */
export async function verifyPayment(yookassaPaymentId) {
  return yookassaRequest('GET', `/payments/${yookassaPaymentId}`);
}


// ══════════════════════════════════════════════════════════
// 3. PROCESS WEBHOOK (POST from YooKassa)
// ══════════════════════════════════════════════════════════

/**
 * Обрабатывает вебхук от ЮKassa.
 * НЕ доверяет телу вебхука — верифицирует через GET.
 * Returns { ok, reason }.
 */
export async function processWebhook({ body }) {
  const event = body?.event;
  const paymentObj = body?.object;

  if (!paymentObj?.id) {
    console.log('[YooKassa] Webhook: missing payment id in body');
    return { ok: false, reason: 'missing_payment_id' };
  }

  const yookassaPaymentId = paymentObj.id;
  console.log(`[YooKassa] Webhook received: event=${event}, payment_id=${yookassaPaymentId}`);

  // Только payment.succeeded и payment.canceled нас интересуют
  if (event === 'payment.succeeded') {
    return creditPayment(yookassaPaymentId);
  }

  if (event === 'payment.canceled') {
    return cancelPayment(yookassaPaymentId);
  }

  // Остальные события (waiting_for_capture и т.д.) — просто логируем
  console.log(`[YooKassa] Webhook event=${event} for ${yookassaPaymentId} — ignored`);
  return { ok: true, reason: 'event_ignored' };
}


// ══════════════════════════════════════════════════════════
// 4. CREDIT PAYMENT (idempotent)
// ══════════════════════════════════════════════════════════

/**
 * Верифицирует платёж через GET, начисляет кредиты.
 * Идемпотентно: UNIQUE index на yookassa_payment_id + ON CONFLICT + atomic TX.
 */
async function creditPayment(yookassaPaymentId) {
  // Step 1: Верификация через GET (НИКОГДА не доверяем телу вебхука)
  let verified;
  try {
    verified = await verifyPayment(yookassaPaymentId);
  } catch (err) {
    console.log(`[YooKassa] GET verify failed for ${yookassaPaymentId}: ${err.message}`);
    return { ok: false, reason: 'verify_failed' };
  }

  if (verified.status !== 'succeeded') {
    console.log(`[YooKassa] Verify: payment ${yookassaPaymentId} status=${verified.status}, expected succeeded`);
    return { ok: false, reason: 'not_succeeded' };
  }

  // Step 2: Extract metadata
  const userId = Number(verified.metadata?.user_id);
  const packageId = verified.metadata?.package_id;
  const paidAmount = parseFloat(verified.amount?.value || '0');

  if (!userId || !packageId) {
    console.log(`[YooKassa] Missing metadata in payment ${yookassaPaymentId}:`, verified.metadata);
    return { ok: false, reason: 'missing_metadata' };
  }

  // Step 3: Get package from server (never trust client)
  const { getPackageById } = await import('../src/data/tariffs.js');
  const pkg = getPackageById(packageId);
  if (!pkg) {
    console.log(`[YooKassa] Unknown package_id: ${packageId}`);
    return { ok: false, reason: 'unknown_package' };
  }

  // Step 4: Amount check (allow small rounding, but not major mismatch)
  const minAcceptable = pkg.price * 0.99; // YooKassa charges exact amount, tiny tolerance
  if (paidAmount < minAcceptable) {
    console.log(`[YooKassa] Amount mismatch: expected ${pkg.price}, got ${paidAmount} for ${yookassaPaymentId}`);
    // Record as mismatch
    await pool.query(
      `UPDATE payments SET status = 'mismatch', paid_amount = $1
       WHERE yookassa_payment_id = $2 AND status = 'pending'`,
      [paidAmount, yookassaPaymentId],
    ).catch(() => {});
    return { ok: false, reason: 'amount_mismatch' };
  }

  // Step 5: Atomic credit grant (idempotent via UNIQUE on yookassa_payment_id)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Try to update the pending payment → completed
    // Uses yookassa_payment_id UNIQUE constraint for dedup
    const updateResult = await client.query(
      `UPDATE payments
       SET status = 'completed',
           paid_amount = $1,
           credits_granted = $2,
           completed_at = NOW()
       WHERE yookassa_payment_id = $3
         AND status = 'pending'
       RETURNING id, user_id`,
      [paidAmount, pkg.credits, yookassaPaymentId],
    );

    if (updateResult.rows.length === 0) {
      // Either already completed (idempotent) or doesn't exist
      await client.query('ROLLBACK');
      const check = await pool.query(
        `SELECT status FROM payments WHERE yookassa_payment_id = $1`,
        [yookassaPaymentId],
      );
      if (check.rows.length > 0 && check.rows[0].status === 'completed') {
        console.log(`[YooKassa] Already credited ${yookassaPaymentId}, skipping`);
        return { ok: true, reason: 'already_processed' };
      }
      // Payment record not found — insert as new completed
      // (handles case where webhook arrives before DB insert completes)
      await client.query('BEGIN');
      const insertResult = await client.query(
        `INSERT INTO payments
           (user_id, package_id, expected_amount, paid_amount, credits_granted,
            status, provider, yookassa_payment_id, completed_at)
         VALUES ($1, $2, $3, $4, $5, 'completed', 'yookassa', $6, NOW())
         ON CONFLICT (yookassa_payment_id) WHERE yookassa_payment_id IS NOT NULL
         DO NOTHING
         RETURNING id`,
        [userId, packageId, pkg.price, paidAmount, pkg.credits, yookassaPaymentId],
      );

      if (insertResult.rows.length === 0) {
        await client.query('ROLLBACK');
        console.log(`[YooKassa] Race-condition duplicate for ${yookassaPaymentId}`);
        return { ok: true, reason: 'already_processed' };
      }

      // Credit user in same transaction
      await client.query(
        'UPDATE users SET credits = credits + $1 WHERE id = $2',
        [pkg.credits, userId],
      );
      await client.query('COMMIT');
      console.log(`[YooKassa] ✓ Credited ${pkg.credits} to user ${userId} (pkg=${packageId}, payment=${yookassaPaymentId}, amount=${paidAmount}) [insert path]`);
      enqueueReceipt({ yookassaPaymentId, userId, pkg, paidAmount });
      return { ok: true, reason: 'credited' };
    }

    // Normal path: pending → completed
    await client.query(
      'UPDATE users SET credits = credits + $1 WHERE id = $2',
      [pkg.credits, userId],
    );
    await client.query('COMMIT');

    console.log(
      `[YooKassa] ✓ Credited ${pkg.credits} to user ${userId} ` +
      `(pkg=${packageId}, payment=${yookassaPaymentId}, amount=${paidAmount})`,
    );

    // Enqueue receipt for self-employed tracking (non-blocking)
    enqueueReceipt({ yookassaPaymentId, userId, pkg, paidAmount });

    return { ok: true, reason: 'credited' };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.log(`[YooKassa] Credit TX error for ${yookassaPaymentId}:`, err.message);
    return { ok: false, reason: 'db_error' };
  } finally {
    client.release();
  }
}


// ══════════════════════════════════════════════════════════
// 5. CANCEL PAYMENT
// ══════════════════════════════════════════════════════════

async function cancelPayment(yookassaPaymentId) {
  await pool.query(
    `UPDATE payments SET status = 'canceled'
     WHERE yookassa_payment_id = $1 AND status = 'pending'`,
    [yookassaPaymentId],
  ).catch(() => {});
  console.log(`[YooKassa] Payment ${yookassaPaymentId} canceled`);
  return { ok: true, reason: 'canceled' };
}


// ══════════════════════════════════════════════════════════
// 6. RECEIPT QUEUE (self-employed manual tracking)
// ══════════════════════════════════════════════════════════

/**
 * Добавляет запись в очередь чеков.
 * Чеки НЕ блокируют кредиты — это только трекинг для "Мой налог".
 */
async function enqueueReceipt({ yookassaPaymentId, userId, pkg, paidAmount }) {
  try {
    // Get user email for receipt
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const email = userResult.rows[0]?.email || '';

    // Get payment DB id
    const paymentResult = await pool.query(
      'SELECT id FROM payments WHERE yookassa_payment_id = $1',
      [yookassaPaymentId],
    );
    const paymentId = paymentResult.rows[0]?.id;
    if (!paymentId) return;

    await pool.query(
      `INSERT INTO pending_receipts (payment_id, user_email, amount, description, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [paymentId, email, paidAmount, `${pkg.title} — ${pkg.credits} кредитов`],
    );

    // Update payment receipt_status
    await pool.query(
      `UPDATE payments SET receipt_status = 'pending' WHERE id = $1`,
      [paymentId],
    );

    console.log(`[YooKassa] Receipt enqueued for payment ${yookassaPaymentId}`);
  } catch (err) {
    // Never block credits for receipt errors
    console.log(`[YooKassa] Receipt enqueue failed (non-blocking): ${err.message}`);
  }
}


// ══════════════════════════════════════════════════════════
// 7. GET PAYMENT STATUS (for frontend polling)
// ══════════════════════════════════════════════════════════

/**
 * Возвращает статус платежа для фронтенда.
 * Если pending — проверяет через GET ЮKassa и обновляет.
 */
export async function getPaymentStatus(paymentDbId, userId) {
  const result = await pool.query(
    `SELECT id, package_id, expected_amount, paid_amount, credits_granted,
            status, yookassa_payment_id, created_at, completed_at
     FROM payments WHERE id = $1 AND user_id = $2`,
    [paymentDbId, userId],
  );

  if (result.rows.length === 0) return null;
  const payment = result.rows[0];

  // If still pending and has yookassa_payment_id — check live status
  if (payment.status === 'pending' && payment.yookassa_payment_id) {
    try {
      const verified = await verifyPayment(payment.yookassa_payment_id);
      if (verified.status === 'succeeded') {
        // Trigger credit (idempotent)
        await creditPayment(payment.yookassa_payment_id);
        // Re-fetch updated record
        const updated = await pool.query(
          `SELECT id, package_id, expected_amount, paid_amount, credits_granted,
                  status, created_at, completed_at
           FROM payments WHERE id = $1`,
          [paymentDbId],
        );
        return updated.rows[0] || payment;
      }
      if (verified.status === 'canceled') {
        await cancelPayment(payment.yookassa_payment_id);
        payment.status = 'canceled';
      }
    } catch (err) {
      console.log(`[YooKassa] Status check failed for payment ${paymentDbId}: ${err.message}`);
      // Return current DB state on error
    }
  }

  return payment;
}


// ══════════════════════════════════════════════════════════
// 8. PAYMENT RECONCILER
// ══════════════════════════════════════════════════════════

const PAYMENT_STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const PAYMENT_RECONCILE_INTERVAL = 2 * 60 * 1000; // every 2 min

/**
 * Проверяет pending-платежи старше порога, верифицирует через GET.
 */
export async function reconcilePayments() {
  try {
    const staleThreshold = new Date(Date.now() - PAYMENT_STALE_THRESHOLD).toISOString();
    const result = await pool.query(
      `SELECT id, yookassa_payment_id
       FROM payments
       WHERE status = 'pending'
         AND provider = 'yookassa'
         AND yookassa_payment_id IS NOT NULL
         AND created_at < $1
       LIMIT 10`,
      [staleThreshold],
    );

    if (result.rows.length === 0) return;
    console.log(`[YooKassa] Reconciler: checking ${result.rows.length} stale payments`);

    for (const row of result.rows) {
      try {
        const verified = await verifyPayment(row.yookassa_payment_id);

        if (verified.status === 'succeeded') {
          console.log(`[YooKassa] Reconciler: crediting ${row.yookassa_payment_id}`);
          await creditPayment(row.yookassa_payment_id);
        } else if (verified.status === 'canceled') {
          await cancelPayment(row.yookassa_payment_id);
        }
        // pending/waiting_for_capture — оставляем, проверим позже
      } catch (err) {
        console.log(`[YooKassa] Reconciler error for ${row.yookassa_payment_id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`[YooKassa] Reconciler error: ${err.message}`);
  }
}

/**
 * Запускает интервальный reconciler для платежей.
 */
export function startPaymentReconciler() {
  console.log(`[YooKassa] Payment reconciler started (interval=${PAYMENT_RECONCILE_INTERVAL / 1000}s, stale=${PAYMENT_STALE_THRESHOLD / 1000}s)`);
  setInterval(reconcilePayments, PAYMENT_RECONCILE_INTERVAL);
  // Run once on startup after 30s delay
  setTimeout(reconcilePayments, 30_000);
}


// ══════════════════════════════════════════════════════════
// LEGACY: YooMoney functions (kept for old webhook compat)
// ══════════════════════════════════════════════════════════

import crypto from 'crypto';

function rfc3986Encode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function verifyYooMoneySign(params, secret) {
  const received = params.sign;
  if (!received) return false;
  const sorted = Object.keys(params).filter(k => k !== 'sign').sort();
  const message = sorted.map(k => `${k}=${rfc3986Encode(params[k] ?? '')}`).join('&');
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(received.toLowerCase(), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

export async function processYooMoneyWebhook({ params, secret }) {
  const signOk = verifyYooMoneySign(params, secret);
  if (!signOk) return { ok: false, reason: 'invalid_sign' };
  if (params.test_notification === 'true') return { ok: true, reason: 'test_notification' };

  const { operation_id, label, amount } = params;
  if (!operation_id) return { ok: false, reason: 'missing_operation_id' };

  const existing = await pool.query(
    `SELECT id, status FROM payments WHERE operation_id = $1 LIMIT 1`,
    [operation_id],
  );
  if (existing.rows.length > 0 && existing.rows[0].status === 'completed') {
    return { ok: true, reason: 'already_processed' };
  }

  if (!label) return { ok: false, reason: 'missing_label' };
  const parts = label.split(':');
  if (parts.length < 3) return { ok: false, reason: 'bad_label' };
  const userId = Number(parts[0]);
  const packageId = parts[1];
  if (!userId || !packageId) return { ok: false, reason: 'bad_label' };

  const { getPackageById } = await import('../src/data/tariffs.js');
  const pkg = getPackageById(packageId);
  if (!pkg) return { ok: false, reason: 'unknown_package' };

  const paidAmount = parseFloat(amount || '0');
  if (paidAmount < pkg.price * 0.90) {
    await pool.query(
      `INSERT INTO payments (user_id, package_id, label, expected_amount, paid_amount, operation_id, status, provider)
       VALUES ($1, $2, $3, $4, $5, $6, 'mismatch', 'yoomoney')
       ON CONFLICT (operation_id) DO NOTHING`,
      [userId, packageId, label, pkg.price, paidAmount, operation_id],
    ).catch(() => {});
    return { ok: false, reason: 'amount_mismatch' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertResult = await client.query(
      `INSERT INTO payments
         (user_id, package_id, label, expected_amount, paid_amount, operation_id, credits_granted, status, provider, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', 'yoomoney', NOW())
       ON CONFLICT (operation_id) DO NOTHING
       RETURNING id`,
      [userId, packageId, label, pkg.price, paidAmount, operation_id, pkg.credits],
    );
    if (insertResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: true, reason: 'already_processed' };
    }
    await client.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [pkg.credits, userId]);
    await client.query('COMMIT');
    console.log(`[YooMoney] ✓ Credited ${pkg.credits} to user ${userId} (op=${operation_id})`);
    return { ok: true, reason: 'credited' };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, reason: 'db_error' };
  } finally {
    client.release();
  }
}
