import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { resolve, join } from 'path';
import pool, { initDB } from './server/db.js';
import { sendCode, verifyCode, requireAuth, getMe } from './server/auth.js';
import { createJob, getJob, listJobs, runWatchdog, startReconciler } from './server/jobs.js';
import { VIDEO_MODELS, MOTION_PRESETS } from './server/providers/falVideo.js';
import { IMAGE_MODEL } from './server/providers/falImage.js';
import { uploadBuffer, deleteByPrefix } from './server/storage.js';

const S3_BUCKET = process.env.S3_BUCKET || 'videoai-media';

function extractS3Key(url) {
  if (!url || typeof url !== 'string') return null;
  const prefix = `https://${S3_BUCKET}.storage.yandexcloud.net/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  // Fallback: path-style URL
  const pathPrefix = `https://storage.yandexcloud.net/${S3_BUCKET}/`;
  if (url.startsWith(pathPrefix)) return url.slice(pathPrefix.length);
  return null;
}

const app = express();
app.set('trust proxy', 1); // За Nginx reverse proxy: корректный req.ip, req.protocol, secure-кука

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

// Multer for audio upload (отдельный — другой размер и типы)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ok = [
      'audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
      'audio/wav', 'audio/x-wav', 'audio/ogg',
    ].includes(file.mimetype);
    cb(ok ? null : new Error('unsupported_audio_type'), ok);
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
    credits_image: IMAGE_MODEL.credits,
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

