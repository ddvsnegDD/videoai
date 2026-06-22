import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const disposableDomains = require('disposable-email-domains');

const disposableSet = new Set(disposableDomains);

const MBV_ENABLED = process.env.MAILBOXVALIDATOR_ENABLED === 'true';
const MBV_KEY = process.env.MAILBOXVALIDATOR_API_KEY || '';

async function checkDisposableMBV(email) {
  if (!MBV_ENABLED || !MBV_KEY) return null;
  try {
    const url = `https://api.mailboxvalidator.com/v2/email/disposable?format=json&email=${encodeURIComponent(email)}&key=${encodeURIComponent(MBV_KEY)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    if (data.is_disposable === true || data.is_disposable === 'true' || data.is_disposable === 'True') return true;
    return false;
  } catch {
    return null;
  }
}

export async function validateNewEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'Некорректный email.';

  const mbv = await checkDisposableMBV(email);
  if (mbv === true) {
    return 'Использование временной почты запрещено. Пожалуйста, используйте постоянный почтовый сервис.';
  }
  if (mbv === null && disposableSet.has(domain)) {
    return 'Использование временной почты запрещено. Пожалуйста, используйте постоянный почтовый сервис.';
  }

  return null;
}

export async function validateDisposable(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'Некорректный email.';

  const mbv = await checkDisposableMBV(email);
  if (mbv === true) return 'Использование временной почты запрещено.';
  if (mbv === null && disposableSet.has(domain)) return 'Использование временной почты запрещено.';

  return null;
}
