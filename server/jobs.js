import pool from './db.js';
import { generateScenarios, CREDITS_COST, CREDITS_PER_SCENARIO } from './providers/llm.js';
import { generateImage } from './providers/image.js';
import { synthesize } from './providers/tts.js';

const CREDITS_PER_VIDEO = Number(process.env.CREDITS_PER_VIDEO) || 25;
const CREDITS_PER_REGEN = Number(process.env.CREDITS_PER_REGEN) || 3;
const MAX_SCENES = 5;
const WATCHDOG_TIMEOUT_MIN = 15;

export { CREDITS_COST, CREDITS_PER_SCENARIO, CREDITS_PER_VIDEO, CREDITS_PER_REGEN, MAX_SCENES };

export async function createJob({ userId, projectId, type, input, costCredits }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRow = await client.query('SELECT credits FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userRow.rows.length === 0) throw new Error('USER_NOT_FOUND');
    const before = userRow.rows[0].credits;
    if (before < costCredits) throw new Error('INSUFFICIENT_CREDITS');

    await client.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [costCredits, userId]);

    const job = await client.query(
      `INSERT INTO generation_jobs (user_id, project_id, type, input, cost_credits, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
      [userId, projectId, type, JSON.stringify(input), costCredits]
    );

    await client.query('COMMIT');

    const jobId = job.rows[0].id;
    console.log(`[Credits] Job ${jobId} (${type}): charged ${costCredits} credits. User ${userId}: ${before} → ${before - costCredits}`);
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

    // Handle partial refunds for script type only
    if (type === 'script') {
      if (result.succeeded !== undefined && result.succeeded < 3) {
        const refund = (3 - result.succeeded) * CREDITS_PER_SCENARIO;
        if (refund > 0) {
          await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [refund, user_id]);
          console.log(`[Credits] Script partial refund: ${refund} credits returned to user ${user_id} (${result.succeeded}/3 scenarios)`);
        }
      }
    }
    // storyboard and regenerate_scene: no partial refund — fixed price, full refund only on total failure (handled by failJob via throw)

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
  if (type === 'regenerate_scene') {
    return await runRegenerateScene(input, jobId);
  }
  throw Object.assign(new Error(`Type '${type}' not implemented`), { retryable: false });
}

async function runStoryboard(input, jobId) {
  const { projectId, scenario, voice } = input;
  // Enforce max scenes
  const scenes = scenario.scenes.slice(0, MAX_SCENES);
  const totalScenes = scenes.length;
  const tone = scenario.tone;

  const scenesMedia = [];
  let succeededScenes = 0;

  for (let i = 0; i < totalScenes; i++) {
    const scene = scenes[i];
    const sceneResult = { sceneIndex: i, image_url: null, audio_url: null, ok: true };

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
      console.warn(`[Storyboard] Image failed for scene ${i}: ${imgResult.error}`);
    }

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
      console.warn(`[Storyboard] TTS failed for scene ${i}: ${ttsResult.error}`);
    }

    if (sceneResult.image_url || sceneResult.audio_url) {
      succeededScenes++;
    }

    scenesMedia.push(sceneResult);

    const progress = Math.round(((i + 1) / totalScenes) * 100);
    await pool.query(
      `UPDATE generation_jobs SET progress = $1, updated_at = NOW() WHERE id = $2`,
      [progress, jobId]
    );
  }

  // If ALL scenes completely failed → throw to trigger full refund via failJob
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
      voice,
    },
  };
}

async function runRegenerateScene(input, jobId) {
  const { projectId, sceneIndex, scene, voice } = input;

  await pool.query(
    `UPDATE generation_jobs SET progress = 10, updated_at = NOW() WHERE id = $1`,
    [jobId]
  );

  const sceneResult = { sceneIndex, image_url: null, audio_url: null, ok: true };

  const imgResult = await generateImage({
    prompt: scene.description,
    projectId,
    sceneIndex,
    tone: input.tone,
    style: input.style,
  });

  if (imgResult.ok) {
    sceneResult.image_url = imgResult.data.url;
  } else {
    sceneResult.ok = false;
    console.warn(`[Regen] Image failed for scene ${sceneIndex}: ${imgResult.error}`);
  }

  await pool.query(
    `UPDATE generation_jobs SET progress = 60, updated_at = NOW() WHERE id = $1`,
    [jobId]
  );

  const ttsResult = await synthesize({
    text: scene.description,
    voice: voice || 'alena',
    projectId,
    sceneIndex,
  });

  if (ttsResult.ok) {
    sceneResult.audio_url = ttsResult.data.url;
  } else {
    sceneResult.ok = false;
    console.warn(`[Regen] TTS failed for scene ${sceneIndex}: ${ttsResult.error}`);
  }

  // If both failed — throw for full refund
  if (!sceneResult.image_url && !sceneResult.audio_url) {
    const err = new Error(`Scene ${sceneIndex} regeneration completely failed`);
    err.retryable = false;
    throw err;
  }

  return {
    ok: true,
    data: {
      sceneIndex,
      ...sceneResult,
    },
  };
}

async function failJob(jobId, userId, costCredits, errorMsg) {
  await pool.query(
    `UPDATE generation_jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
    [errorMsg, jobId]
  );
  if (costCredits > 0) {
    await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [costCredits, userId]);
    const bal = await pool.query('SELECT credits FROM users WHERE id = $1', [userId]);
    console.log(`[Credits] Job ${jobId} failed: refunded ${costCredits} credits to user ${userId}. Balance: ${bal.rows[0]?.credits}`);
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
