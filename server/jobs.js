import crypto from 'crypto';
import pool from './db.js';
import { submitToFal, pollFal, fetchAndUpload, POLL_TIMEOUT } from './providers/falVideo.js';

const WATCHDOG_TIMEOUT_MIN = 20;
const MAX_CONCURRENT_JOBS_PER_USER = 2;
const RECONCILER_INTERVAL = 90_000; // 1.5 min

// ── Seed generation ──

function generateSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

function makeIdempotencyKey({ imageUrl, motionPrompt, modelKey, seed }) {
  const raw = `${imageUrl}|${motionPrompt || ''}|${modelKey}|${seed}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 48);
}

// ── Create job ──

export async function createJob({ userId, projectId, type, input, costCredits, freeColumn = null }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Rate limit: max concurrent jobs per user
    const activeCount = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM generation_jobs
       WHERE user_id = $1 AND status IN ('pending','running')`,
      [userId],
    );
    if (activeCount.rows[0].cnt >= MAX_CONCURRENT_JOBS_PER_USER) {
      throw new Error('TOO_MANY_ACTIVE_JOBS');
    }

    // Generate seed
    const seed = generateSeed();

    // Build idempotency key
    const idempotencyKey = makeIdempotencyKey({
      imageUrl: input.imageUrl,
      motionPrompt: input.motionPrompt,
      modelKey: input.modelKey,
      seed,
    });

    // Dedup: check for existing active job for same user+project
    const existing = await client.query(
      `SELECT id FROM generation_jobs
       WHERE user_id = $1 AND project_id = $2 AND status IN ('pending','running')
       LIMIT 1`,
      [userId, projectId],
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return { jobId: existing.rows[0].id, deduplicated: true };
    }

    // Charge credits
    const userRow = await client.query(
      'SELECT credits, free_wan, free_veo FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (userRow.rows.length === 0) throw new Error('USER_NOT_FOUND');
    const user = userRow.rows[0];

    if (freeColumn) {
      if (user[freeColumn] < 1) throw new Error('NO_FREE_TRY');
      await client.query(`UPDATE users SET ${freeColumn} = ${freeColumn} - 1 WHERE id = $1`, [userId]);
      console.log(`[Credits] Job (${type}): used free ${freeColumn}. User ${userId}`);
    } else if (costCredits > 0) {
      if (user.credits < costCredits) throw new Error('INSUFFICIENT_CREDITS');
      await client.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [costCredits, userId]);
      console.log(`[Credits] Job (${type}): charged ${costCredits}. User ${userId}: ${user.credits} → ${user.credits - costCredits}`);
    }

    // Store _freeColumn in input for refund on failure
    const jobInput = { ...input, _freeColumn: freeColumn || undefined };

    const job = await client.query(
      `INSERT INTO generation_jobs (user_id, project_id, type, input, cost_credits, status, seed, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7) RETURNING id`,
      [userId, projectId, type, JSON.stringify(jobInput), freeColumn ? 0 : costCredits, seed, idempotencyKey],
    );

    await client.query('COMMIT');

    const jobId = job.rows[0].id;
    setImmediate(() => runJob(jobId));
    return { jobId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getJob(jobId, userId) {
  const result = await pool.query(
    `SELECT id, type, status, progress, output, error, seed, created_at, updated_at
     FROM generation_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId],
  );
  return result.rows[0] || null;
}

export async function listJobs({ userId, projectId }) {
  const params = [userId];
  let where = 'user_id = $1';
  if (projectId) {
    where += ' AND project_id = $2';
    params.push(projectId);
  }
  const result = await pool.query(
    `SELECT id, type, status, progress, output, error, seed, created_at, updated_at
     FROM generation_jobs WHERE ${where} ORDER BY created_at DESC LIMIT 50`,
    params,
  );
  return result.rows;
}

// ── Job runner ──

async function runJob(jobId) {
  try {
    await pool.query(
      `UPDATE generation_jobs SET status = 'running', updated_at = NOW() WHERE id = $1`,
      [jobId],
    );

    const jobRow = await pool.query(
      `SELECT type, input, cost_credits, user_id, project_id, seed FROM generation_jobs WHERE id = $1`,
      [jobId],
    );
    if (jobRow.rows.length === 0) return;

    const { type, input, cost_credits, user_id, project_id, seed } = jobRow.rows[0];
    let result;

    try {
      result = await executeType(type, input, jobId, seed, project_id);
    } catch (err) {
      if (err.retryable && err.code === 'RATE_LIMIT') {
        await new Promise(r => setTimeout(r, 30000));
        try {
          result = await executeType(type, input, jobId, seed, project_id);
        } catch (retryErr) {
          return await failJob(jobId, user_id, cost_credits, retryErr.message, true);
        }
      } else if (err.code === 'POLL_TIMEOUT') {
        // Our timeout — do NOT refund, do NOT re-submit. Reconciler will handle.
        console.warn(`Job ${jobId}: poll timeout, leaving for reconciler`);
        await pool.query(
          `UPDATE generation_jobs SET updated_at = NOW(), last_polled_at = NOW() WHERE id = $1`,
          [jobId],
        );
        return;
      } else {
        return await failJob(jobId, user_id, cost_credits, err.message, true);
      }
    }

    // Save video URL to project
    if (type === 'animate' && result.video_url) {
      try {
        const projRow = await pool.query('SELECT brief FROM projects WHERE id = $1', [project_id]);
        if (projRow.rows.length > 0) {
          const brief = typeof projRow.rows[0].brief === 'string'
            ? JSON.parse(projRow.rows[0].brief)
            : projRow.rows[0].brief;
          await pool.query(
            `UPDATE projects SET brief = $1, result_url = $2, status = 'ready' WHERE id = $3`,
            [JSON.stringify({ ...brief, video_url: result.video_url, seed }), result.video_url, project_id],
          );
        }
      } catch (e) {
        console.error(`Job ${jobId}: failed to update project:`, e.message);
      }
    }

    await pool.query(
      `UPDATE generation_jobs SET status = 'done', progress = 100, output = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(result), jobId],
    );
  } catch (err) {
    console.error(`Job ${jobId} unhandled error:`, err);
    try {
      const jobRow = await pool.query(
        `SELECT cost_credits, user_id FROM generation_jobs WHERE id = $1`,
        [jobId],
      );
      if (jobRow.rows.length > 0) {
        await failJob(jobId, jobRow.rows[0].user_id, jobRow.rows[0].cost_credits, err.message, true);
      }
    } catch (e) {
      console.error(`Job ${jobId} cleanup error:`, e);
    }
  }
}

