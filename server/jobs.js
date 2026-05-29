import pool from './db.js';
import { generateScenarios, CREDITS_COST, CREDITS_PER_SCENARIO } from './providers/llm.js';
import { generateImage, CREDITS_COST as IMAGE_COST } from './providers/image.js';
import { synthesize, CREDITS_COST as TTS_COST } from './providers/tts.js';

const SCENE_COST = IMAGE_COST + TTS_COST; // 3 + 1 = 4 per scene
const WATCHDOG_TIMEOUT_MIN = 15; // minutes — increased for storyboard tasks

export { CREDITS_COST, CREDITS_PER_SCENARIO, IMAGE_COST, TTS_COST, SCENE_COST };

export function calculateStoryboardCost(scenesCount) {
  return scenesCount * SCENE_COST;
}

export async function createJob({ userId, projectId, type, input, costCredits }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRow = await client.query('SELECT credits FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userRow.rows.length === 0) throw new Error('USER_NOT_FOUND');
    if (userRow.rows[0].credits < costCredits) throw new Error('INSUFFICIENT_CREDITS');

    await client.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [costCredits, userId]);

    const job = await client.query(
      `INSERT INTO generation_jobs (user_id, project_id, type, input, cost_credits, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
      [userId, projectId, type, JSON.stringify(input), costCredits]
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
    [jobId, userId]
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
    params
  );
  return result.rows;
}

async function runJob(jobId) {
  try {
    await pool.query(
      `UPDATE generation_jobs SET status = 'running', updated_at = NOW() WHERE id = $1`,
      [jobId]
    );

    const jobRow = await pool.query(
      `SELECT type, input, cost_credits, user_id FROM generation_jobs WHERE id = $1`,
      [jobId]
    );
    if (jobRow.rows.length === 0) return;

    const { type, input, cost_credits, user_id } = jobRow.rows[0];
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

    // Handle partial refunds based on task type
    if (type === 'script') {
      if (result.succeeded !== undefined && result.succeeded < 3) {
        const refund = (3 - result.succeeded) * CREDITS_PER_SCENARIO;
        if (refund > 0) {
          await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [refund, user_id]);
          console.log(`Partial refund: ${refund} credits returned to user ${user_id} (${result.succeeded}/3 scenarios)`);
        }
      }
    } else if (type === 'storyboard') {
      if (result.refund_credits > 0) {
        await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [result.refund_credits, user_id]);
        console.log(`Storyboard partial refund: ${result.refund_credits} credits returned to user ${user_id}`);
      }
    }

    await pool.query(
      `UPDATE generation_jobs SET status = 'done', progress = 100, output = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(result.data || result), jobId]
    );
  } catch (err) {
    console.error(`Job ${jobId} unhandled error:`, err);
    try {
      const jobRow = await pool.query(
        `SELECT cost_credits, user_id FROM generation_jobs WHERE id = $1`,
        [jobId]
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
  if (type === 'script') {
    return await generateScenarios(input);
  }
  if (type === 'storyboard') {
    return await runStoryboard(input, jobId);
  }
  throw Object.assign(new Error(`Type '${type}' not implemented`), { retryable: false });
}

async function runStoryboard(input, jobId) {
  const { projectId, scenario, voice } = input;
  const scenes = scenario.scenes;
  const totalScenes = scenes.length;
  const tone = scenario.tone;

  const scenesMedia = [];
  let succeededScenes = 0;
  let failedSteps = 0;
  let refundCredits = 0;

  for (let i = 0; i < totalScenes; i++) {
    const scene = scenes[i];
    const sceneResult = { sceneIndex: i, image_url: null, audio_url: null, ok: true };

    // Generate image
    const imgResult = await generateImage({
      prompt: scene.description,
      projectId,
      sceneIndex: i,
      tone,
      style: input.style,
    });

    if (imgResult.ok) {
      sceneResult.image_url = imgResult.data.url;
    } else {
      sceneResult.ok = false;
      refundCredits += IMAGE_COST;
      failedSteps++;
      console.warn(`[Storyboard] Image failed for scene ${i}: ${imgResult.error}`);
    }

    // Synthesize audio
    const ttsResult = await synthesize({
      text: scene.description,
      voice: voice || 'alena',
      projectId,
      sceneIndex: i,
    });

    if (ttsResult.ok) {
      sceneResult.audio_url = ttsResult.data.url;
    } else {
      sceneResult.ok = false;
      refundCredits += TTS_COST;
      failedSteps++;
      console.warn(`[Storyboard] TTS failed for scene ${i}: ${ttsResult.error}`);
    }

    if (sceneResult.image_url || sceneResult.audio_url) {
      succeededScenes++;
    }

    scenesMedia.push(sceneResult);

    // Update progress after each scene
    const progress = Math.round(((i + 1) / totalScenes) * 100);
    await pool.query(
      `UPDATE generation_jobs SET progress = $1, updated_at = NOW() WHERE id = $2`,
      [progress, jobId]
    );
  }

  // If all scenes completely failed (no image AND no audio for every scene) — throw to trigger full refund
  if (succeededScenes === 0) {
    const err = new Error('All scenes failed to generate');
    err.retryable = false;
    throw err;
  }

  return {
    ok: true,
    data: {
      scenes_media: scenesMedia,
      total_scenes: totalScenes,
      succeeded_scenes: succeededScenes,
      failed_steps: failedSteps,
      voice,
    },
    refund_credits: refundCredits,
  };
}

async function failJob(jobId, userId, costCredits, errorMsg) {
  await pool.query(
    `UPDATE generation_jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
    [errorMsg, jobId]
  );
  if (costCredits > 0) {
    await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [costCredits, userId]);
  }
}

export async function runWatchdog() {
  try {
    const stale = await pool.query(
      `SELECT id, user_id, cost_credits FROM generation_jobs
       WHERE status = 'running' AND updated_at < NOW() - INTERVAL '${WATCHDOG_TIMEOUT_MIN} minutes'`
    );
    for (const row of stale.rows) {
      await failJob(row.id, row.user_id, row.cost_credits, 'TIMEOUT (watchdog)');
      console.warn(`Watchdog: job ${row.id} timed out`);
    }
  } catch (err) {
    console.error('Watchdog error:', err);
  }
}
