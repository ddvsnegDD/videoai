import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { resolve, join } from 'path';
import pool, { initDB } from './server/db.js';
import { sendCode, verifyCode, requireAuth, getMe } from './server/auth.js';
import { createJob, getJob, listJobs, runWatchdog } from './server/jobs.js';
import { VIDEO_MODELS, MOTION_PRESETS } from './server/providers/falVideo.js';
import { uploadBuffer } from './server/storage.js';

const app = express();
const DIST = resolve('dist');

app.use(express.json());
app.use(cookieParser());

// Multer for image upload (memory storage → S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP allowed'));
    }
  },
});

// ── Health ──
app.get('/api/health', async (req, res) => {
  let db = false;
  try { await pool.query('SELECT 1'); db = true; } catch {}
  res.json({ status: 'ok', db, timestamp: new Date().toISOString() });
});

// ── Auth ──
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
    const result = await sendCode(email);
    if (result.error) return res.status(429).json(result);
    res.json({ ok: true });
  } catch (err) {
    console.error('send-code error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'missing_fields' });
    const result = await verifyCode(email, code);
    if (result.error) return res.status(400).json(result);
    res.cookie('token', result.token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/',
    });
    res.json({ ok: true, user: result.user });
  } catch (err) {
    console.error('verify error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await getMe(req.userId);
    if (!user) { res.clearCookie('token'); return res.status(401).json({ error: 'user_not_found' }); }
    res.json({ user });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

// ── Config (public) ──
app.get('/api/config', (_req, res) => {
  res.json({
    video_models: Object.fromEntries(
      Object.entries(VIDEO_MODELS).map(([k, v]) => [k, { label: v.label, label_full: v.label_full, credits: v.credits }]),
    ),
    motion_presets: MOTION_PRESETS.map(p => ({ key: p.key, label: p.label })),
  });
});

// ── Upload image ──
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });

    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const ext = extMap[req.file.mimetype] || 'jpg';
    const key = `uploads/${req.userId}/${Date.now()}.${ext}`;

    const url = await uploadBuffer({
      buffer: req.file.buffer,
      key,
      contentType: req.file.mimetype,
    });

    res.json({ url });
  } catch (err) {
    console.error('upload error:', err);
    res.status(500).json({ error: 'upload_failed' });
  }
});

// ── Projects ──
app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const { title, brief } = req.body;
    if (!title || !brief) return res.status(400).json({ error: 'missing_fields' });
    const result = await pool.query(
      `INSERT INTO projects (user_id, title, brief) VALUES ($1, $2, $3) RETURNING *`,
      [req.userId, title, JSON.stringify(brief)],
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
      [req.userId],
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
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });
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
      [req.params.id, req.userId],
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const sets = []; const vals = []; let idx = 1;
    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (brief !== undefined) { sets.push(`brief = $${idx++}`); vals.push(JSON.stringify(brief)); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
    if (sets.length === 0) return res.json({ project: existing.rows[0] });
    vals.push(req.params.id);
    const result = await pool.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
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
    if (!projectId || !type || !input) return res.status(400).json({ error: 'missing_fields' });

    const project = await pool.query(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, req.userId],
    );
    if (project.rows.length === 0) return res.status(404).json({ error: 'project_not_found' });

    if (type === 'animate') {
      if (!input.imageUrl || !input.modelKey) {
        return res.status(400).json({ error: 'missing_animate_fields' });
      }
      // Resolve motion prompt: custom text > preset lookup > default
      if (!input.motionPrompt) {
        const preset = MOTION_PRESETS.find(p => p.key === input.motionKey);
        input.motionPrompt = preset?.prompt || MOTION_PRESETS[0].prompt;
      }
      const model = VIDEO_MODELS[input.modelKey];
      if (!model) return res.status(400).json({ error: 'invalid_model' });

      // Check free try
      const freeCol = input.modelKey === 'wan' ? 'free_wan' : 'free_veo';
      const userRow = await pool.query(`SELECT ${freeCol} FROM users WHERE id = $1`, [req.userId]);
      const hasFree = userRow.rows[0]?.[freeCol] > 0;

      const { jobId } = await createJob({
        userId: req.userId,
        projectId,
        type,
        input: { ...input, projectId },
        costCredits: hasFree ? 0 : model.credits,
        freeColumn: hasFree ? freeCol : null,
      });
      return res.json({ jobId });
    }

    return res.status(400).json({ error: 'invalid_type' });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'INSUFFICIENT_CREDITS' });
    if (err.message === 'NO_FREE_TRY') return res.status(402).json({ error: 'INSUFFICIENT_CREDITS' });
    console.error('create job error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/jobs/:id', requireAuth, async (req, res) => {
  try {
    const job = await getJob(req.params.id, req.userId);
    if (!job) return res.status(404).json({ error: 'not_found' });
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

// ── Admin ──
async function requireAdmin(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'not_authenticated' });
  try {
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    const userRow = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (userRow.rows.length === 0 || userRow.rows[0].role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.credits, u.role, u.free_wan, u.free_veo, u.created_at,
             COUNT(p.id)::int AS projects_count
      FROM users u LEFT JOIN projects p ON p.user_id = u.id
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT 100
    `);
    res.json({ users: result.rows });
  } catch (err) {
    console.error('admin users error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/admin/users/:id/credits', requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body;
    if (amount === undefined || typeof amount !== 'number') return res.status(400).json({ error: 'invalid_amount' });
    const result = await pool.query(
      `UPDATE users SET credits = GREATEST(credits + $1, 0) WHERE id = $2
       RETURNING id, email, credits, role, free_wan, free_veo, created_at`,
      [amount, Number(req.params.id)],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    console.log(`[Admin] Credits: user ${req.params.id} ${amount > 0 ? '+' : ''}${amount} → ${result.rows[0].credits}`);
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('admin credits error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/admin/jobs', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT j.id, u.email AS user_email, j.type, j.status, j.cost_credits,
             j.error, j.created_at, j.updated_at
      FROM generation_jobs j JOIN users u ON u.id = j.user_id
      ORDER BY j.created_at DESC LIMIT 50
    `);
    res.json({ jobs: result.rows });
  } catch (err) {
    console.error('admin jobs error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Static + SPA ──
app.use(express.static(DIST));
app.get('/{*splat}', (_req, res) => { res.sendFile(join(DIST, 'index.html')); });

const PORT = process.env.PORT || 3000;

async function start() {
  if (process.env.DATABASE_URL) {
    try { await initDB(); console.log('Database initialized'); }
    catch (err) { console.warn('DB init warning:', err.message); }

    // Promote admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      try {
        const r = await pool.query(
          `UPDATE users SET role = 'admin' WHERE email = $1 AND role != 'admin' RETURNING email`,
          [adminEmail.trim().toLowerCase()],
        );
        if (r.rows.length > 0) console.log(`[Admin] Promoted ${r.rows[0].email}`);
      } catch (err) { console.warn('Admin promotion warning:', err.message); }
    }
  } else {
    console.warn('DATABASE_URL not set');
  }

  setInterval(runWatchdog, 60000);
  app.listen(PORT, () => console.log(`VideoAI server on port ${PORT}`));
}

start();