async function executeType(type, input, jobId, seed, projectId) {
  if (type === 'animate') {
    return await runAnimate(input, jobId, seed, projectId);
  }
  throw Object.assign(new Error(`Type '${type}' not implemented`), { retryable: false });
}

async function runAnimate(input, jobId, seed, projectId) {
  const progress = async (pct) => {
    await pool.query('UPDATE generation_jobs SET progress = $1, updated_at = NOW() WHERE id = $2', [pct, jobId]);
  };

  await progress(10);

  // Step 1: Submit to fal
  const { request_id } = await submitToFal({
    imageUrl: input.imageUrl,
    modelKey: input.modelKey,
    motionPrompt: input.motionPrompt,
    seed,
  });

  // Step 2: Save fal_request_id IMMEDIATELY (before polling)
  await pool.query(
    `UPDATE generation_jobs SET fal_request_id = $1, last_polled_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [request_id, jobId],
  );

  await progress(15);

  // Step 3: Poll for completion
  const pollResult = await pollFal({
    modelKey: input.modelKey,
    requestId: request_id,
    onProgress: progress,
    timeoutMs: POLL_TIMEOUT,
  });

  await pool.query(
    `UPDATE generation_jobs SET last_polled_at = NOW() WHERE id = $1`,
    [jobId],
  );

  if (pollResult.status === 'POLL_TIMEOUT') {
    const err = new Error('Generation timeout — reconciler will retry');
    err.code = 'POLL_TIMEOUT';
    err.retryable = false;
    throw err;
  }

  if (pollResult.status === 'FAILED') {
    const err = new Error(pollResult.error || 'fal generation failed');
    err.code = 'FAL_FAILED';
    err.retryable = false;
    throw err;
  }

  // Step 4: Fetch result and re-upload to S3
  await progress(70);
  const result = await fetchAndUpload({
    modelKey: input.modelKey,
    requestId: request_id,
    projectId,
  });

  await progress(95);

  return { video_url: result.video_url, fal_seed: result.fal_seed };
}

// ── Fail job (idempotent refund) ──

async function failJob(jobId, userId, costCredits, errorMsg, shouldRefund = true) {
  const jobRow = await pool.query(
    'SELECT input, refunded, status FROM generation_jobs WHERE id = $1',
    [jobId],
  );
  if (!jobRow.rows.length) return;
  const jobData = jobRow.rows[0];

  // Already handled
  if (jobData.status === 'failed' || jobData.status === 'done') return;

  // Mark as failed
  await pool.query(
    `UPDATE generation_jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
    [errorMsg, jobId],
  );

  // Idempotent refund: only if not already refunded AND shouldRefund is true
  if (!shouldRefund || jobData.refunded) return;

  let freeColumn = null;
  const input = jobData.input;
  if (input?._freeColumn && ['free_wan', 'free_veo'].includes(input._freeColumn)) {
    freeColumn = input._freeColumn;
  }

  if (freeColumn) {
    await pool.query(`UPDATE users SET ${freeColumn} = ${freeColumn} + 1 WHERE id = $1`, [userId]);
    console.log(`[Credits] Job ${jobId} failed: restored ${freeColumn} to user ${userId}`);
  } else if (costCredits > 0) {
    await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [costCredits, userId]);
    console.log(`[Credits] Job ${jobId} failed: refunded ${costCredits} to user ${userId}`);
  }

  // Mark as refunded
  await pool.query('UPDATE generation_jobs SET refunded = TRUE WHERE id = $1', [jobId]);
}

