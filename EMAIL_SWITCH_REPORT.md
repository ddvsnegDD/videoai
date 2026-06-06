# Email Switch Report — Brevo → SMTP Mail.ru (nodemailer)

## Причина
Уход с Brevo (Франция/ЕС) для исключения трансграничной передачи ПДн. SMTP Mail.ru — серверы в РФ.

**Дата:** 06.06.2026
**Статус:** завершён (код готов, на сервере нужно прописать SMTP-переменные)

---

## Изменённые файлы

### 1. `server/email.js` — полностью переписан

**Было:** Brevo HTTP API (`fetch` → `https://api.brevo.com/v3/smtp/email`, ключ `BREVO_API_KEY`).

**Стало:** nodemailer SMTP-транспорт через `smtp.mail.ru:587` (STARTTLS).

```js
nodemailer.createTransport({
  host: SMTP_HOST,       // smtp.mail.ru
  port: SMTP_PORT,       // 587
  secure: false,         // STARTTLS (не SSL)
  requireTLS: true,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});
```

- **Сигнатура `sendOTPEmail(to, code)`** — сохранена 1:1, `auth.js` не менялся
- **HTML-шаблон** — перенесён без изменений (вёрстка, `${code}`, копирайт `${new Date().getFullYear()}`)
- **Console-fallback** — если `SMTP_USER` или `SMTP_PASS` не заданы → `console.warn` + `console.log('[OTP]')` + `return { ok: true, mock: true }`
- **Ошибка SMTP** → `console.error('SMTP error:', err)` + `throw new Error('Failed to send email')`

### 2. `package.json` — добавлен `nodemailer`

Единственная новая зависимость.

### 3. `.env.example` — обновлены переменные email

**Убрано:**
```
BREVO_API_KEY=
```

**Добавлено:**
```
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_USER=noreply@ddvideoai.ru
SMTP_PASS=
EMAIL_FROM=noreply@ddvideoai.ru
```

---

## Переменные окружения (нужны на сервере)

| Переменная | Значение | Обязательна |
|---|---|---|
| `SMTP_HOST` | `smtp.mail.ru` (default) | нет (дефолт) |
| `SMTP_PORT` | `587` (default) | нет (дефолт) |
| `SMTP_USER` | `noreply@ddvideoai.ru` | **да** |
| `SMTP_PASS` | app-password Mail.ru | **да** |
| `EMAIL_FROM` | `noreply@ddvideoai.ru` (default = SMTP_USER) | нет (дефолт) |

Старую `BREVO_API_KEY` можно удалить из `.env`.

---

## Что НЕ изменено

| Элемент | Файл | Статус |
|---|---|---|
| Сигнатура `sendOTPEmail(to, code)` | server/email.js | ✅ Сохранена |
| Импорт и вызов в auth.js | server/auth.js | ✅ Не тронут |
| HTML-шаблон письма | server/email.js | ✅ 1:1 перенесён |
| Авторизация (JWT, OTP) | server/auth.js | ✅ Не тронута |
| Движок задач / money-leak | server/jobs.js | ✅ Не тронут |
| Платежи | server/payments.js | ✅ Не тронуты |
| Фронтенд | src/ | ✅ Не тронут |

---

## Тесты

| Тест | Результат |
|---|---|
| `node --check server/email.js` | PASS |
| `node --check server.js` | PASS |
| `npx vite build` | PASS (1639 модулей, 337 KB JS) |
| `auth.js` import unchanged | PASS (`sendOTPEmail` на месте) |

---

## DoD

- [x] `nodemailer` в `package.json`
- [x] `server/email.js` использует SMTP (nodemailer), Brevo-кода нет
- [x] Сигнатура `sendOTPEmail(to, code)` не изменена; `auth.js` не трогали
- [x] HTML-шаблон сохранён 1:1
- [x] Console-fallback работает при отсутствии SMTP-переменных
- [x] `node --check server/email.js` — без ошибок
- [x] `npx vite build` — без ошибок
- [x] Данный отчёт `EMAIL_SWITCH_REPORT.md` создан

---

## Деплой (вручную на сервере)

1. `git pull`
2. `npm ci` (нужен — добавлена зависимость `nodemailer`)
3. В `.env`:
   - Добавить: `SMTP_HOST=smtp.mail.ru`, `SMTP_PORT=587`, `SMTP_USER=noreply@ddvideoai.ru`, `SMTP_PASS=<app-password>`, `EMAIL_FROM=noreply@ddvideoai.ru`
   - Удалить или очистить: `BREVO_API_KEY`
4. `npm run build`
5. `pm2 restart videoai`
6. Тест: запросить код входа → проверить что письмо пришло с `noreply@ddvideoai.ru`
