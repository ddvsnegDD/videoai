import crypto from 'crypto';
import pool from './db.js';
import { submitToFal, pollFal, fetchFalResult, reuploadToS3, fetchAndUpload, POLL_TIMEOUT } from './providers/falVideo.js';
import { submitImageToFal, pollFalImage, fetchImageAndUpload, POLL_TIMEOUT_IMAGE, IMAGE_MODEL } from './providers/falImage.js';

const WATCHDOG_TIMEOUT_MIN = 20;
const MAX_CONCURRENT_JOBS_PER_USER = 2;
const RECONCILER_INTERVAL = 90_000; // 1.5 min

// ── Seed generation ──

function generateSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

function makeIdempotencyKey(type, input, seed) {
  let raw;
  if (type === 'image') {
    raw = `image|${input.prompt || ''}|${seed}`;
  } else {
    raw = `${input.imageUrl || ''}|${input.motionPrompt || ''}|${input.modelKey || ''}|${seed}`;
  }
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
    const idempotencyKey = makeIdempotencyKey(type, input, seed);

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
      'SELECT credits, free_wan, free_veo, free_image FROM users WHERE id = $1 FOR UPDATE',
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
      console.log(`[runJob] Job ${jobId} executeType error:`, err.code || '', err.message);
      if (err.retryable && err.code === 'RATE_LIMIT') {
        await new Promise(r => setTimeout(r, 30000));
        try {
          result = await executeType(type, input, jobId, seed, project_id);
        } catch (retryErr) {
          console.log(`[runJob] Job ${jobId} retry failed:`, retryErr.code || '', retryErr.message);
          return await failJob(jobId, user_id, cost_credits, retryErr.message, true);
        }
      } else if (err.code === 'POLL_TIMEOUT' || err.code === 'POST_COMPLETED_FAIL') {
        // POLL_TIMEOUT: fal still processing, reconciler will pick up.
        // POST_COMPLETED_FAIL: fal COMPLETED but we can't fetch result — NO REFUND.
        //   Reconciler will finalize (it has fal_request_id).
        console.warn(`[runJob] Job ${jobId}: ${err.code}, leaving for reconciler (NO REFUND)`);
        await pool.query(
          `UPDATE generation_jobs SET updated_at = NOW(), last_polled_at = NOW() WHERE id = $1`,
          [jobId],
        );
        return;
      } else {
        return await failJob(jobId, user_id, cost_credits, err.message, true);
      }
    }

    // Save result URL to project
    if (result.video_url || result.image_url) {
      try {
        const projRow = await pool.query('SELECT brief FROM projects WHERE id = $1', [project_id]);
        if (projRow.rows.length > 0) {
          const brief = typeof projRow.rows[0].brief === 'string'
            ? JSON.parse(projRow.rows[0].brief)
            : projRow.rows[0].brief;

          if (type === 'animate' && result.video_url) {
            await pool.query(
              `UPDATE projects SET brief = $1, result_url = $2, status = 'ready' WHERE id = $3`,
              [JSON.stringify({ ...brief, video_url: result.video_url, seed }), result.video_url, project_id],
            );
          } else if (type === 'image' && result.image_url) {
            await pool.query(
              `UPDATE projects SET brief = $1 WHERE id = $2`,
              [JSON.stringify({ ...brief, image_url: result.image_url, seed }), project_id],
            );
          }
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
    console.log(`[runJob] Job ${jobId} unhandled error:`, err.stack || err);
    try {
      // If we already have a successful result, do NOT refund — persist best-effort
      if (result?.video_url || result?.image_url) {
        console.log(`[runJob] Job ${jobId}: result exists (${result.video_url ? 'video' : 'image'}), saving without refund`);
        await pool.query(
          `UPDATE generation_jobs SET status = 'done', progress = 100, output = $1, updated_at = NOW()
           WHERE id = $2 AND status != 'done'`,
          [JSON.stringify(result), jobId],
        ).catch(e => console.log(`[runJob] Job ${jobId}: best-effort done-mark failed:`, e.message));
        return;
      }
      const jobRow = await pool.query(
        `SELECT cost_credits, user_id FROM generation_jobs WHERE id = $1`,
        [jobId],
      );
      if (jobRow.rows.length > 0) {
        await failJob(jobId, jobRow.rows[0].user_id, jobRow.rows[0].cost_credits, err.message, true);
      }
    } catch (e) {
      console.log(`[runJob] Job ${jobId} cleanup error:`, e.stack || e);
    }
  }
}

async function executeType(type, input, jobId, seed, projectId) {
  if (type === 'animate') {
    return await runAnimate(input, jobId, seed, projectId);
  }
  if (type === 'image') {
    return await runImage(input, jobId, seed, projectId);
  }
  throw Object.assign(new Error(`Type '${type}' not implemented`), { retryable: false });
}

async function runAnimate(input, jobId, seed, projectId) {
  // Progress + heartbeat: updates both progress AND last_polled_at
  // so reconciler never picks up a job that's actively being processed
  const progress = async (pct) => {
    await pool.query(
      'UPDATE generation_jobs SET progress = $1, last_polled_at = NOW(), updated_at = NOW() WHERE id = $2',
      [pct, jobId],
    );
  };

  await progress(10);

  // Step 1: Submit to fal
  const { request_id } = await submitToFal({
    imageUrl: input.imageUrl,
    modelKey: input.modelKey,
    motionPrompt: input.motionPrompt,
    seed,
    durationSec: input.durationSec,
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
    onProgress: progress, // heartbeat every 5s → reconciler won't touch us
    timeoutMs: POLL_TIMEOUT,
  });

  await progress(66); // refresh heartbeat after poll completes

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

  // ── POINT OF NO REFUND: fal COMPLETED ──
  // From here on, the clip exists at fal. We MUST NOT failJob/refund.
  // runJob MUST finalize. Only if process literally dies will reconciler step in.

  await progress(70);

  // Step 4: Fetch fal result URL (retry once on network failure)
  let falResult;
  try {
    falResult = await fetchFalResult({ modelKey: input.modelKey, requestId: request_id });
  } catch (fetchErr1) {
    console.warn(`[runAnimate] Job ${jobId}: fetchFalResult attempt 1 failed: ${fetchErr1.message}, retrying in 5s…`);
    await new Promise(r => setTimeout(r, 5000));
    await progress(72); // heartbeat
    try {
      falResult = await fetchFalResult({ modelKey: input.modelKey, requestId: request_id });
    } catch (fetchErr2) {
      // Both attempts failed. Do NOT throw (would trigger failJob+refund).
      // Signal runJob to leave job running for reconciler.
      console.log(`[runAnimate] Job ${jobId}: fetchFalResult failed twice after COMPLETED: ${fetchErr2.message}`);
      const err = new Error(`Post-COMPLETED fetch failed: ${fetchErr2.message}`);
      err.code = 'POST_COMPLETED_FAIL';
      throw err;
    }
  }

  console.log(`[runAnimate] Job ${jobId}: fal result secured, url=${falResult.video_url.slice(0, 80)}…`);

  // Step 5: Build output with fal URL (anti-leak baseline)
  const output = { video_url: falResult.video_url, fal_seed: falResult.fal_seed };

  // Step 6: Best-effort S3 re-upload (never throws)
  await progress(85);
  const s3 = await reuploadToS3({ falUrl: falResult.video_url, projectId });
  if (s3?.s3_url) {
    output.video_url = s3.s3_url;
    console.log(`[runAnimate] Job ${jobId}: S3 re-upload OK`);
  } else {
    console.warn(`[runAnimate] Job ${jobId}: S3 re-upload failed, keeping fal URL`);
    output.s3_fallback = true;
  }

  await progress(95);
  return output;
}

async function runImage(input, jobId, seed, projectId) {
  const progress = async (pct) => {
    await pool.query(
      'UPDATE generation_jobs SET progress = $1, last_polled_at = NOW(), updated_at = NOW() WHERE id = $2',
      [pct, jobId],
    );
  };

  await progress(10);

  const { request_id } = await submitImageToFal({
    prompt: input.prompt,
    seed,
    aspectRatio: input.aspectRatio,
  });

  await pool.query(
    `UPDATE generation_jobs SET fal_request_id = $1, last_polled_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [request_id, jobId],
  );

  await progress(15);

  const pollResult = await pollFalImage({
    requestId: request_id,
    onProgress: progress,
    timeoutMs: POLL_TIMEOUT_IMAGE,
  });

  await pool.query(
    `UPDATE generation_jobs SET last_polled_at = NOW() WHERE id = $1`,
    [jobId],
  );

  if (pollResult.status === 'POLL_TIMEOUT') {
    const err = new Error('Image generation timeout — reconciler will retry');
    err.code = 'POLL_TIMEOUT';
    err.retryable = false;
    throw err;
  }

  if (pollResult.status === 'FAILED') {
    const err = new Error(pollResult.error || 'fal image generation failed');
    err.code = 'FAL_FAILED';
    err.retryable = false;
    throw err;
  }

  await progress(75);

  const jobRow = await pool.query('SELECT user_id FROM generation_jobs WHERE id = $1', [jobId]);
  const userId = jobRow.rows[0]?.user_id;

  const result = await fetchImageAndUpload({
    requestId: request_id,
    userId,
  });

  await progress(95);

  return { image_url: result.image_url, fal_seed: result.fal_seed };
}

// ── Fail job (idempotent refund) ──

async function failJob(jobId, userId, costCredits, errorMsg, shouldRefund = true) {
  console.log(`[failJob] Job ${jobId}: "${errorMsg}" (refund=${shouldRefund}, credits=${costCredits})`);

  const jobRow = await pool.query(
    'SELECT input, refunded, status FROM generation_jobs WHERE id = $1',
    [jobId],
  );
  if (!jobRow.rows.length) return;
  const jobData = jobRow.rows[0];

  // Already handled
  if (jobData.status === 'failed' || jobData.status === 'done') {
    console.log(`[failJob] Job ${jobId}: already ${jobData.status}, skipping`);
    return;
  }

  // Mark as failed
  await pool.query(
    `UPDATE generation_jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
    [errorMsg, jobId],
  );

  // Idempotent refund: only if not already refunded AND shouldRefund is true
  if (!shouldRefund || jobData.refunded) return;

  let freeColumn = null;
  const input = jobData.input;
  if (input?._freeColumn && ['free_wan', 'free_veo', 'free_image'].includes(input._freeColumn)) {
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
// Only grabs jobs whose heartbeat (last_polled_at) is stale by 3+ minutes.
// Active runJob refreshes last_polled_at every ~5s via progress(), so it's never stale.

export async function runReconciler() {
  try {
    const orphans = await pool.query(
      `SELECT id, type, user_id, project_id, cost_credits, input, seed, fal_request_id
       FROM generation_jobs
       WHERE status IN ('pending','running')
         AND fal_request_id IS NOT NULL
         AND (last_polled_at IS NULL OR last_polled_at < NOW() - INTERVAL '3 minutes')
       LIMIT 5`,
    );

    for (const row of orphans.rows) {
      try {
        // Atomic claim: only proceed if last_polled_at is STILL stale (prevents race with runJob)
        const claim = await pool.query(
          `UPDATE generation_jobs SET last_polled_at = NOW()
           WHERE id = $1 AND (last_polled_at IS NULL OR last_polled_at < NOW() - INTERVAL '3 minutes')
           RETURNING id`,
          [row.id],
        );
        if (claim.rows.length === 0) {
          // runJob refreshed heartbeat in the meantime — skip this job
          console.log(`[Reconciler] Job ${row.id}: heartbeat fresh, skipping (runJob is alive)`);
          continue;
        }

        console.log(`[Reconciler] Claimed job ${row.id} (type=${row.type}), fal_request_id=${row.fal_request_id}`);

        const { fal } = await import('@fal-ai/client');
        const key = process.env.FAL_KEY;
        if (key) fal.config({ credentials: key });

        // Resolve fal endpoint based on job type
        let falEndpoint;
        if (row.type === 'image') {
          const { IMAGE_MODEL } = await import('./providers/falImage.js');
          falEndpoint = IMAGE_MODEL.id;
        } else {
          const modelKey = row.input?.modelKey;
          if (!modelKey) {
            await failJob(row.id, row.user_id, row.cost_credits, 'Reconciler: missing modelKey', true);
            continue;
          }
          const { VIDEO_MODELS } = await import('./providers/falVideo.js');
          const model = VIDEO_MODELS[modelKey];
          if (!model) {
            await failJob(row.id, row.user_id, row.cost_credits, 'Reconciler: unknown model', true);
            continue;
          }
          falEndpoint = model.id;
        }

        const status = await fal.queue.status(falEndpoint, { requestId: row.fal_request_id, logs: false });
        console.log(`[Reconciler] Job ${row.id}: fal status = ${status.status}`);

        if (status.status === 'COMPLETED') {
          // Double-check: if runJob already finalized, skip
          const fresh = await pool.query('SELECT status FROM generation_jobs WHERE id = $1', [row.id]);
          if (fresh.rows[0]?.status === 'done' || fresh.rows[0]?.status === 'failed') {
            console.log(`[Reconciler] Job ${row.id}: already ${fresh.rows[0].status}, skipping finalization`);
            continue;
          }

          try {
            let output;

            if (row.type === 'image') {
              const { fetchImageAndUpload } = await import('./providers/falImage.js');
              const result = await fetchImageAndUpload({ requestId: row.fal_request_id, userId: row.user_id });
              output = { image_url: result.image_url, fal_seed: result.fal_seed };

              try {
                const projRow = await pool.query('SELECT brief FROM projects WHERE id = $1', [row.project_id]);
                if (projRow.rows.length > 0) {
                  const brief = typeof projRow.rows[0].brief === 'string'
                    ? JSON.parse(projRow.rows[0].brief) : projRow.rows[0].brief;
                  await pool.query(
                    `UPDATE projects SET brief = $1 WHERE id = $2`,
                    [JSON.stringify({ ...brief, image_url: result.image_url, seed: row.seed }), row.project_id],
                  );
                }
              } catch (e) {
                console.error(`[Reconciler] Job ${row.id}: project update failed:`, e.message);
              }
            } else {
              const result = await fetchAndUpload({
                modelKey: row.input?.modelKey,
                requestId: row.fal_request_id,
                projectId: row.project_id,
              });
              output = { video_url: result.video_url, fal_seed: result.fal_seed };

              try {
                const projRow = await pool.query('SELECT brief FROM projects WHERE id = $1', [row.project_id]);
                if (projRow.rows.length > 0) {
                  const brief = typeof projRow.rows[0].brief === 'string'
                    ? JSON.parse(projRow.rows[0].brief) : projRow.rows[0].brief;
                  await pool.query(
                    `UPDATE projects SET brief = $1, result_url = $2, status = 'ready' WHERE id = $3`,
                    [JSON.stringify({ ...brief, video_url: result.video_url, seed: row.seed }), result.video_url, row.project_id],
                  );
                }
              } catch (e) {
                console.error(`[Reconciler] Job ${row.id}: project update failed:`, e.message);
              }
            }

            // Conditional update: only set done if still running (runJob might have finished)
            const upd = await pool.query(
              `UPDATE generation_jobs SET status = 'done', progress = 100, output = $1, updated_at = NOW()
               WHERE id = $2 AND status IN ('pending','running') RETURNING id`,
              [JSON.stringify(output), row.id],
            );
            if (upd.rows.length > 0) {
              console.log(`[Reconciler] Job ${row.id}: finalized (COMPLETED)`);
            } else {
              console.log(`[Reconciler] Job ${row.id}: already finalized by runJob, skipping`);
            }
          } catch (uploadErr) {
            console.error(`[Reconciler] Job ${row.id}: fetch/upload failed, will retry next cycle:`, uploadErr.message);
          }
        } else if (status.status === 'FAILED') {
          await failJob(row.id, row.user_id, row.cost_credits, `fal FAILED: ${status.error || 'unknown'}`, true);
          console.log(`[Reconciler] Job ${row.id}: failed at fal`);
        }
        // IN_QUEUE / IN_PROGRESS — leave alone, will check next cycle
      } catch (err) {
        const msg = err.message || String(err);
        console.error(`[Reconciler] Error processing job ${row.id}:`, msg);
        // Do NOT failJob on transient errors (404 might be temporary fal API glitch).
        // Only failJob if the error persists — reconciler will retry next cycle.
        // If it keeps failing, watchdog will eventually catch truly stale jobs.
        if (msg.includes('Not Found') || msg.includes('404')) {
          // Check if job is old enough (>10 min) before declaring dead — protects against transient 404
          const ageCheck = await pool.query(
            `SELECT id FROM generation_jobs WHERE id = $1 AND created_at < NOW() - INTERVAL '10 minutes'`,
            [row.id],
          );
          if (ageCheck.rows.length > 0) {
            await failJob(row.id, row.user_id, row.cost_credits, `fal request not found: ${msg}`, true);
            console.log(`[Reconciler] Job ${row.id}: marked failed (request not found, job >10min old)`);
          } else {
            console.warn(`[Reconciler] Job ${row.id}: got 404 but job is fresh (<10min), will retry`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Reconciler] Error:', err);
  }

  // ── S3 fallback re-upload (rescues done jobs stuck on temp fal URLs) ──
  try {
    await reconcileS3Fallbacks();
  } catch (err) {
    console.error('[Reconciler reupload] Error:', err);
  }
}

// ── S3 fallback cycle ──
// Picks up done jobs where reuploadToS3 failed during runAnimate (s3_fallback=true).
// Retries up to 5 times within 24 hours, then gives up (fal URL will expire).

async function reconcileS3Fallbacks() {
  const stranded = await pool.query(
    `SELECT id, project_id, output
     FROM generation_jobs
     WHERE status = 'done'
       AND output->>'s3_fallback' = 'true'
       AND COALESCE((output->>'reupload_attempts')::int, 0) < 5
       AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 5`,
  );

  for (const row of stranded.rows) {
    const output = typeof row.output === 'string' ? JSON.parse(row.output) : row.output;
    const attempts = (output.reupload_attempts || 0) + 1;

    try {
      const s3 = await reuploadToS3({ falUrl: output.video_url, projectId: row.project_id });

      if (s3) {
        // Success — replace fal URL with S3, drop fallback markers
        const newOutput = { ...output, video_url: s3.s3_url };
        delete newOutput.s3_fallback;
        delete newOutput.reupload_attempts;
        await pool.query(
          `UPDATE generation_jobs SET output = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(newOutput), row.id],
        );

        // Propagate to project so assembly/player use the durable S3 URL
        try {
          const projRow = await pool.query('SELECT brief FROM projects WHERE id = $1', [row.project_id]);
          if (projRow.rows.length > 0) {
            const brief = typeof projRow.rows[0].brief === 'string'
              ? JSON.parse(projRow.rows[0].brief) : (projRow.rows[0].brief || {});
            await pool.query(
              `UPDATE projects SET brief = $1, result_url = $2 WHERE id = $3`,
              [JSON.stringify({ ...brief, video_url: s3.s3_url }), s3.s3_url, row.project_id],
            );
          }
        } catch (e) {
          console.error(`[Reconciler reupload] job ${row.id}: project update failed:`, e.message);
        }

        console.log(`[Reconciler reupload] job ${row.id}: rescued → S3`);
      } else {
        // reuploadToS3 returned null (all inner retries exhausted) — bump counter
        const newOutput = { ...output, reupload_attempts: attempts };
        await pool.query(
          `UPDATE generation_jobs SET output = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(newOutput), row.id],
        );
        console.warn(`[Reconciler reupload] job ${row.id}: attempt ${attempts}/5 failed`);
      }
    } catch (err) {
      console.error(`[Reconciler reupload] job ${row.id}: unexpected error:`, err.message);
    }
  }
}

export function startReconciler() {
  setInterval(runReconciler, RECONCILER_INTERVAL);
  console.log(`[Reconciler] Started (interval: ${RECONCILER_INTERVAL / 1000}s)`);
}