// ── Watchdog (legacy — marks truly stale jobs) ──

export async function runWatchdog() {
  try {
    const stale = await pool.query(
      `SELECT id, user_id, cost_credits FROM generation_jobs
       WHERE status = 'running'
         AND fal_request_id IS NULL
         AND updated_at < NOW() - INTERVAL '${WATCHDOG_TIMEOUT_MIN} minutes'`,
    );
    for (const row of stale.rows) {
      await failJob(row.id, row.user_id, row.cost_credits, 'TIMEOUT (watchdog — no fal request)', true);
      console.warn(`Watchdog: job ${row.id} timed out (no fal_request_id)`);
    }
  } catch (err) {
    console.error('Watchdog error:', err);
  }
}

// ── Reconciler (picks up orphaned jobs with saved fal_request_id) ──

export async function runReconciler() {
  try {
    const orphans = await pool.query(
      `SELECT id, user_id, project_id, cost_credits, input, seed, fal_request_id
       FROM generation_jobs
       WHERE status IN ('pending','running')
         AND fal_request_id IS NOT NULL
         AND (last_polled_at IS NULL OR last_polled_at < NOW() - INTERVAL '90 seconds')
       LIMIT 5`,
    );

    for (const row of orphans.rows) {
      try {
        console.log(`[Reconciler] Checking job ${row.id}, fal_request_id=${row.fal_request_id}`);

        const modelKey = row.input?.modelKey;
        if (!modelKey) {
          await failJob(row.id, row.user_id, row.cost_credits, 'Reconciler: missing modelKey', true);
          continue;
        }

        // Update last_polled_at to prevent other reconciler runs from picking it up
        await pool.query(
          'UPDATE generation_jobs SET last_polled_at = NOW() WHERE id = $1',
          [row.id],
        );

        // Check status at fal
        const { fal } = await import('@fal-ai/client');
        const key = process.env.FAL_KEY;
        if (key) fal.config({ credentials: key });

        const { VIDEO_MODELS } = await import('./providers/falVideo.js');
        const model = VIDEO_MODELS[modelKey];
        if (!model) {
          await failJob(row.id, row.user_id, row.cost_credits, 'Reconciler: unknown model', true);
          continue;
        }

        const status = await fal.queue.status(model.id, { requestId: row.fal_request_id, logs: false });
        console.log(`[Reconciler] Job ${row.id}: fal status = ${status.status}`);

        if (status.status === 'COMPLETED') {
          // Fetch result and finalize
          try {
            const result = await fetchAndUpload({
              modelKey,
              requestId: row.fal_request_id,
              projectId: row.project_id,
            });

            // Update project
            try {
              const projRow = await pool.query('SELECT brief FROM projects WHERE id = $1', [row.project_id]);
              if (projRow.rows.length > 0) {
                const brief = typeof projRow.rows[0].brief === 'string'
                  ? JSON.parse(projRow.rows[0].brief)
                  : projRow.rows[0].brief;
                await pool.query(
                  `UPDATE projects SET brief = $1, result_url = $2, status = 'ready' WHERE id = $3`,
                  [JSON.stringify({ ...brief, video_url: result.video_url, seed: row.seed }), result.video_url, row.project_id],
                );
              }
            } catch (e) {
              console.error(`[Reconciler] Job ${row.id}: project update failed:`, e.message);
            }

            await pool.query(
              `UPDATE generation_jobs SET status = 'done', progress = 100, output = $1, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify({ video_url: result.video_url, fal_seed: result.fal_seed }), row.id],
            );
            console.log(`[Reconciler] Job ${row.id}: finalized (COMPLETED)`);
          } catch (uploadErr) {
            console.error(`[Reconciler] Job ${row.id}: S3 upload failed, will retry:`, uploadErr.message);
            // Don't fail the job — fal video URL is available for a while, retry next cycle
          }
        } else if (status.status === 'FAILED') {
          await failJob(row.id, row.user_id, row.cost_credits, `fal FAILED: ${status.error || 'unknown'}`, true);
          console.log(`[Reconciler] Job ${row.id}: failed at fal`);
        }
        // IN_QUEUE / IN_PROGRESS — just wait, last_polled_at is updated
      } catch (err) {
        const msg = err.message || String(err);
        console.error(`[Reconciler] Error processing job ${row.id}:`, msg);
        // 404 / "Not Found" = request_id doesn't exist at fal, not transient
        if (msg.includes('Not Found') || msg.includes('404')) {
          await failJob(row.id, row.user_id, row.cost_credits, `fal request not found: ${msg}`, true);
          console.log(`[Reconciler] Job ${row.id}: marked failed (request not found)`);
        }
      }
    }
  } catch (err) {
    console.error('[Reconciler] Error:', err);
  }
}

export function startReconciler() {
  setInterval(runReconciler, RECONCILER_INTERVAL);
  console.log(`[Reconciler] Started (interval: ${RECONCILER_INTERVAL / 1000}s)`);
}
