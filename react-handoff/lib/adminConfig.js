// src/lib/adminConfig.js
// Кому показывать раздел «Админ».
//
// У тебя на бэкенде уже есть роль (users.role) и переменная ADMIN_EMAIL,
// которая промоутит почту в role='admin'. Поэтому основной способ —
// проверка role==='admin'. Список почт оставлен как подстраховка/фронт-фильтр.

export const ADMIN_EMAILS = [
  'ddv1121@yandex.ru',
];

export function isAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin') return true; // основной путь (бэкенд + ADMIN_EMAIL)
  const email = user.email?.trim().toLowerCase();
  return !!email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);
}
