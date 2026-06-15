import { fal } from '@fal-ai/client';
import { uploadBuffer } from '../storage.js';
import { retryWithBackoff } from '../lib/retry.js';

const CREDITS_WAN = Number(process.env.CREDITS_WAN) || 40;
const CREDITS_VEO = Number(process.env.CREDITS_VEO) || 90;
const CREDITS_COSMOS = Number(process.env.CREDITS_COSMOS) || 60;

export const VIDEO_MODELS = {
  wan: {
    id: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video',
    label: 'Эконом (Kling)',
    label_full: 'Плавное движение, высокая точность промпта',
    credits: CREDITS_WAN,
  },
  cosmos: {
    id: 'fal-ai/cosmos-3-super-i2v/image-to-video',
    label: 'Стандарт · Cosmos',
    label_full: 'Стандарт · Cosmos 3',
    credits: CREDITS_COSMOS,
  },
  veo: {
    id: 'fal-ai/veo3.1/fast/image-to-video',
    label: 'Премиум (Veo)',
    label_full: 'Кинематографичное качество',
    credits: CREDITS_VEO,
  },
};

export const MOTION_PRESETS = [
  { key: 'push_in', label: 'Мягкий наезд', prompt: 'slow cinematic camera push-in towards the product, subtle, premium commercial product video, smooth motion' },
  { key: 'pan', label: 'Панорама', prompt: 'smooth horizontal camera pan along the product, steady lateral tracking movement, no rotation, no orbit, premium commercial product video' },
  { key: 'orbit', label: 'Облёт', prompt: 'camera slowly orbits around the product, premium commercial product video, smooth controlled motion' },
  { key: 'pull_back', label: 'Отъезд', prompt: 'slow cinematic camera pull-back revealing the product, premium commercial look, smooth motion' },
  { key: 'tilt', label: 'Подъём', prompt: 'slow vertical camera tilt up the product, premium commercial product video, smooth motion' },
  { key: 'light_play', label: 'Игра света', prompt: 'minimal camera movement, focus on shifting light and reflections on the product, premium commercial look' },
  { key: 'back_view', label: 'Вид сзади', prompt: 'smooth gentle camera movement showing the full back of the product, steady framing keeping the whole item in view, premium commercial product video, smooth motion' },
];

export const COSMOS_NEGATIVE_PROMPT = 'text morphing, logo distortion, mutated text, scrambled letters, melting geometry, warping shapes, morphing objects, macroblocking artifacts, chromatic aberration, high-frequency noise, rolling shutter distortion, motion blur, shaky footage, low resolution, grainy texture, pixelation, poor lighting, underexposed, overexposed, washed out colors, color banding, choppy or jerky movement, low frame rate, unnatural transitions, jump cuts, flickering, moiré patterns, edge halos, temporal aliasing, deformation, distortion, changes to product color or details, extra objects, fake or unconvincing visuals, overall poor quality';

