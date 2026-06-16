import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Agent, fetch as undiciFetch } from 'undici';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

// --- Fallback prompts (used only if prompts.image.json fails to load) ---
const FALLBACK_IMAGE_PROMPT_SYSTEM = `You are a professional product photographer and AI image prompt engineer.
The user describes a product in Russian. Your job:
1. Create a DETAILED prompt IN ENGLISH for an AI image generator (Nano Banana / Flux).
2. The prompt must describe: the product itself, background/surface, camera angle, lighting, style.
3. Style: premium commercial product photography, clean minimalist background, soft studio lighting.
4. Keep text/logos on packaging readable — mention "sharp readable text on label" in the prompt.
5. Output ONLY the English prompt, no explanations, no markdown, no quotes.`;

const FALLBACK_IMAGE_PROMPT_SYSTEM_STRICT = `You MUST output ONLY an English prompt for an AI image generator. No Russian, no Cyrillic characters, no explanations, no markdown, no quotes. English only. Output the prompt and nothing else.

The user describes a product. Create a detailed image generation prompt describing: the product, background, camera angle, lighting, premium commercial product photography style. Mention "sharp readable text on label".`;

// --- Load prompts from JSON (with fallback to hardcoded values above) ---
let imagePrompts;
try {
  const jsonPath = join(__dirname, '..', 'prompts.image.json');
  imagePrompts = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  console.log('[prompts] prompts.image.json loaded successfully');
} catch (err) {
  console.error(`[prompts] Ошибка чтения prompts.image.json: ${err.message}`);
  console.error('[prompts] Используются встроенные fallback-промпты');
  imagePrompts = null;
}

const IMAGE_PROMPT_SYSTEM = imagePrompts?.image_prompt_system ?? FALLBACK_IMAGE_PROMPT_SYSTEM;
const IMAGE_PROMPT_SYSTEM_STRICT = imagePrompts?.image_prompt_system_strict ?? FALLBACK_IMAGE_PROMPT_SYSTEM_STRICT;

const CYRILLIC_RE = /[а-яёА-ЯЁ]/;

function cleanPromptOutput(raw) {
  let s = raw.trim();
  // Strip markdown code fences
  s = s.replace(/^```[\s\S]*?\n/, '').replace(/\n?```\s*$/, '');
  // Strip backtick wrapping
  s = s.replace(/^`+|`+$/g, '');
  // Strip outer quotes (double, single, «»)
  s = s.replace(/^["'«]+|["'»]+$/g, '');
  // Strip leading labels
  s = s.replace(/^(?:Prompt|Image prompt|Here is|Here's|Output|Промпт|Результат)\s*[:：]\s*/i, '');
  // Collapse whitespace/newlines
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export async function buildImagePrompt({ productType, details, style }) {
  if (!productType) throw makeError('INVALID_INPUT', 'productType is required');

  const userMsg = [
    `Товар: ${productType}`,
    details ? `Детали: ${details}` : '',
    style ? `Стиль: ${style}` : '',
  ].filter(Boolean).join('\n');

  console.log(`[GigaChat] buildImagePrompt input: ${userMsg}`);

  // First attempt
  const raw = await chatCompletion([
    { role: 'system', content: IMAGE_PROMPT_SYSTEM },
    { role: 'user', content: userMsg },
  ], { temperature: 0.7, maxTokens: 512 });

  let cleaned = cleanPromptOutput(raw);
  console.log(`[GigaChat] buildImagePrompt attempt 1: ${cleaned.slice(0, 200)}`);

  // Check for Cyrillic — retry once with stricter system prompt
  if (CYRILLIC_RE.test(cleaned)) {
    console.warn(`[GigaChat] buildImagePrompt: Cyrillic detected, retrying with strict prompt`);

    const raw2 = await chatCompletion([
      { role: 'system', content: IMAGE_PROMPT_SYSTEM_STRICT },
      { role: 'user', content: userMsg },
    ], { temperature: 0.5, maxTokens: 512 });

    cleaned = cleanPromptOutput(raw2);
    console.log(`[GigaChat] buildImagePrompt attempt 2: ${cleaned.slice(0, 200)}`);

    if (CYRILLIC_RE.test(cleaned)) {
      console.error(`[GigaChat] buildImagePrompt: Cyrillic after retry, aborting`);
      throw makeError('INVALID_PROMPT', 'GigaChat returned Cyrillic prompt after retry — image generation aborted');
    }
  }

  if (!cleaned || cleaned.length < 10) {
    throw makeError('INVALID_PROMPT', 'GigaChat returned empty or too short prompt');
  }

  return { prompt: cleaned };
}

export async function listModels() {
  const token = await getToken();
  const res = await fetchGC('https://gigachat.devices.sberbank.ru/api/v1/models', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  return res.json();
}
