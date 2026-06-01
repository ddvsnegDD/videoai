import { fal } from '@fal-ai/client';
import { uploadBuffer } from '../storage.js';

const CREDITS_IMAGE = Number(process.env.CREDITS_IMAGE) || 13;

export const IMAGE_MODEL = {
  id: 'fal-ai/nano-banana-2',
  label: 'Nano Banana 2',
  credits: CREDITS_IMAGE,
};

export const POLL_TIMEOUT_IMAGE = 3 * 60 * 1000; // 3 min (images are faster)
const POLL_INTERVAL = 3000;

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.retryable = false;
  return err;
}

function ensureConfig() {
  const key = process.env.FAL_KEY;
  if (!key) throw makeError('AUTH_ERROR', 'FAL_KEY not set');
  fal.config({ credentials: key });
}

export async function submitImageToFal({ prompt, seed, aspectRatio }) {
  ensureConfig();

  const submitInput = {
    prompt,
    num_images: 1,
    aspect_ratio: aspectRatio || '3:4',
    output_format: 'png',
    resolution: '1K',
  };
  if (seed != null) submitInput.seed = seed;

  console.log(`[fal-image] Submitting, seed=${seed}`);
  console.log(`[fal-image] Input:`, JSON.stringify(submitInput));

  try {
    const { request_id } = await fal.queue.submit(IMAGE_MODEL.id, { input: submitInput });
    console.log(`[fal-image] Submitted, request_id: ${request_id}`);
    return { request_id };
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('401') || msg.includes('Unauthorized')) throw makeError('AUTH_ERROR', msg);
    if (msg.includes('429') || msg.includes('rate')) throw makeError('RATE_LIMIT', msg);
    if (msg.includes('400') || msg.includes('validation')) throw makeError('INVALID_INPUT', msg);
    throw makeError('PROVIDER_ERROR', `fal image submit error: ${msg}`);
  }
}

export async function pollFalImage({ requestId, onProgress, timeoutMs }) {
  ensureConfig();

  const timeout = timeoutMs || POLL_TIMEOUT_IMAGE;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const status = await fal.queue.status(IMAGE_MODEL.id, { requestId, logs: false });
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[fal-image] Poll ${elapsed}s: status=${status.status}`);

    if (onProgress && (status.status === 'IN_QUEUE' || status.status === 'IN_PROGRESS')) {
      const pct = Math.min(20 + Math.round((elapsed / (timeout / 1000)) * 50), 70);
      await onProgress(pct);
    }

    if (status.status === 'COMPLETED') {
      return { status: 'COMPLETED' };
    }

    if (status.status === 'FAILED') {
      return { status: 'FAILED', error: status.error || 'fal image generation failed' };
    }
  }

  return { status: 'POLL_TIMEOUT' };
}

function extractImageUrl(data) {
  // Try multiple paths — fal response format can vary
  const candidates = [
    data?.images?.[0]?.url,
    typeof data?.images?.[0] === 'string' ? data.images[0] : null,
    data?.image?.url,
    data?.url,
    data?.output?.[0]?.url,
    typeof data?.output?.[0] === 'string' ? data.output[0] : null,
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i] && typeof candidates[i] === 'string' && candidates[i].startsWith('http')) {
      const keys = ['images[0].url', 'images[0] (string)', 'image.url', 'url', 'output[0].url', 'output[0] (string)'];
      console.log(`[fal-image] URL extracted via: ${keys[i]}`);
      return candidates[i];
    }
  }
  return null;
}

export async function fetchImageAndUpload({ requestId, userId }) {
  ensureConfig();

  const result = await fal.queue.result(IMAGE_MODEL.id, { requestId });
  const data = result.data || result;
  console.log(`[fal-image] Result keys:`, Object.keys(data));
  console.log(`[fal-image] Result preview:`, JSON.stringify(data).slice(0, 500));

  const imageUrl = extractImageUrl(data);
  if (!imageUrl) {
    // COMPLETED but no URL — fal already charged. Do NOT re-submit.
    // Throw so failJob refunds the user; request_id stays for manual investigation.
    throw makeError('PROVIDER_ERROR', `COMPLETED but no image URL in fal response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const returnedSeed = data?.seed;

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw makeError('PROVIDER_ERROR', `Failed to download image: ${imgRes.status}`);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  const key = `images/${userId}/gen-${Date.now()}.png`;
  const ourUrl = await uploadBuffer({ buffer: imgBuffer, key, contentType: 'image/png' });
  console.log(`[fal-image] Uploaded to S3: ${ourUrl} (${imgBuffer.length} bytes)`);

  return { image_url: ourUrl, fal_seed: returnedSeed };
}
