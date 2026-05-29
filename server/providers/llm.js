import { randomUUID } from 'crypto';
import https from 'https';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { buildScenarioPrompt } from '../prompts/scenario.js';
import { parseScenariosResponse } from '../lib/scenarioParser.js';

export const CREDITS_COST = 1;

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CHAT_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const MODEL = process.env.GIGACHAT_MODEL || 'GigaChat-Lite';
const REQUEST_TIMEOUT = 60000;

let cachedToken = null;
let cachedExpiresAt = 0;

function createAgent() {
  const rootCert = resolve('server/certs/russian_trusted_root_ca.cer');
  const subCert = resolve('server/certs/russian_trusted_sub_ca.cer');

  const ca = [];
  if (existsSync(rootCert)) ca.push(readFileSync(rootCert));
  if (existsSync(subCert)) ca.push(readFileSync(subCert));

  if (ca.length > 0) {
    return new https.Agent({ ca, rejectUnauthorized: true });
  }

  // TODO: add real Russian CA certs for production
  console.warn('⚠️ SSL verification disabled for GigaChat — fix before production');
  return new https.Agent({ rejectUnauthorized: false });
}

const agent = createAgent();

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, dispatcher: agent });
    return res;
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

  const res = await fetchWithTimeout(OAUTH_URL, {
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

  const res = await fetchWithTimeout(CHAT_URL, {
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
      temperature: 0.87,
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

export async function generateScenarios({ topic, style, duration }) {
  const messages = buildScenarioPrompt({ topic, style, duration });
  const rawText = await chatCompletion(messages);
  const parsed = parseScenariosResponse(rawText);

  if (!parsed.ok) {
    throw makeError('PARSE_ERROR', 'Failed to parse LLM response');
  }

  return {
    ok: true,
    data: { scenarios: parsed.scenarios },
    credits_used: CREDITS_COST,
  };
}

export async function generateIdeas({ niche, count = 5 }) {
  // Stub — будет реализовано в будущих спринтах
  throw makeError('PROVIDER_ERROR', 'generateIdeas not implemented yet');
}
