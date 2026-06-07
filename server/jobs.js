import crypto from 'crypto';
import pool from './db.js';
import { submitToFal, pollFal, fetchAndUpload, POLL_TIMEOUT } from './providers/falVideo.js';
import { submitImageToFal, pollFalImage, fetchImageAndUpload, POLL_TIMEOUT_IMAGE, IMAGE_MODEL } from './providers/falImage.js';

const WATCHDOG_TIMEOUT_MIN = 20;
const MAX_CONCURRENT_JOBS_PER_USER = 2;
const RECONCILER_INTERVAL = 90_000; // 1.5 min

// Long video: segment composition and pricing
const DURATION_SEGMENTS = { 5: [5], 10: [10], 15: [10, 5], 20: [10, 10] };
const CREDITS_PER_SEC = 8;

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

// ── Segment groups (long video) ──

export async function createSegmentGroup({ userId, projectId, targetDuration, input }) {
  const segments = DURATION_SEGMENTS[targetDuration];
  if (!segments) throw new Error('INVALID_DURATION');

  const totalCredits = segments.reduce((s, d) => s + d * CREDITS_PER_SEC, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check for existing active jobs for this project
    const activeJobs = await client.query(
      `SELECT id FROM generation_jobs
       WHERE user_id = $1 AND project_id = $2 AND status IN ('pending','running')
       LIMIT 1`,
      [userId, projectId],
    );
    if (activeJobs.rows.length > 0) throw new Error('TOO_MANY_ACTIVE_JOBS');

    // Check balance
    const userRow = await client.query(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (!userRow.rows.length) throw new Error('USER_NOT_FOUND');
    const user = userRow.rows[0];

    if (user.credits < totalCredits) throw new Error('INSUFFICIENT_CREDITS');
    await client.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [totalCredits, userId]);
    console.log(`[Credits] Group: charged ${totalCredits} for ${targetDuration}s. User ${userId}: ${user.credits} → ${user.credits - totalCredits}`);

    // Create group
    const groupId = crypto.randomUUID();
    await client.query(
      `INSERT INTO video_groups (id, project_id, user_id, target_duration, segments_count, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [groupId, projectId, userId, targetDuration, segments.length],
    );

    // Create segment jobs
    const jobIds = [];
    for (let i = 0; i < segments.length; i++) {
      const segDuration = segments[i];
      const segCredits = segDuration * CREDITS_PER_SEC;
      const seed = generateSeed();
      const idempotencyKey = makeIdempotencyKey('animate', input, seed);
      const jobInput = { ...input, durationSec: String(segDuration) };

      const job = await client.query(
        `INSERT INTO generation_jobs (user_id, project_id, type, input, cost_credits, status, seed, idempotency_key, group_id, segment_index, segment_duration)
         VALUES ($1, $2, 'animate', $3, $4, 'pending', $5, $6, $7, $8, $9) RETURNING id`,
        [userId, projectId, JSON.stringify(jobInput), segCredits, seed, idempotencyKey, groupId, i, String(segDuration)],
      );
      jobIds.push(job.rows[0].id);
    }

    await client.query('COMMIT');

    // Launch all segment jobs in parallel
    for (const jid of jobIds) {
      setImmediate(() => runJob(jid));
    }

    console.log(`[Group] Created group ${groupId}: ${segments.length} segments, ${totalCredits} credits`);
    return { groupId, jobIds };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getGroup(groupId, userId) {
  const groupRow = await pool.query(
    'SELECT * FROM video_groups WHERE id = $1 AND user_id = $2',
    [groupId, userId],
  );
  if (!groupRow.rows.length) return null;
  const group = groupRow.rows[0];

  const segRows = await pool.query(
    `SELECT id, status, progress, output, segment_index, segment_duration
     FROM generation_jobs WHERE group_id = $1 ORDER BY segment_index`,
    [groupId],
  );

  const avgProgress = segRows.rows.length > 0
    ? Math.round(segRows.rows.reduce((s, r) => s + (r.progress || 0), 0) / segRows.rows.length)
    : 0;

  let videoUrl = null;
  if (group.status === 'ready') {
    const projRow = await pool.query('SELECT result_url FROM projects WHERE id = $1', [group.project_id]);
    videoUrl = projRow.rows[0]?.result_url;
  }

  return {
    id: group.id,
    status: group.status,
    target_duration: group.target_duration,
    segments_count: group.segments_count,
    progress: avgProgress,
    video_url: videoUrl,
    segments: segRows.rows.map(s => ({
      id: s.id,
      status: s.status,
      progress: s.progress,
      segment_index: s.segment_index,
      segment_duration: s.segment_duration,
    })),
  };
}

async function tryFinalizeGroup(groupId) {
  const groupRow = await pool.query('SELECT * FROM video_groups WHERE id = $1', [groupId]);
  if (!groupRow.rows.length) return;
  const group = groupRow.rows[0];

  if (group.status === 'ready' || group.status === 'failed') return;

  const segRows = await pool.query(
    `SELECT id, status, output, cost_credits, user_id, segment_index, refunded
     FROM generation_jobs WHERE group_id = $1 ORDER BY segment_index`,
    [groupId],
  );
  const segments = segRows.rows;

  const failedSegments = segments.filter(s => s.status === 'failed');
  const doneSegments = segments.filter(s => s.status === 'done');
  const activeSegments = segments.filter(s => ['pending', 'running'].includes(s.status));

  // Any still active → wait
  if (activeSegments.length > 0) return;

  // Any failed (and none active) → group fails
  if (failedSegments.length > 0) {
    await failGroupInternal(groupId, group, segments);
    return;
  }

  // All done → finalize
  // Atomically lock to prevent double finalization
  const lockResult = await pool.query(
    `UPDATE video_groups SET status = 'finalizing' WHERE id = $1 AND status = 'pending' RETURNING id`,
    [groupId],
  );
  if (lockResult.rows.length === 0) return;

  try {
    // Get video URLs in segment order
    const videoUrls = segments
      .sort((a, b) => a.segment_index - b.segment_index)
      .map(s => {
        const output = typeof s.output === 'string' ? JSON.parse(s.output) : s.output;
        return output?.video_url;
      })
      .filter(Boolean);

    if (videoUrls.length !== segments.length) {
      throw new Error('Missing video URLs for some segments');
    }

    let finalUrl;
    if (videoUrls.length === 1) {
      // Single segment → no concat needed
      finalUrl = videoUrls[0];
    } else {
      // Concat via FFmpeg
      const { concatVideos } = await import('./concat.js');
      const resultBuffer = await concatVideos(videoUrls);

      // Upload to S3
      const { uploadBuffer } = await import('./storage.js');
      const key = `projects/${group.project_id}/long-${Date.now()}.mp4`;
      finalUrl = await uploadBuffer({ buffer: resultBuffer, key, contentType: 'video/mp4' });
      console.log(`[Group] ${groupId}: concat uploaded to ${finalUrl}`);
    }

    // Update project
    const projRow = await pool.query('SELECT brief FROM projects WHERE id = $1', [group.project_id]);
    if (projRow.rows.length > 0) {
      const brief = typeof projRow.rows[0].brief === 'string'
        ? JSON.parse(projRow.rows[0].brief) : projRow.rows[0].brief;
      await pool.query(
        `UPDATE projects SET brief = $1, result_url = $2, status = 'ready' WHERE id = $3`,
        [JSON.stringify({ ...brief, video_url: finalUrl, target_duration: group.target_duration }), finalUrl, group.project_id],
      );
    }

    await pool.query(`UPDATE video_groups SET status = 'ready' WHERE id = $1`, [groupId]);
    console.log(`[Group] ${groupId}: finalized OK, ${videoUrls.length} segments → ${finalUrl}`);
  } catch (err) {
    console.error(`[Group] ${groupId}: finalization error:`, err);
    // Finalization failed (concat error) → fail the group, refund everything
    await pool.query(`UPDATE video_groups SET status = 'failed' WHERE id = $1`, [groupId]);
    await failGroupInternal(groupId, group, segments);
  }
}

async function failGroupInternal(groupId, group, segments) {
  await pool.query(
    `UPDATE video_groups SET status = 'failed' WHERE id = $1 AND status != 'failed'`,
    [groupId],
  );

  // Refund all done segments that haven't been refunded
  for (const seg of segments) {
    if (seg.status === 'done' && !seg.refunded && seg.cost_credits > 0) {
      await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [seg.cost_credits, seg.user_id]);
      await pool.query('UPDATE generation_jobs SET refunded = TRUE WHERE id = $1', [seg.id]);
      console.log(`[Group] ${groupId}: refunded ${seg.cost_credits} for done segment ${seg.id}`);
    }
  }

  // Update project status
  await pool.query(
    `UPDATE projects SET status = 'error' WHERE id = $1 AND status != 'ready'`,
    [group.project_id],
  );
  console.log(`[Group] ${groupId}: marked as failed, refunds processed`);
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

    // Mark job as done
    await pool.query(
      `UPDATE generation_jobs SET status = 'done', progress = 100, output = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(result), jobId],
    );

    // Check if this is a group segment
    const jobMeta = await pool.query('SELECT group_id FROM generation_jobs WHERE id = $1', [jobId]);
    const groupId = jobMeta.rows[0]?.group_id;

    if (groupId) {
      // Group segment: don't update project, trigger group finalizer
      console.log(`[Group] Segment ${jobId} done (group ${groupId})`);
      setImmediate(() => tryFinalizeGroup(groupId));
    } else if (result.video_url || result.image_url) {
      // Normal (non-group) job: update project
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
  if (type === 'image') {
    return await runImage(input, jobId, seed, projectId);
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

async function runImage(input, jobId, seed, projectId) {
  const progress = async (pct) => {
    await pool.query('UPDATE generation_jobs SET progress = $1, updated_at = NOW() WHERE id = $2', [pct, jobId]);
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

  // If group segment failed, trigger group check
  const groupCheck = await pool.query('SELECT group_id FROM generation_jobs WHERE id = $1', [jobId]);
  if (groupCheck.rows[0]?.group_id) {
    setImmediate(() => tryFinalizeGroup(groupCheck.rows[0].group_id));
  }
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
      `SELECT id, type, user_id, project_id, cost_credits, input, seed, fal_request_id, group_id
       FROM generation_jobs
       WHERE status IN ('pending','running')
         AND fal_request_id IS NOT NULL
         AND (last_polled_at IS NULL OR last_polled_at < NOW() - INTERVAL '90 seconds')
       LIMIT 5`,
    );

    for (const row of orphans.rows) {
      try {
        console.log(`[Reconciler] Checking job ${row.id} (type=${row.type}), fal_request_id=${row.fal_request_id}`);

        await pool.query(
          'UPDATE generation_jobs SET last_polled_at = NOW() WHERE id = $1',
          [row.id],
        );

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

              // Only update project for non-group jobs
              if (!row.group_id) {
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
            }

            await pool.query(
              `UPDATE generation_jobs SET status = 'done', progress = 100, output = $1, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify(output), row.id],
            );
            console.log(`[Reconciler] Job ${row.id}: finalized (COMPLETED)`);

            // Trigger group finalization if needed
            if (row.group_id) {
              console.log(`[Reconciler] Segment ${row.id} done (group ${row.group_id}), triggering finalizer`);
              setImmediate(() => tryFinalizeGroup(row.group_id));
            }
          } catch (uploadErr) {
            console.error(`[Reconciler] Job ${row.id}: S3 upload failed, will retry:`, uploadErr.message);
          }
        } else if (status.status === 'FAILED') {
          await failJob(row.id, row.user_id, row.cost_credits, `fal FAILED: ${status.error || 'unknown'}`, true);
          console.log(`[Reconciler] Job ${row.id}: failed at fal`);
        }
      } catch (err) {
        const msg = err.message || String(err);
        console.error(`[Reconciler] Error processing job ${row.id}:`, msg);
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
