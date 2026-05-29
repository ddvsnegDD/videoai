import express from 'express';
import cookieParser from 'cookie-parser';
import { resolve, join } from 'path';
import pool, { initDB } from './server/db.js';
import { sendCode, verifyCode, requireAuth, getMe } from './server/auth.js';
import { createJob, getJob, listJobs, runWatchdog } from './server/jobs.js';
import { CREDITS_COST } from './server/providers/llm.js';

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
      maxAge: 30 * 24 * 60 * 60 * 1000,
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

// ── Projects ──
app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const { title, brief } = req.body;
    if (!title || !brief) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    const result = await pool.query(
      `INSERT INTO projects (user_id, title, brief) VALUES ($1, $2, $3) RETURNING *`,
      [req.userId, title, JSON.stringify(brief)]
    );
    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('create project error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('list projects error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('get project error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { title, brief, status } = req.body;
    const existing = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }
    const sets = [];
    const vals = [];
    let idx = 1;
    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (brief !== undefined) { sets.push(`brief = $${idx++}`); vals.push(JSON.stringify(brief)); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
    if (sets.length === 0) {
      return res.json({ project: existing.rows[0] });
    }
    vals.push(req.params.id);
    const result = await pool.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('patch project error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Jobs ──
app.post('/api/jobs', requireAuth, async (req, res) => {
  try {
    const { projectId, type, input } = req.body;
    if (!projectId || !type || !input) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    const project = await pool.query(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, req.userId]
    );
    if (project.rows.length === 0) {
      return res.status(404).json({ error: 'project_not_found' });
    }
    const costCredits = type === 'script' ? CREDITS_COST : 0;
    const { jobId } = await createJob({
      userId: req.userId,
      projectId,
      type,
      input,
      costCredits,
    });
    res.json({ jobId });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: 'INSUFFICIENT_CREDITS' });
    }
    console.error('create job error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/jobs/:id', requireAuth, async (req, res) => {
  try {
    const job = await getJob(req.params.id, req.userId);
    if (!job) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ job });
  } catch (err) {
    console.error('get job error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/jobs', requireAuth, async (req, res) => {
  try {
    const jobs = await listJobs({
      userId: req.userId,
      projectId: req.query.projectId ? Number(req.query.projectId) : undefined,
    });
    res.json({ jobs });
  } catch (err) {
    console.error('list jobs error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── TEMP: cleanup test data (remove after use) ──
app.post('/api/admin/cleanup-test-data', requireAuth, async (req, res) => {
  try {
    const jobs = await pool.query('DELETE FROM generation_jobs WHERE user_id = $1 RETURNING id', [req.userId]);
    const projects = await pool.query('DELETE FROM projects WHERE user_id = $1 RETURNING id', [req.userId]);
    res.json({ deletedJobs: jobs.rowCount, deletedProjects: projects.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

  // Watchdog: check stuck jobs every 60s
  setInterval(runWatchdog, 60000);

  app.listen(PORT, () => {
    console.log(`VideoAI server running on port ${PORT}`);
  });
}

start();