export const COSMOS_PRESETS = [
  { key: 'push_in', label: 'Мягкий наезд', prompt: 'Create a cinematic product video based on the reference image. The camera performs a slow, smooth dolly push-in toward the product, gently emphasizing its front details. Keep the product perfectly unchanged: maintain strict structural integrity, preserving the exact design, materials, texture, text, logo placement, shape, and proportions. Clean white studio background, soft diffused lighting, subtle shadows, premium commercial aesthetics. Elegant, polished, high-end advertising look. No deformation, no extra objects, no camera shake, no distortion, no changes to the product\'s color or details.' },
  { key: 'pan', label: 'Панорама', prompt: 'Create a cinematic product video based on the reference image. The camera performs a smooth horizontal lateral truck shot along the product, steady side-to-side tracking with no rotation and no orbit. Keep the product perfectly unchanged: maintain strict structural integrity, preserving the exact design, materials, texture, text, logo placement, shape, and proportions. Clean white studio background, soft diffused lighting, subtle shadows, premium commercial aesthetics. Elegant, polished, high-end look. No deformation, no extra objects, no camera shake, no distortion, no changes to the product\'s color or details.' },
  { key: 'orbit', label: 'Облёт', prompt: 'Create a cinematic product video based on the reference image. The camera performs a slow, smooth, elegant arc shot and partial orbit around the product, starting from a front three-quarter angle and gradually revealing the side and dimensional profile. Keep the product perfectly unchanged: maintain strict structural integrity, preserving the exact design, materials, texture, text, logo placement, shape, and proportions. Clean white studio background, soft diffused lighting, subtle shadows, premium commercial product photography aesthetics. High-end luxury advertising look. No deformation, no extra objects, no camera shake, no distortion, no changes to the product\'s color or details.' },
  { key: 'pull_back', label: 'Отъезд', prompt: 'Create a cinematic product video based on the reference image. The camera performs a slow, smooth dolly pull-back, gradually revealing the full product and its clean presentation in the frame. Keep the product perfectly unchanged: maintain strict structural integrity, preserving the exact design, materials, texture, text, logo placement, shape, and proportions. Clean white studio background, soft diffused lighting, subtle shadows, premium commercial aesthetics. Elegant, polished, high-end look. No deformation, no extra objects, no camera shake, no distortion, no changes to the product\'s color or details.' },
  { key: 'tilt', label: 'Подъём', prompt: 'Create a cinematic product video based on the reference image. The camera performs a slow, smooth vertical crane shot upward (pedestal movement) along the product, revealing it flawlessly from bottom to top with zero perspective distortion. Keep the product perfectly unchanged: maintain strict structural integrity, preserving the exact design, materials, texture, text, logo placement, shape, and proportions. Clean white studio background, soft diffused lighting, subtle shadows, premium commercial aesthetics. Elegant, polished, high-end look. No deformation, no extra objects, no camera shake, no distortion, no changes to the product\'s color or details.' },
  { key: 'light_play', label: 'Игра света', prompt: 'Create a cinematic product video based on the reference image. Stationary camera with minimal to no movement, focusing entirely on soft shifting studio light. Gentle cinematic reflections, specular highlights, and elegant gleams moving across the product\'s surface. Keep the product perfectly unchanged: maintain strict structural integrity, preserving the exact design, materials, texture, text, logo placement, shape, and proportions. Clean white studio background, soft diffused lighting, subtle shadows, premium commercial aesthetics. Elegant, polished, high-end look. No deformation, no extra objects, no camera shake, no distortion, no changes to the product\'s color or details.' },
  { key: 'back_view', label: 'Вид сзади', prompt: 'Create a cinematic product video based on the reference image showing the back of the product. Smooth, extremely gentle camera movement maintaining a steady hero shot, keeping the full back design of the product perfectly in frame with no deep push-in. Keep the product perfectly unchanged: maintain strict structural integrity, preserving the exact design, materials, texture, text, logo placement, shape, and proportions. Clean white studio background, soft diffused lighting, subtle shadows, premium commercial aesthetics. Elegant, polished, high-end look. No deformation, no extra objects, no camera shake, no distortion, no changes to the product\'s color or details.' },
];

export const POLL_TIMEOUT = 8 * 60 * 1000; // 8 min
const POLL_INTERVAL = 5000;

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.retryable = false; // never retry fal submits — costs money
  return err;
}

function ensureConfig() {
  const key = process.env.FAL_KEY;
  if (!key) throw makeError('AUTH_ERROR', 'FAL_KEY not set');
  fal.config({ credentials: key });
}

/**
 * Submit to fal queue. Returns { request_id }.
 * Does NOT poll — caller saves request_id to DB first.
 */
export async function submitToFal({ imageUrl, modelKey, motionPrompt, seed, durationSec }) {
  ensureConfig();
  const model = VIDEO_MODELS[modelKey];
  if (!model) throw makeError('INVALID_INPUT', `Unknown model: ${modelKey}`);

  const promptText = motionPrompt || MOTION_PRESETS[0].prompt;

  let submitInput;
  if (modelKey === 'wan') {
    submitInput = {
      image_url: imageUrl,
      prompt: promptText,
      duration: durationSec || '5',
      negative_prompt: 'blur, distort, low quality, warped text, distorted lettering, deformed logo',
      cfg_scale: 0.5,
    };
  } else if (modelKey === 'cosmos') {
    submitInput = {
      image_url: imageUrl,
      prompt: promptText,
      num_frames: 189,
      fps: 24,
      image_size: { width: 480, height: 832 },
      negative_prompt: COSMOS_NEGATIVE_PROMPT,
      enable_agentic_generation: false,
      num_inference_steps: 28,
      guidance_scale: 6,
    };
  } else {
    submitInput = {
      image_url: imageUrl,
      prompt: promptText,
      seed,
      resolution: '720p',
      duration: '8s',
      generate_audio: false,
      aspect_ratio: '9:16',
      negative_prompt: 'low quality, distortion, warping, blurry',
    };
  }

  console.log(`[fal] Submitting ${modelKey}, seed=${seed}`);
  console.log(`[fal] Input:`, JSON.stringify(submitInput));

  try {
    const { request_id } = await fal.queue.submit(model.id, { input: submitInput });
    console.log(`[fal] Submitted, request_id: ${request_id}`);
    return { request_id };
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('401') || msg.includes('Unauthorized')) throw makeError('AUTH_ERROR', msg);
    if (msg.includes('429') || msg.includes('rate')) throw makeError('RATE_LIMIT', msg);
    if (msg.includes('400') || msg.includes('validation')) throw makeError('INVALID_INPUT', msg);
    throw makeError('PROVIDER_ERROR', `fal submit error: ${msg}`);
  }
}

