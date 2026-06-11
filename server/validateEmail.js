import disposableDomains from 'disposable-email-domains';
import { BLOCKED_FOREIGN, ALLOWED_RUSSIAN } from './emailDomains.js';

const disposableSet = new Set(disposableDomains);

export function validateNewEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'Некорректный email.';

  if (disposableSet.has(domain)) {
    return 'Использование временной почты запрещено. Пожалуйста, используйте российский почтовый сервис (например, Яндекс или Mail.ru).';
  }

  if (BLOCKED_FOREIGN.has(domain)) {
    return 'Использование иностранной почты для новых аккаунтов запрещено. Пожалуйста, используйте российский почтовый сервис (например, Яндекс или Mail.ru).';
  }

  return null;
}
