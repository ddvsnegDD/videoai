import pool from './db.js';
import { animateImage } from './providers/falVideo.js';

const WATCHDOG_TIMEOUT_MIN = 10;

export async function createJob({ userId, projectId, type, input, costCredits, freeColumn = null }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRow = await client.query(
      'SELECT credits, free_wan, free_veo FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (userRow.rows.length === 0) throw new Error('USER_NOT_FOUND');
    const user = userRow.rows[0];

    if (freeColumn) {
      // Use free try
      if (user[freeColumn] < 1) throw new Error('NO_FREE_TRY');
      await client.query(`UPDATE users SET ${freeColumn} = ${freeColumn} - 1 WHERE id = $1`, [userId]);
      console.log(`[Credits] Job (${type}): used free ${freeColumn}. User ${userId}`);
    } else if (costCredits > 0) {
      if (user.credits < costCredits) throw new Error('INSUFFICIENT_CREDITS');
      await client.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [costCredits, userId]);
      console.log(`[Credits] Job (${type}): charged ${costCredits}. User ${userId}: ${user.credits} → ${user.credits - costCredits}`);
    }

    // Store _freeColumn in input for refund on failure
    const jobInput = freeColumn ? { ...input, _freeColumn: freeColumn } : input;

    const job = await client.query(
      `INSERT INTO generation_jobs (user_id, project_id, type, input, cost_credits, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
      [userId, projectId, type, JSON.stringify(jobInput), freeColumn ? 0 : costCredits],
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
    `SELECT id, type, status, progress, output, error, created_at, updated_at
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
    `SELECT id, type, status, progress, output, error, created_at, updated_at
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
      `SELECT type, input, cost_credits, user_id, project_id FROM generation_jobs WHERE id = $1`,
      [jobId],
    );
    if (jobRow.rows.length === 0) return;

    const { type, input, cost_credits, user_id, project_id } = jobRow.rows[0];
    let result;

    try {
      result = await executeType(type, input, jobId);
    } catch (err) {
      if (err.retryable) {
        const delay = err.code === 'RATE_LIMIT' ? 30000 : 5000;
        await new Promise(r => setTimeout(r, delay));
        try {
          result = await executeType(type, input, jobId);
        } catch (retryErr) {
          return await failJob(jobId, user_id, cost_credits, retryErr.message);
        }
      } else {
        return await failJob(jobId, user_id, cost_credits, err.message);
      }
    }

    // Save video URL to project
    if (type === 'animate' && result.data?.video_url) {
      try {
        const projRow = await pool.query('SELECT brief FROM projects WHERE id = $1', [project_id]);
        if (projRow.rows.length > 0) {
          const brief = typeof projRow.rows[0].brief === 'string'
            ? JSON.parse(projRow.rows[0].brief)
            : projRow.rows[0].brief;
          await pool.query(
            `UPDATE projects SET brief = $1, result_url = $2, status = 'ready' WHERE id = $3`,
            [JSON.stringify({ ...brief, video_url: result.data.video_url }), result.data.video_url, project_id],
          );
        }
      } catch (e) {
        console.error(`Job ${jobId}: failed to update project:`, e.message);
      }
    }

    await pool.query(
      `UPDATE generation_jobs SET status = 'done', progress = 100, output = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(result.data || result), jobId],
    );
  } catch (err) {
    console.error(`Job ${jobId} unhandled error:`, err);
    try {
      const jobRow = await pool.query(
        `SELECT cost_credits, user_id FROM generation_jobs WHERE id = $1`,
        [jobId],
      );
      if (jobRow.rows.length > 0) {
        await failJob(jobId, jobRow.rows[0].user_id, jobRow.rows[0].cost_credits, err.message);
      }
    } catch (e) {
      console.error(`Job ${jobId} cleanup error:`, e);
    }
  }
}

async function executeType(type, input, jobId) {
  if (type === 'animate') {
    return await runAnimate(input, jobId);
  }
  throw Object.assign(new Error(`Type '${type}' not implemented`), { retryable: false });
}

async function runAnimate(input, jobId) {
  const progress = async (pct) => {
    await pool.query('UPDATE generation_jobs SET progress = $1, updated_at = NOW() WHERE id = $2', [pct, jobId]);
  };

  await progress(10);

  const result = await animateImage({
    imageUrl: input.imageUrl,
    modelKey: input.modelKey,
    motionPrompt: input.motionPrompt,
    projectId: input.projectId,
    onProgress: progress,
  });

  if (!result.ok) {
    const err = new Error(result.error || 'Animation failed');
    err.retryable = false;
    throw err;
  }

  return result;
}

async function failJob(jobId, userId, costCredits, errorMsg) {
  // Check if job used a free try
  let freeColumn = null;
  try {
    const jobRow = await pool.query('SELECT input FROM generation_jobs WHERE id = $1', [jobId]);
    const input = jobRow.rows[0]?.input;
    if (input?._freeColumn && ['free_wan', 'free_veo'].includes(input._freeColumn)) {
      freeColumn = input._freeColumn;
    }
  } catch {}

  await pool.query(
    `UPDATE generation_jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
    [errorMsg, jobId],
  );

  if (freeColumn) {
    await pool.query(`UPDATE users SET ${freeColumn} = ${freeColumn} + 1 WHERE id = $1`, [userId]);
    console.log(`[Credits] Job ${jobId} failed: restored ${freeColumn} to user ${userId}`);
  } else if (costCredits > 0) {
    await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [costCredits, userId]);
    console.log(`[Credits] Job ${jobId} failed: refunded ${costCredits} to user ${userId}`);
  }
}

export async function runWatchdog() {
  try {
    const stale = await pool.query(
      `SELECT id, user_id, cost_credits FROM generation_jobs
       WHERE status = 'running' AND updated_at < NOW() - INTERVAL '${WATCHDOG_TIMEOUT_MIN} minutes'`,
    );
    for (const row of stale.rows) {
      await failJob(row.id, row.user_id, row.cost_credits, 'TIMEOUT (watchdog)');
      console.warn(`Watchdog: job ${row.id} timed out`);
    }
  } catch (err) {
    console.error('Watchdog error:', err);
  }
}
