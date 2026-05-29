import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Agent, fetch as undiciFetch } from 'undici';
import { buildScenarioPrompt, TONES } from '../prompts/scenario.js';
import { parseSingleScenario } from '../lib/scenarioParser.js';

export const CREDITS_COST = 3;
export const CREDITS_PER_SCENARIO = 1;

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

  // TODO: add real Russian CA certs for production
  console.warn('⚠️ SSL verification disabled for GigaChat — fix before production');
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

async function chatCompletion(messages) {
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
      temperature: 0.9,
      max_tokens: 2048,
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

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.retryable = code !== 'AUTH_ERROR';
  return err;
}

async function generateOne({ topic, style, duration, tone }) {
  const messages = buildScenarioPrompt({ topic, style, duration, tone });
  const rawText = await chatCompletion(messages);
  const parsed = parseSingleScenario(rawText);

  if (!parsed.ok) {
    console.error(`LLM parse fail [${tone.key}]:`, rawText.substring(0, 300));
    throw makeError('PARSE_ERROR', `Failed to parse ${tone.label} scenario`);
  }

  // Ensure tone label is set from context if model didn't return it
  if (!parsed.scenario.tone) {
    parsed.scenario.tone = tone.label;
  }

  return parsed.scenario;
}

export async function generateScenarios({ topic, style, duration }) {
  // Sequential requests — GigaChat PERS rate-limits parallel calls
  const scenarios = [];
  let failed = 0;

  for (const tone of TONES) {
    try {
      const scenario = await generateOne({ topic, style, duration, tone });
      scenarios.push(scenario);
    } catch (err) {
      failed++;
      console.warn(`Scenario [${tone.key}] failed:`, err.message);
    }
  }

  const succeeded = scenarios.length;

  if (succeeded === 0) {
    throw makeError('PROVIDER_ERROR', 'All 3 scenarios failed');
  }

  if (succeeded < 3) {
    console.warn(`Partial success: ${succeeded}/3 scenarios generated`);
  }

  return {
    ok: true,
    data: { scenarios, succeeded, failed },
    succeeded,
    failed,
  };
}

export async function generateIdeas({ niche, count = 5 }) {
  throw makeError('PROVIDER_ERROR', 'generateIdeas not implemented yet');
}

export async function listModels() {
  const token = await getToken();
  const res = await fetchGC('https://gigachat.devices.sberbank.ru/api/v1/models', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  return res.json();
}
