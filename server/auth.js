import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { sendOTPEmail } from './email.js';
import { validateNewEmail } from './validateEmail.js';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const OTP_EXPIRY_MIN = 10;
const OTP_RATE_LIMIT_SEC = 60;
const MAX_ATTEMPTS = 5;
const JWT_EXPIRY = '30d';
const WELCOME_CREDITS_EMAIL = Number(process.env.WELCOME_CREDITS_EMAIL) || 10;
const FREE_WAN_EMAIL = parseInt(process.env.FREE_WAN_EMAIL ?? '1', 10);
const FREE_VEO_EMAIL = parseInt(process.env.FREE_VEO_EMAIL ?? '0', 10);
const FREE_IMAGE_EMAIL = parseInt(process.env.FREE_IMAGE_EMAIL ?? '1', 10);
const CONSENT_VERSION = '2026-06-08';

function generateCode() {
  return String(randomInt(100000, 1000000));
}

export async function sendCode(email) {
  const normalized = email.trim().toLowerCase();

  // Grandfather rule: validate domain only for NEW registrations
  const existing = await pool.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  if (existing.rows.length === 0) {
    const rejection = await validateNewEmail(normalized);
    if (rejection) return { error: 'domain_blocked', message: rejection };
  }

  // Rate limit: 1 code per 60 seconds per email
  const recent = await pool.query(
    `SELECT id FROM auth_codes
     WHERE email = $1 AND created_at > NOW() - INTERVAL '${OTP_RATE_LIMIT_SEC} seconds'
     ORDER BY created_at DESC LIMIT 1`,
    [normalized]
  );

  if (recent.rows.length > 0) {
    return { error: 'too_soon', wait: OTP_RATE_LIMIT_SEC };
  }

  await pool.query(
    `DELETE FROM auth_codes WHERE email = $1 AND expires_at < NOW()`,
    [normalized]
  );

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

  await pool.query(
    `INSERT INTO auth_codes (email, code, expires_at) VALUES ($1, $2, $3)`,
    [normalized, code, expiresAt]
  );

  await sendOTPEmail(normalized, code);

  return { ok: true };
}

export async function verifyCode(email, code) {
  const normalized = email.trim().toLowerCase();

  const active = await pool.query(
    `SELECT id, code, attempts FROM auth_codes
     WHERE email = $1 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalized]
  );

  if (active.rows.length === 0) {
    return { error: 'invalid_code' };
  }

  const row = active.rows[0];

  if (row.attempts >= MAX_ATTEMPTS) {
    await pool.query(`UPDATE auth_codes SET used = TRUE WHERE id = $1`, [row.id]);
    return { error: 'too_many_attempts' };
  }

  if (row.code !== code) {
    await pool.query(`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    if (row.attempts + 1 >= MAX_ATTEMPTS) {
      await pool.query(`UPDATE auth_codes SET used = TRUE WHERE id = $1`, [row.id]);
      return { error: 'too_many_attempts' };
    }
    return { error: 'invalid_code' };
  }

  await pool.query(`UPDATE auth_codes SET used = TRUE WHERE id = $1`, [row.id]);

  // Find or create user
  let user = await pool.query(`SELECT * FROM users WHERE email = $1`, [normalized]);

  if (user.rows.length === 0) {
    user = await pool.query(
      `INSERT INTO users (email, credits, free_wan, free_veo, free_image, consent_accepted_at, consent_version) VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING *`,
      [normalized, WELCOME_CREDITS_EMAIL, FREE_WAN_EMAIL, FREE_VEO_EMAIL, FREE_IMAGE_EMAIL, CONSENT_VERSION]
    );
  } else if (!user.rows[0].consent_accepted_at) {
    await pool.query(
      `UPDATE users SET consent_accepted_at = NOW(), consent_version = $1 WHERE id = $2`,
      [CONSENT_VERSION, user.rows[0].id],
    );
  }

  const userData = user.rows[0];

  // Generate JWT
  const token = jwt.sign(
    { userId: userData.id, email: userData.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  return { ok: true, token, user: sanitizeUser(userData) };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export async function getMe(userId) {
  const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (result.rows.length === 0) return null;
  return sanitizeUser(result.rows[0]);
}

function sanitizeUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    credits: row.credits,
    free_wan: row.free_wan ?? 0,
    free_veo: row.free_veo ?? 0,
    free_image: row.free_image ?? 0,
    avatar_url: row.avatar_url || null,
    auth_provider: row.auth_provider || null,
    created_at: row.created_at,
  };
}
