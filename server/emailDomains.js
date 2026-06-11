// Конфиг доменов для валидации новых регистраций.
// Редактируйте списки — логика в validateEmail.js не меняется.

export const BLOCKED_FOREIGN = new Set([
  'gmail.com',
  'icloud.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
]);

export const ALLOWED_RUSSIAN = new Set([
  'yandex.ru',
  'ya.ru',
  'yandex.com',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',
  'internet.ru',
  'rambler.ru',
  'vk.com',
]);
