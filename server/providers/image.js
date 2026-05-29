import { uploadBuffer } from '../storage.js';
import { buildImagePrompt } from '../prompts/imagePrompt.js';

export const CREDITS_COST = 3;

const GENERATION_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync';
const OPERATION_URL = 'https://operation.api.cloud.yandex.net/operations';

const POLL_INTERVAL = 3000;
const OPERATION_TIMEOUT = 90000;

function getHeaders() {
  const apiKey = process.env.YANDEX_API_KEY;
  if (!apiKey) throw makeError('AUTH_ERROR', 'YANDEX_API_KEY not set');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Api-Key ${apiKey}`,
  };
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.retryable = code !== 'AUTH_ERROR' && code !== 'INVALID_INPUT';
  return err;
}

async function startGeneration(prompt) {
  const folderId = process.env.YANDEX_FOLDER_ID;
  if (!folderId) throw makeError('AUTH_ERROR', 'YANDEX_FOLDER_ID not set');

  const res = await fetch(GENERATION_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      modelUri: `art://${folderId}/yandex-art/latest`,
      generationOptions: {
        aspectRatio: { widthRatio: 9, heightRatio: 16 },
      },
      messages: [{ weight: 1, text: prompt }],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw makeError('AUTH_ERROR', `Yandex ART auth failed: ${res.status}`);
  }
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    const msg = body.message || body.error?.message || 'Bad request';
    throw makeError('INVALID_INPUT', `Yandex ART rejected prompt: ${msg}`);
  }
  if (res.status === 429) {
    throw makeError('RATE_LIMIT', 'Yandex ART rate limit');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeError('PROVIDER_ERROR', `Yandex ART ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.id;
}

async function pollOperation(operationId) {
  const startTime = Date.now();

  while (Date.now() - startTime < OPERATION_TIMEOUT) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const res = await fetch(`${OPERATION_URL}/${operationId}`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw makeError('PROVIDER_ERROR', `Operation poll failed: ${res.status} ${text}`);
    }

    const op = await res.json();

    if (op.error) {
      const msg = op.error.message || 'Operation failed';
      throw makeError('PROVIDER_ERROR', `Yandex ART operation error: ${msg}`);
    }

    if (op.done) {
      const imageBase64 = op.response?.image;
      if (!imageBase64) {
        throw makeError('PROVIDER_ERROR', 'No image in completed operation');
      }
      return Buffer.from(imageBase64, 'base64');
    }
  }

  throw makeError('TIMEOUT', `Yandex ART operation timed out after ${OPERATION_TIMEOUT / 1000}s`);
}

export async function generateImage({ prompt, projectId, sceneIndex, tone, style }) {
  try {
    const fullPrompt = buildImagePrompt({
      sceneDescription: prompt,
      tone,
      style,
    });

    console.log(`[ART] Starting generation for project ${projectId}, scene ${sceneIndex}`);

    const operationId = await startGeneration(fullPrompt);
    console.log(`[ART] Operation ${operationId} started`);

    const imageBuffer = await pollOperation(operationId);
    console.log(`[ART] Operation ${operationId} completed, ${imageBuffer.length} bytes`);

    const key = `projects/${projectId}/scene-${sceneIndex}.jpg`;
    const url = await uploadBuffer({
      buffer: imageBuffer,
      key,
      contentType: 'image/jpeg',
    });

    console.log(`[ART] Uploaded to ${url}`);

    return { ok: true, data: { url }, credits_used: CREDITS_COST };
  } catch (err) {
    console.error(`[ART] Error for project ${projectId}, scene ${sceneIndex}:`, err.message);
    return { ok: false, error: err.message, code: err.code };
  }
}
