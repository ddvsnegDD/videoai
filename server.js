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
import { startAssemblyWorker, MAX_CLIPS, MAX_DURATION_SEC } from './server/assembly.js';

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

// ── Payments (YooKassa v3) ──

// POST /api/payments/create — creates YooKassa payment, returns confirmation URL
app.post('/api/payments/create', requireAuth, async (req, res) => {
  try {
    const { packageId } = req.body;
    if (!packageId) return res.status(400).json({ error: 'missing_package_id' });

    const { getPackageById } = await import('./src/data/tariffs.js');
    const pkg = getPackageById(packageId);
    if (!pkg) return res.status(400).json({ error: 'invalid_package' });

    const { createPayment } = await import('./server/payments.js');
    const { confirmationUrl, paymentDbId } = await createPayment({
      userId: req.userId,
      pkg,
    });

    res.json({ url: confirmationUrl, paymentId: paymentDbId });
  } catch (err) {
    if (err.message === 'payments_not_configured') {
      return res.status(503).json({ error: 'payments_not_configured' });
    }
    console.log('payments/create error:', err.message);
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

// POST /api/payments/yookassa/webhook — YooKassa JSON webhook
app.post('/api/payments/yookassa/webhook', async (req, res) => {
  try {
    const { processWebhook } = await import('./server/payments.js');
    const result = await processWebhook({ body: req.body });
    console.log(`[YooKassa] Webhook result: ${result.reason}`);
    res.sendStatus(200); // always 200 to YooKassa
  } catch (err) {
    console.log('[YooKassa] Webhook handler error:', err.message);
    res.sendStatus(200); // always 200
  }
});

// GET /api/payments/order/:id/status — frontend polls this after redirect
app.get('/api/payments/order/:id/status', requireAuth, async (req, res) => {
  try {
    const paymentId = Number(req.params.id);
    if (!paymentId) return res.status(400).json({ error: 'invalid_id' });

    const { getPaymentStatus } = await import('./server/payments.js');
    const payment = await getPaymentStatus(paymentId, req.userId);
    if (!payment) return res.status(404).json({ error: 'not_found' });

    res.json({ payment });
  } catch (err) {
    console.log('payments/order/status error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/payments/yoomoney-webhook — legacy YooMoney (kept for transition)
app.post(
  '/api/payments/yoomoney-webhook',
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      const secret = process.env.YOOMONEY_NOTIFICATION_SECRET;
      if (!secret) return res.sendStatus(200);
      const { processYooMoneyWebhook } = await import('./server/payments.js');
      const result = await processYooMoneyWebhook({ params: req.body, secret });
      console.log(`[YooMoney] Webhook result: ${result.reason}`);
      res.sendStatus(200);
    } catch (err) {
      console.log('[YooMoney] Webhook handler error:', err.message);
      res.sendStatus(200);
    }
  },
);

// ── Admin: payments ──
app.get('/api/admin/payments', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, u.email AS user_email, p.package_id, p.expected_amount, p.paid_amount,
             p.credits_granted, p.status, p.provider, p.yookassa_payment_id, p.operation_id,
             p.receipt_status, p.refunded, p.created_at, p.completed_at
      FROM payments p LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC LIMIT 100
    `);
    res.json({ payments: result.rows });
  } catch (err) {
    console.log('admin payments error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/admin/receipts — pending receipts for self-employed tracking
app.get('/api/admin/receipts', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.payment_id, r.user_email, r.amount, r.description,
             r.status, r.attempts, r.last_error, r.created_at, r.completed_at
      FROM pending_receipts r
      ORDER BY r.created_at DESC LIMIT 100
    `);
    res.json({ receipts: result.rows });
  } catch (err) {
    console.log('admin receipts error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// PATCH /api/admin/receipts/:id — mark receipt as done/failed
app.patch('/api/admin/receipts/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body; // 'completed' or 'failed'
    if (!['completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }
    const result = await pool.query(
      `UPDATE pending_receipts SET status = $1, completed_at = NOW()
       WHERE id = $2 RETURNING id`,
      [status, req.params.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });

    // Update payment receipt_status too
    const receipt = await pool.query('SELECT payment_id FROM pending_receipts WHERE id = $1', [req.params.id]);
    if (receipt.rows[0]?.payment_id) {
      await pool.query(
        'UPDATE payments SET receipt_status = $1 WHERE id = $2',
        [status === 'completed' ? 'sent' : 'failed', receipt.rows[0].payment_id],
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.log('admin receipts patch error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Clips (library) ──

app.get('/api/clips', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, brief, result_url, status, folder_id, created_at
       FROM projects
       WHERE user_id = $1 AND status = 'ready' AND (brief->>'video_url') IS NOT NULL
       ORDER BY created_at DESC`,
      [req.userId],
    );
    const clips = result.rows.map(r => {
      const b = typeof r.brief === 'string' ? JSON.parse(r.brief) : (r.brief || {});
      return {
        id: r.id,
        title: r.title,
        video_url: b.video_url || r.result_url,
        image_url: b.image_url || null,
        model: b.model || 'wan',
        folder_id: r.folder_id,
        created_at: r.created_at,
      };
    });
    res.json({ clips });
  } catch (err) {
    console.error('list clips error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/api/clips/:id', requireAuth, async (req, res) => {
  try {
    const clipId = Number(req.params.id);
    const { folder_id } = req.body;
    if (folder_id === undefined) return res.status(400).json({ error: 'missing_folder_id' });

    const clip = await pool.query(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [clipId, req.userId],
    );
    if (clip.rows.length === 0) return res.status(404).json({ error: 'not_found' });

    if (folder_id !== null) {
      const folder = await pool.query(
        `SELECT id FROM folders WHERE id = $1 AND user_id = $2`,
        [folder_id, req.userId],
      );
      if (folder.rows.length === 0) return res.status(404).json({ error: 'folder_not_found' });
    }

    await pool.query(`UPDATE projects SET folder_id = $1 WHERE id = $2`, [folder_id, clipId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('move clip error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Folders ──

app.get('/api/folders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.name, f.created_at,
              COUNT(p.id)::int AS clip_count
       FROM folders f
       LEFT JOIN projects p ON p.folder_id = f.id AND p.status = 'ready' AND (p.brief->>'video_url') IS NOT NULL
       WHERE f.user_id = $1
       GROUP BY f.id
       ORDER BY f.created_at DESC`,
      [req.userId],
    );
    res.json({ folders: result.rows });
  } catch (err) {
    console.error('list folders error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/folders', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'missing_name' });
    const result = await pool.query(
      `INSERT INTO folders (user_id, name) VALUES ($1, $2) RETURNING *`,
      [req.userId, name.trim().slice(0, 100)],
    );
    res.json({ folder: result.rows[0] });
  } catch (err) {
    console.error('create folder error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/api/folders/:id', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'missing_name' });
    const result = await pool.query(
      `UPDATE folders SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [name.trim().slice(0, 100), req.params.id, req.userId],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ folder: result.rows[0] });
  } catch (err) {
    console.error('rename folder error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.delete('/api/folders/:id', requireAuth, async (req, res) => {
  try {
    const folderId = Number(req.params.id);
    const check = await pool.query(
      `SELECT id FROM folders WHERE id = $1 AND user_id = $2`,
      [folderId, req.userId],
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'not_found' });

    await pool.query(`UPDATE projects SET folder_id = NULL WHERE folder_id = $1`, [folderId]);
    await pool.query(`DELETE FROM folders WHERE id = $1`, [folderId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete folder error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Assemblies ──

app.post('/api/assemblies', requireAuth, async (req, res) => {
  try {
    const { clip_ids, canvas, audio } = req.body;

    if (!clip_ids || !Array.isArray(clip_ids) || clip_ids.length === 0) {
      return res.status(400).json({ error: 'no_clips', message: 'Выберите хотя бы один клип' });
    }
    if (clip_ids.length > MAX_CLIPS) {
      return res.status(400).json({ error: 'too_many_clips', message: `Максимум ${MAX_CLIPS} клипов` });
    }
    if (!canvas || !['9x16', '1x1', '16x9'].includes(canvas)) {
      return res.status(400).json({ error: 'invalid_canvas', message: 'Выберите холст' });
    }

    // One active assembly per user
    const active = await pool.query(
      `SELECT id FROM assemblies WHERE user_id = $1 AND status IN ('queued', 'processing') LIMIT 1`,
      [req.userId],
    );
    if (active.rows.length > 0) {
      return res.status(409).json({ error: 'assembly_active', message: 'Дождитесь завершения текущей сборки' });
    }

    // Validate all clips belong to user and are ready
    const clipCheck = await pool.query(
      `SELECT id FROM projects
       WHERE id = ANY($1) AND user_id = $2 AND status = 'ready' AND (brief->>'video_url') IS NOT NULL`,
      [clip_ids, req.userId],
    );
    const validIds = new Set(clipCheck.rows.map(r => r.id));
    const invalid = clip_ids.filter(id => !validIds.has(id));
    if (invalid.length > 0) {
      return res.status(400).json({ error: 'invalid_clips', message: `Клипы недоступны: ${invalid.join(', ')}` });
    }

    // Handle audio upload (base64 in body for simplicity)
    let audioKey = null;
    if (audio?.data && audio?.filename) {
      const buf = Buffer.from(audio.data, 'base64');
      if (buf.length > 20 * 1024 * 1024) {
        return res.status(400).json({ error: 'audio_too_large', message: 'Аудио до 20 МБ' });
      }
      const ext = audio.filename.split('.').pop()?.toLowerCase() || 'mp3';
      if (!['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext)) {
        return res.status(400).json({ error: 'audio_format', message: 'Формат: mp3, wav, m4a' });
      }
      audioKey = `tmp/assembly-audio/${req.userId}-${Date.now()}.${ext}`;
      await uploadBuffer({ buffer: buf, key: audioKey, contentType: `audio/${ext}` });
    }

    const result = await pool.query(
      `INSERT INTO assemblies (user_id, status, canvas, clip_ids, audio_key)
       VALUES ($1, 'queued', $2, $3, $4) RETURNING id, status, created_at`,
      [req.userId, canvas, JSON.stringify(clip_ids), audioKey],
    );

    console.log(`[assembly] Created #${result.rows[0].id} for user ${req.userId} (${clip_ids.length} clips, canvas=${canvas})`);
    res.json({ assembly: result.rows[0] });
  } catch (err) {
    console.error('create assembly error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/assemblies/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, status, canvas, clip_ids, output_url, error, created_at, started_at, finished_at
       FROM assemblies WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ assembly: result.rows[0] });
  } catch (err) {
    console.error('get assembly error:', err);
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

  // Payment reconciler (checks stale pending payments via GET)
  const { startPaymentReconciler } = await import('./server/payments.js');
  if (process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY) {
    startPaymentReconciler();
  } else {
    console.log('[YooKassa] Payment reconciler skipped — credentials not configured');
  }

  startAssemblyWorker();

  app.listen(PORT, () => console.log(`VideoAI server on port ${PORT}`));
}

start();
