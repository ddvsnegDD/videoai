import express from 'express';
import cookieParser from 'cookie-parser';
import { resolve, join } from 'path';
import pool, { initDB } from './server/db.js';
import { sendCode, verifyCode, requireAuth, getMe } from './server/auth.js';

const app = express();
const DIST = resolve('dist');

app.use(express.json());
app.use(cookieParser());

// ── Health ──
app.get('/api/health', async (req, res) => {
  let db = false;
  try {
    await pool.query('SELECT 1');
    db = true;
  } catch {}
  res.json({ status: 'ok', db, timestamp: new Date().toISOString() });
});

// ── Auth: send OTP code ──
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    const result = await sendCode(email);
    if (result.error) {
      return res.status(429).json(result);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('send-code error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Auth: verify OTP code ──
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    const result = await verifyCode(email, code);
    if (result.error) {
      return res.status(400).json(result);
    }
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
    res.json({ ok: true, user: result.user });
  } catch (err) {
    console.error('verify error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Auth: get current user ──
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await getMe(req.userId);
    if (!user) {
      res.clearCookie('token');
      return res.status(401).json({ error: 'user_not_found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Auth: logout ──
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

// ── Static + SPA fallback (ALWAYS LAST) ──
app.use(express.static(DIST));
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3000;

async function start() {
  if (process.env.DATABASE_URL) {
    try {
      await initDB();
      console.log('Database initialized');
    } catch (err) {
      console.warn('DB init warning:', err.message);
    }
  } else {
    console.warn('DATABASE_URL not set — auth disabled');
  }

  app.listen(PORT, () => {
    console.log(`VideoAI server running on port ${PORT}`);
  });
}

start();
