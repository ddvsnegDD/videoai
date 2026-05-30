import { fal } from '@fal-ai/client';
import { uploadBuffer } from '../storage.js';

// Credits read from env (set in Railway)
const CREDITS_WAN = Number(process.env.CREDITS_WAN) || 40;
const CREDITS_VEO = Number(process.env.CREDITS_VEO) || 90;

export const VIDEO_MODELS = {
  wan: {
    id: 'fal-ai/wan/v2.1/image-to-video',
    label: 'Эконом (Wan)',
    label_full: 'Быстрый, доступный — для массовых креативов',
    credits: CREDITS_WAN,
  },
  veo: {
    id: 'fal-ai/veo3/image-to-video',
    label: 'Премиум (Veo)',
    label_full: 'Кинематографичное качество',
    credits: CREDITS_VEO,
  },
};

export const MOTION_PRESETS = [
  { key: 'push_in', label: 'Наезд камеры', prompt: 'slow cinematic camera push-in towards the product, subtle, premium commercial product video, smooth motion' },
  { key: 'rotate', label: 'Поворот товара', prompt: 'slow elegant rotation of the product, soft light reflections moving, premium commercial product video' },
  { key: 'orbit', label: 'Облёт вокруг', prompt: 'camera slowly orbits around the product, cinematic, soft lighting, premium commercial video' },
  { key: 'float', label: 'Парение', prompt: 'product gently floating with subtle movement, soft light, premium commercial product video' },
];

const OPERATION_TIMEOUT = 5 * 60 * 1000; // 5 min
const POLL_INTERVAL = 5000;

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.retryable = code !== 'AUTH_ERROR' && code !== 'INVALID_INPUT';
  return err;
}

function ensureConfig() {
  const key = process.env.FAL_KEY;
  if (!key) throw makeError('AUTH_ERROR', 'FAL_KEY not set');
  fal.config({ credentials: key });
}

export async function animateImage({ imageUrl, modelKey, motionPrompt, projectId, onProgress }) {
  ensureConfig();

  const model = VIDEO_MODELS[modelKey];
  if (!model) throw makeError('INVALID_INPUT', `Unknown model: ${modelKey}`);

  console.log(`[fal] Starting ${modelKey} for project ${projectId}`);
  console.log(`[fal] Model: ${model.id}`);
  console.log(`[fal] Prompt: ${motionPrompt?.slice(0, 100)}`);
  console.log(`[fal] Image: ${imageUrl}`);

  try {
    const submitInput = {
      image_url: imageUrl,
      prompt: motionPrompt || MOTION_PRESETS[0].prompt,
    };

    // Submit to queue
    const { request_id } = await fal.queue.submit(model.id, { input: submitInput });
    console.log(`[fal] Submitted, request_id: ${request_id}`);
    if (onProgress) await onProgress(20);

    // Poll until complete
    const startTime = Date.now();
    let progressSent50 = false;

    while (Date.now() - startTime < OPERATION_TIMEOUT) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));

      const status = await fal.queue.status(model.id, { requestId: request_id, logs: false });

      if (status.status === 'IN_PROGRESS' && !progressSent50) {
        if (onProgress) await onProgress(50);
        progressSent50 = true;
      }

      if (status.status === 'COMPLETED') {
        if (onProgress) await onProgress(70);

        const result = await fal.queue.result(model.id, { requestId: request_id });
        console.log(`[fal] Raw result keys:`, Object.keys(result.data || result));
        console.log(`[fal] Result preview:`, JSON.stringify(result.data || result).slice(0, 500));

        // Extract video URL — try common response shapes
        const data = result.data || result;
        const videoUrl = data?.video?.url || data?.output?.url || data?.url;
        if (!videoUrl) {
          throw makeError('PROVIDER_ERROR', `No video URL in fal response: ${JSON.stringify(data).slice(0, 200)}`);
        }

        if (onProgress) await onProgress(80);

        // Download and re-upload to our S3
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw makeError('PROVIDER_ERROR', `Failed to download video: ${videoRes.status}`);
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

        const key = `projects/${projectId}/creative-${Date.now()}.mp4`;
        const ourUrl = await uploadBuffer({ buffer: videoBuffer, key, contentType: 'video/mp4' });

        console.log(`[fal] Uploaded to S3: ${ourUrl} (${videoBuffer.length} bytes)`);
        if (onProgress) await onProgress(95);

        return { ok: true, data: { video_url: ourUrl } };
      }

      if (status.status === 'FAILED') {
        throw makeError('PROVIDER_ERROR', `fal generation failed: ${status.error || 'unknown'}`);
      }
    }

    throw makeError('TIMEOUT', `fal timed out after ${OPERATION_TIMEOUT / 1000}s`);
  } catch (err) {
    if (err.code) throw err;

    const msg = err.message || String(err);
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('authentication')) {
      throw makeError('AUTH_ERROR', `fal auth: ${msg}`);
    }
    if (msg.includes('429') || msg.includes('rate')) {
      throw makeError('RATE_LIMIT', `fal rate limit: ${msg}`);
    }
    if (msg.includes('400') || msg.includes('validation')) {
      throw makeError('INVALID_INPUT', `fal input error: ${msg}`);
    }
    throw makeError('PROVIDER_ERROR', `fal error: ${msg}`);
  }
}
