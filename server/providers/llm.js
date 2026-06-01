import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Agent, fetch as undiciFetch } from 'undici';

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CHAT_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const MODEL = process.env.GIGACHAT_MODEL || 'GigaChat';
const REQUEST_TIMEOUT = 60000;

let cachedToken = null;
let cachedExpiresAt = 0;

function createDispatcher() {
  const rootCert = resolve('server/certs/russian_trusted_root_ca.cer');
  const subCert = resolve('server/certs/russian_trusted_sub_ca.cer');

  const ca = [];
  if (existsSync(rootCert)) ca.push(readFileSync(rootCert));
  if (existsSync(subCert)) ca.push(readFileSync(subCert));

  if (ca.length > 0) {
    return new Agent({ connect: { ca, rejectUnauthorized: true } });
  }

  console.warn('[GigaChat] SSL certs not found — verification disabled');
  return new Agent({ connect: { rejectUnauthorized: false } });
}

const dispatcher = createDispatcher();

async function fetchGC(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    return await undiciFetch(url, { ...options, signal: controller.signal, dispatcher });
  } finally {
    clearTimeout(timer);
  }
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.retryable = code !== 'AUTH_ERROR';
  return err;
}

async function getToken() {
  if (cachedToken && Date.now() < cachedExpiresAt - 60000) {
    return cachedToken;
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  if (!authKey) throw makeError('AUTH_ERROR', 'GIGACHAT_AUTH_KEY not set');

  const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';

  const res = await fetchGC(OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': `Basic ${authKey}`,
      'RqUID': randomUUID(),
    },
    body: `scope=${scope}`,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeError('AUTH_ERROR', `OAuth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedExpiresAt = data.expires_at;
  return cachedToken;
}

async function chatCompletion(messages, { temperature = 0.9, maxTokens = 2048 } = {}) {
  const token = await getToken();

  const res = await fetchGC(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Request-ID': randomUUID(),
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (res.status === 401) {
    cachedToken = null;
    throw makeError('AUTH_ERROR', 'Token rejected');
  }
  if (res.status === 429) {
    throw makeError('RATE_LIMIT', 'GigaChat rate limit');
  }
  if (res.status >= 500) {
    throw makeError('PROVIDER_ERROR', `GigaChat ${res.status}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeError('PROVIDER_ERROR', `GigaChat ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw makeError('PROVIDER_ERROR', 'Empty response from GigaChat');

  return content;
}

// ── Sprint B: build image prompt from Russian product description ──

const IMAGE_PROMPT_SYSTEM = `You are a professional product photographer and AI image prompt engineer.
The user describes a product in Russian. Your job:
1. Create a DETAILED prompt IN ENGLISH for an AI image generator (Nano Banana / Flux).
2. The prompt must describe: the product itself, background/surface, camera angle, lighting, style.
3. Style: premium commercial product photography, clean minimalist background, soft studio lighting.
4. Keep text/logos on packaging readable — mention "sharp readable text on label" in the prompt.
5. Output ONLY the English prompt, no explanations, no markdown, no quotes.`;

export async function buildImagePrompt({ productType, details, style }) {
  if (!productType) throw makeError('INVALID_INPUT', 'productType is required');

  const userMsg = [
    `Товар: ${productType}`,
    details ? `Детали: ${details}` : '',
    style ? `Стиль: ${style}` : '',
  ].filter(Boolean).join('\n');

  console.log(`[GigaChat] buildImagePrompt input: ${userMsg}`);

  const prompt = await chatCompletion([
    { role: 'system', content: IMAGE_PROMPT_SYSTEM },
    { role: 'user', content: userMsg },
  ], { temperature: 0.7, maxTokens: 512 });

  const cleaned = prompt.replace(/^["'`]+|["'`]+$/g, '').trim();
  console.log(`[GigaChat] buildImagePrompt result: ${cleaned.slice(0, 200)}`);

  return { prompt: cleaned };
}

export async function listModels() {
  const token = await getToken();
  const res = await fetchGC('https://gigachat.devices.sberbank.ru/api/v1/models', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  return res.json();
}