// ── Build image prompt (GigaChat) ──
app.post('/api/build-image-prompt', requireAuth, async (req, res) => {
  try {
    const { productType, details, style } = req.body;
    if (!productType) return res.status(400).json({ error: 'missing_product_type' });

    const { buildImagePrompt } = await import('./server/providers/llm.js');
    const result = await buildImagePrompt({ productType, details, style });
    res.json(result);
  } catch (err) {
    console.error('build-image-prompt error:', err);
    if (err.code === 'AUTH_ERROR') return res.status(503).json({ error: 'llm_unavailable', message: err.message });
    res.status(500).json({ error: 'server_error' });
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

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    // 1. Check ownership
    const projResult = await pool.query(
      `SELECT * FROM projects WHERE id = $1`,
      [req.params.id],
    );
    if (projResult.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const project = projResult.rows[0];
    if (project.user_id !== req.userId) return res.status(403).json({ error: 'forbidden' });

    // 2. Block if active generation
    const activeJobs = await pool.query(
      `SELECT id FROM generation_jobs
       WHERE project_id = $1 AND status IN ('pending','running')
       LIMIT 1`,
      [project.id],
    );
    if (activeJobs.rows.length > 0) {
      return res.status(409).json({ error: 'active_generation', message: 'Дождитесь завершения генерации' });
    }

    // 3. Delete S3 files (best-effort)
    try {
      // Delete all files under projects/{id}/ prefix (videos, generated images)
      await deleteByPrefix(`projects/${project.id}/`);

      // Delete the source image from uploads (if exists)
      const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
      const sourceUrl = brief?.image_url;
      if (sourceUrl) {
        const key = extractS3Key(sourceUrl);
        if (key) await deleteByPrefix(key);
      }
    } catch (s3Err) {
      console.error(`Delete project ${project.id}: S3 cleanup failed (non-blocking):`, s3Err.message);
    }

    // 4. Delete from DB (FK CASCADE removes generation_jobs)
    await pool.query('DELETE FROM projects WHERE id = $1', [project.id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('delete project error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Audio overlay ──
// In-flight guard: prevents parallel mixes for the same project
const mixingProjects = new Set();

app.post('/api/projects/:id/audio', requireAuth, audioUpload.single('audio'), async (req, res) => {
  const projectId = Number(req.params.id);
  try {
    if (!req.file) return res.status(400).json({ error: 'no_audio_file' });

    // 1. Load project
    const projResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1', [projectId],
    );
    if (projResult.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const project = projResult.rows[0];

    // 2. Ownership check
    if (project.user_id !== req.userId) return res.status(403).json({ error: 'forbidden' });

    // 3. Get video URL
    const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
    const videoUrl = brief?.video_url || project.result_url;
    if (!videoUrl) return res.status(400).json({ error: 'no_video' });

    // 4. Parallel guard
    if (mixingProjects.has(projectId)) {
      return res.status(429).json({ error: 'mix_in_progress' });
    }
    mixingProjects.add(projectId);

    try {
      // 5. Upload source audio to S3
      const extMap = {
        'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/aac': 'aac',
        'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav',
        'audio/x-wav': 'wav', 'audio/ogg': 'ogg',
      };
      const audioExt = extMap[req.file.mimetype] || 'mp3';
      const audioSourceKey = `projects/${projectId}/audio-source.${audioExt}`;
      const audioSourceUrl = await uploadBuffer({
        buffer: req.file.buffer,
        key: audioSourceKey,
        contentType: req.file.mimetype,
      });

      // 6. FFmpeg mix
      const { mixAudioIntoVideo } = await import('./server/audio.js');
      const resultBuffer = await mixAudioIntoVideo({
        videoUrl,
        audioBuffer: req.file.buffer,
        audioExt,
      });

      // 7. Upload result to S3
      const resultKey = `projects/${projectId}/video-audio-${Date.now()}.mp4`;
      const audioVideoUrl = await uploadBuffer({
        buffer: resultBuffer,
        key: resultKey,
        contentType: 'video/mp4',
      });

      // 8. Update project brief (keep original video_url intact)
      const updatedBrief = { ...brief, audio_video_url: audioVideoUrl, audio_source_url: audioSourceUrl };
      await pool.query(
        'UPDATE projects SET brief = $1 WHERE id = $2',
        [JSON.stringify(updatedBrief), projectId],
      );

      console.log(`[Audio] Project ${projectId}: mixed audio, result ${audioVideoUrl}`);
      res.json({ ok: true, audio_video_url: audioVideoUrl });
    } finally {
      mixingProjects.delete(projectId);
    }
  } catch (err) {
    mixingProjects.delete(projectId);
    console.error('audio overlay error:', err);
    if (err.message?.includes('ffmpeg') || err.message?.includes('duration')) {
      return res.status(500).json({ error: 'mix_failed', message: err.message });
    }
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
      if (!input.motionPrompt) {
        const preset = MOTION_PRESETS.find(p => p.key === input.motionKey);
        input.motionPrompt = preset?.prompt || MOTION_PRESETS[0].prompt;
      }
      const model = VIDEO_MODELS[input.modelKey];
      if (!model) return res.status(400).json({ error: 'invalid_model' });

      if (input.modelKey === 'wan') {
        // Kling: duration 5 or 10, both native single generations
        const targetDuration = Number(input.targetDuration) || 5;
        if (![5, 10].includes(targetDuration)) {
          return res.status(400).json({ error: 'invalid_duration' });
        }

        const wanCredits = targetDuration * 8; // 5s=40, 10s=80
        const userRow = await pool.query('SELECT free_wan FROM users WHERE id = $1', [req.userId]);
        const hasFree = targetDuration === 5 && userRow.rows[0]?.free_wan > 0;

        const { jobId } = await createJob({
          userId: req.userId,
          projectId,
          type,
          input: { ...input, projectId, durationSec: String(targetDuration) },
          costCredits: hasFree ? 0 : wanCredits,
          freeColumn: hasFree ? 'free_wan' : null,
        });
        return res.json({ jobId });
      }

      // Veo: single job, fixed duration
      const freeCol = 'free_veo';
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

    if (type === 'image') {
      if (!input.prompt) {
        return res.status(400).json({ error: 'missing_image_prompt' });
      }

      // Check free image trial
      const imgUserRow = await pool.query('SELECT free_image FROM users WHERE id = $1', [req.userId]);
      const hasFreeImage = imgUserRow.rows[0]?.free_image > 0;

      const { jobId } = await createJob({
        userId: req.userId,
        projectId,
        type,
        input: { ...input, projectId },
        costCredits: hasFreeImage ? 0 : IMAGE_MODEL.credits,
        freeColumn: hasFreeImage ? 'free_image' : null,
      });
      return res.json({ jobId });
    }

    return res.status(400).json({ error: 'invalid_type' });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'INSUFFICIENT_CREDITS' });
    if (err.message === 'NO_FREE_TRY') return res.status(402).json({ error: 'INSUFFICIENT_CREDITS' });
    if (err.message === 'TOO_MANY_ACTIVE_JOBS') return res.status(429).json({ error: 'TOO_MANY_ACTIVE_JOBS' });
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
      SELECT u.id, u.email, u.credits, u.role, u.free_wan, u.free_veo, u.free_image, u.created_at,
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

// ── Payments ──

// POST /api/payments/create — returns Quickpay URL
app.post('/api/payments/create', requireAuth, async (req, res) => {
  try {
    const { packageId, paymentType } = req.body;
    if (!packageId) return res.status(400).json({ error: 'missing_package_id' });

    const { getPackageById } = await import('./src/data/tariffs.js');
    const pkg = getPackageById(packageId);
    if (!pkg) return res.status(400).json({ error: 'invalid_package' });

    const wallet = process.env.YOOMONEY_WALLET;
    if (!wallet) return res.status(503).json({ error: 'payments_not_configured' });

    const { randomUUID } = await import('crypto');
    const label = `${req.userId}:${pkg.id}:${randomUUID().slice(0, 8)}`;

    const { createPendingPayment, buildQuickpayUrl } = await import('./server/payments.js');
    await createPendingPayment({ userId: req.userId, pkg, label });

    const successUrl = `${process.env.APP_URL || 'https://ddvideoai.ru'}/billing?paid=1`;
    const url = buildQuickpayUrl({ wallet, pkg, label, successUrl, paymentType: paymentType || 'AC' });

    res.json({ url, label });
  } catch (err) {
    console.error('payments/create error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/payments/history — user's own payment history
app.get('/api/payments/history', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, package_id, label, expected_amount, paid_amount,
              credits_granted, status, created_at, completed_at
       FROM payments WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.userId],
    );
    res.json({ payments: result.rows });
  } catch (err) {
    console.error('payments/history error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/payments/yoomoney-webhook — YooMoney HTTP-notification
// Must use urlencoded parser (not JSON)
app.post(
  '/api/payments/yoomoney-webhook',
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      const secret = process.env.YOOMONEY_NOTIFICATION_SECRET;
      if (!secret) {
        console.error('[YooMoney] YOOMONEY_NOTIFICATION_SECRET not set');
        return res.sendStatus(200); // always 200 to ЮMoney
      }

      const { processYooMoneyWebhook } = await import('./server/payments.js');
      const result = await processYooMoneyWebhook({ params: req.body, secret });
      console.log(`[YooMoney] Webhook result: ${result.reason}`);
      res.sendStatus(200);
    } catch (err) {
      console.error('[YooMoney] Webhook handler error:', err);
      res.sendStatus(200); // always 200
    }
  },
);

// ── Admin: payments ──
app.get('/api/admin/payments', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, u.email AS user_email, p.package_id, p.expected_amount, p.paid_amount,
             p.credits_granted, p.status, p.operation_id, p.created_at, p.completed_at
      FROM payments p LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC LIMIT 100
    `);
    res.json({ payments: result.rows });
  } catch (err) {
    console.error('admin payments error:', err);
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
  startReconciler();
  app.listen(PORT, () => console.log(`VideoAI server on port ${PORT}`));
}

start();
