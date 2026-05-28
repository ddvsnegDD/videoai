import jwt from 'jsonwebtoken';
import pool from './db.js';
import { sendOTPEmail } from './email.js';

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';
const OTP_EXPIRY_MIN = 10;
const OTP_RATE_LIMIT_SEC = 60;
const JWT_EXPIRY = '30d';
const WELCOME_CREDITS = 30;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendCode(email) {
  const normalized = email.trim().toLowerCase();

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

  const result = await pool.query(
    `SELECT id FROM auth_codes
     WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalized, code]
  );

  if (result.rows.length === 0) {
    return { error: 'invalid_code' };
  }

  // Mark code as used
  await pool.query(`UPDATE auth_codes SET used = TRUE WHERE id = $1`, [result.rows[0].id]);

  // Find or create user
  let user = await pool.query(`SELECT * FROM users WHERE email = $1`, [normalized]);

  if (user.rows.length === 0) {
    user = await pool.query(
      `INSERT INTO users (email, credits) VALUES ($1, $2) RETURNING *`,
      [normalized, WELCOME_CREDITS]
    );
  }

  const userData = user.rows[0];

  // Generate JWT
  const token = jwt.sign(
    { userId: userData.id, email: userData.email },
    JWT_SECRET(),
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
    const payload = jwt.verify(token, JWT_SECRET());
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
    created_at: row.created_at,
  };
}
