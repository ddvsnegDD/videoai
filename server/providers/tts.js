import { uploadBuffer } from '../storage.js';

export const CREDITS_COST = 1;

export const VOICES = [
  { id: 'alena', label: 'Алёна (жен., нейтральный)' },
  { id: 'filipp', label: 'Филипп (муж., спокойный)' },
  { id: 'ermil', label: 'Эрмил (муж., дикторский)' },
  { id: 'jane', label: 'Джейн (жен., эмоциональный)' },
  { id: 'omazh', label: 'Омаж (жен., глубокий)' },
];

const TTS_URL = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize';
const REQUEST_TIMEOUT = 30000;
const MAX_TEXT_LENGTH = 5000;

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.retryable = code !== 'AUTH_ERROR' && code !== 'INVALID_INPUT';
  return err;
}

export async function synthesize({ text, voice = 'alena', projectId, sceneIndex }) {
  try {
    const apiKey = process.env.YANDEX_API_KEY;
    if (!apiKey) throw makeError('AUTH_ERROR', 'YANDEX_API_KEY not set');

    const folderId = process.env.YANDEX_FOLDER_ID;
    if (!folderId) throw makeError('AUTH_ERROR', 'YANDEX_FOLDER_ID not set');

    if (!text || text.trim().length === 0) {
      throw makeError('INVALID_INPUT', 'Empty text for TTS');
    }

    let ttsText = text.trim();
    if (ttsText.length > MAX_TEXT_LENGTH) {
      ttsText = ttsText.substring(0, MAX_TEXT_LENGTH);
      console.warn(`[TTS] Text truncated to ${MAX_TEXT_LENGTH} chars for scene ${sceneIndex}`);
    }

    const validVoice = VOICES.find(v => v.id === voice) ? voice : 'alena';

    console.log(`[TTS] Synthesizing for project ${projectId}, scene ${sceneIndex}, voice ${validVoice}`);

    const formData = new URLSearchParams();
    formData.append('text', ttsText);
    formData.append('voice', validVoice);
    formData.append('emotion', 'neutral');
    formData.append('format', 'mp3');
    formData.append('sampleRateHertz', '48000');
    formData.append('folderId', folderId);
    formData.append('lang', 'ru-RU');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let res;
    try {
      res = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) {
      throw makeError('AUTH_ERROR', `SpeechKit auth failed: ${res.status}`);
    }
    if (res.status === 400) {
      const errText = await res.text().catch(() => '');
      throw makeError('INVALID_INPUT', `SpeechKit rejected input: ${errText}`);
    }
    if (res.status === 429) {
      throw makeError('RATE_LIMIT', 'SpeechKit rate limit');
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw makeError('PROVIDER_ERROR', `SpeechKit ${res.status}: ${errText}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    console.log(`[TTS] Got ${audioBuffer.length} bytes for scene ${sceneIndex}`);

    const key = `projects/${projectId}/scene-${sceneIndex}.mp3`;
    const url = await uploadBuffer({
      buffer: audioBuffer,
      key,
      contentType: 'audio/mpeg',
    });

    console.log(`[TTS] Uploaded to ${url}`);

    return { ok: true, data: { url }, credits_used: CREDITS_COST };
  } catch (err) {
    console.error(`[TTS] Error for project ${projectId}, scene ${sceneIndex}:`, err.message);
    return { ok: false, error: err.message, code: err.code };
  }
}
