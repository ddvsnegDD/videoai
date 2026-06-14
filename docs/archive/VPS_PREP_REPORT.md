# VPS Prep Report — подготовка к переезду с Railway на VPS

## Цель
Подготовить код и конфиги к деплою на VPS (Ubuntu + Node + локальный PostgreSQL + Nginx + PM2). Серверную настройку (SSH, установка пакетов, БД, DNS) владелец делает сам.

**Дата:** 04.06.2026
**Статус:** завершён

---

## Что изменено

### 1. `server.js` — trust proxy (строка 25)

```js
app.set('trust proxy', 1);
```

**Зачем:** приложение будет за Nginx reverse proxy. Без этой строки Express не видит реальный IP клиента (`req.ip` = 127.0.0.1), `req.protocol` всегда `http`, а `secure`-кука авторизации (`secure: process.env.NODE_ENV === 'production'`) может не выставляться по HTTPS.

**Проверено:** `node --check server.js` — PASS.

### 2. `server/db.js` — условный SSL для PostgreSQL

Было:
```js
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```

Стало:
```js
const isLocalDB = /localhost|127\.0\.0\.1|\/var\/run/.test(dbUrl);
ssl: process.env.NODE_ENV === 'production' && !isLocalDB ? { rejectUnauthorized: false } : false,
```

**Зачем:** на Railway PostgreSQL требует SSL. На VPS PostgreSQL работает локально — SSL не настроен и не нужен. Старый код при `NODE_ENV=production` безусловно включал SSL, что сломало бы подключение к локальной БД.

**Логика:** если `DATABASE_URL` содержит `localhost`, `127.0.0.1` или `/var/run` (unix socket) — SSL отключается независимо от `NODE_ENV`.

### 3. Что проверено и НЕ изменено

| Элемент | Файл | Статус |
|---|---|---|
| `PORT = process.env.PORT \|\| 3000` | server.js:511 | ✅ Уже есть, оставлен |
| `DATABASE_URL` через `new Pool({ connectionString })` | server/db.js | ✅ Оставлен |
| Кука `secure: process.env.NODE_ENV === 'production'` | server.js:71 | ✅ Корректно для VPS с HTTPS |
| Платежи (payments.js) | server/payments.js | ✅ Не тронуты |
| Провайдеры (falVideo, falImage, llm) | server/providers/* | ✅ Не тронуты |
| Движок задач (jobs.js) | server/jobs.js | ✅ Не тронут |

---

## Новые файлы

### 4. `.env.example` — шаблон переменных окружения

Полный список env-ключей, извлечённый из кода (`server.js` + `server/*.js` + `server/providers/*.js`):

| Ключ | Файл-источник | Дефолт | Обязательный |
|---|---|---|---|
| `NODE_ENV` | server.js, db.js | — | Да (`production`) |
| `PORT` | server.js | `3000` | Нет |
| `DATABASE_URL` | db.js | — | Да |
| `JWT_SECRET` | auth.js | — | Да (FATAL без него) |
| `WELCOME_CREDITS` | auth.js | `50` | Нет |
| `ADMIN_EMAIL` | server.js | — | Нет |
| `BREVO_API_KEY` | email.js | — | Да (без него OTP в консоль) |
| `EMAIL_FROM` | email.js | `noreply@videoai.ru` | Нет |
| `FAL_KEY` | falVideo.js, falImage.js | — | Да |
| `CREDITS_WAN` | falVideo.js | `40` | Нет |
| `CREDITS_VEO` | falVideo.js | `90` | Нет |
| `CREDITS_IMAGE` | falImage.js | `13` | Нет |
| `GIGACHAT_AUTH_KEY` | llm.js | — | Да (для text→image) |
| `GIGACHAT_SCOPE` | llm.js | `GIGACHAT_API_PERS` | Нет |
| `GIGACHAT_MODEL` | llm.js | `GigaChat` | Нет |
| `S3_ENDPOINT` | storage.js | `https://storage.yandexcloud.net` | Нет |
| `S3_REGION` | storage.js | `ru-central1` | Нет |
| `S3_BUCKET` | storage.js, server.js | `videoai-media` | Нет |
| `S3_ACCESS_KEY` | storage.js | — | Да |
| `S3_SECRET_KEY` | storage.js | — | Да |
| `YOOMONEY_WALLET` | server.js | — | Да (для платежей) |
| `YOOMONEY_NOTIFICATION_SECRET` | server.js | — | Да (для проверки webhook) |
| `APP_URL` | server.js | `https://ddvideoai.ru` | Нет |

**Итого: 23 ключа** (11 обязательных, 12 с дефолтами).

`.env` в `.gitignore` — подтверждено.

### 5. `nginx/videoai.conf` — конфиг Nginx (образец)

- `listen 80`, `server_name ddvideoai.ru www.ddvideoai.ru`
- `client_max_body_size 25M` (загрузка фото через multer, лимит 10 MB + запас)
- `proxy_pass http://127.0.0.1:3000`
- Заголовки: `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`
- SSL (443) добавит certbot на сервере — в файле не нужно

### 6. `ecosystem.config.js` — конфиг PM2

- `instances: 1` + `exec_mode: 'fork'` — **строго один экземпляр**, т.к. приложение содержит фоновый reconciler и watchdog; несколько инстансов = двойные списания/возвраты fal
- `env: { NODE_ENV: 'production' }`

### 7. `DEPLOY.md` — памятка деплоя

5 строк: `.env` → `npm ci && npm run build` → `pm2 start` → nginx → certbot.

---

## DoD чеклист

- [x] `node --check server.js` проходит; `app.set('trust proxy', 1)` добавлен (строка 25)
- [x] `.env.example` покрывает каждый `process.env`-ключ из кода (23 ключа); `.env` в `.gitignore`
- [x] Созданы `nginx/videoai.conf`, `ecosystem.config.js`, `DEPLOY.md`
- [x] Платежи/провайдеры/движок задач не изменены; секреты не закоммичены
- [x] `server/db.js`: SSL условный — отключается для localhost/127.0.0.1 (локальный PostgreSQL на VPS)
- [x] `npm run build` проходит без ошибок (328 KB JS, 6 KB CSS)
- [x] Данный отчёт `VPS_PREP_REPORT.md` создан