/**
 * Poll fal until COMPLETED/FAILED or timeout. Returns { status, data? }.
 * onProgress receives graduated 20→65%.
 */
export async function pollFal({ modelKey, requestId, onProgress, timeoutMs }) {
  ensureConfig();
  const model = VIDEO_MODELS[modelKey];
  if (!model) throw makeError('INVALID_INPUT', `Unknown model: ${modelKey}`);

  const timeout = timeoutMs || POLL_TIMEOUT;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const status = await fal.queue.status(model.id, { requestId, logs: false });
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[fal] Poll ${elapsed}s: status=${status.status}`);

    // Graduated progress 20→65
    if (onProgress && (status.status === 'IN_QUEUE' || status.status === 'IN_PROGRESS')) {
      const pct = Math.min(20 + Math.round((elapsed / (timeout / 1000)) * 45), 65);
      await onProgress(pct);
    }

    if (status.status === 'COMPLETED') {
      return { status: 'COMPLETED' };
    }

    if (status.status === 'FAILED') {
      return { status: 'FAILED', error: status.error || 'fal generation failed' };
    }
  }

  return { status: 'POLL_TIMEOUT' };
}

/**
 * Fetch the fal result URL. This is the critical step — if fal says COMPLETED,
 * we MUST get the URL out. Throws only on real fal errors.
 */
export async function fetchFalResult({ modelKey, requestId }) {
  ensureConfig();
  const model = VIDEO_MODELS[modelKey];

  const result = await fal.queue.result(model.id, { requestId });
  const data = result.data || result;
  console.log(`[fal] Result keys:`, Object.keys(data));
  console.log(`[fal] Result preview:`, JSON.stringify(data).slice(0, 500));

  const videoUrl = data?.video?.url || data?.output?.url || data?.url;
  if (!videoUrl) {
    throw makeError('PROVIDER_ERROR', `No video URL in fal response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return { video_url: videoUrl, fal_seed: data?.seed };
}

/**
 * Best-effort: download from fal URL and re-upload to S3.
 * Retries up to 3 times with exponential backoff (2s → 4s → 8s).
 * Never throws — returns { s3_url } on success, null after all attempts fail.
 * Each attempt uses a unique S3 key (creative-${Date.now()}.mp4), so retries
 * are idempotent — no duplicate-key conflicts, just orphan files at worst.
 */
export async function reuploadToS3({ falUrl, projectId }) {
  try {
    const result = await retryWithBackoff(async () => {
      const videoRes = await fetch(falUrl);
      if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

      const key = `projects/${projectId}/creative-${Date.now()}.mp4`;
      const ourUrl = await uploadBuffer({ buffer: videoBuffer, key, contentType: 'video/mp4' });
      console.log(`[Anti-leak] Uploaded to S3: ${ourUrl} (${videoBuffer.length} bytes)`);
      return { s3_url: ourUrl };
    }, { retries: 3, delayMs: 2000, factor: 2, label: 'Anti-leak reupload' });

    return result;
  } catch (err) {
    console.error(`[Anti-leak] S3 re-upload failed after all retries (fal URL preserved): ${err.message}`);
    return null;
  }
}

/**
 * Legacy wrapper — kept for reconciler compatibility.
 * Calls fetchFalResult + reuploadToS3, returns video_url (S3 or fal fallback).
 */
export async function fetchAndUpload({ modelKey, requestId, projectId }) {
  const falResult = await fetchFalResult({ modelKey, requestId });
  const s3 = await reuploadToS3({ falUrl: falResult.video_url, projectId });
  return {
    video_url: s3?.s3_url || falResult.video_url,
    fal_seed: falResult.fal_seed,
    s3_fallback: !s3,
  };
}
