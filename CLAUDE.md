# CLAUDE.md — VideoAI

> Системный промпт для Claude Code. Лежит в корне репозитория.
> Обновлён 16.06.2026. Добавлены: Cosmos (3-я модель), ЮKassa, SSO Яндекс/VK, водяные знаки, промпты в JSON.

---

## ЧТО ЗА ПРОДУКТ СЕЙЧАС (важно — был пивот)

**VideoAI — AI Creative Engine для B2B.** Сервис коротких рекламных видеокреативов для селлеров маркетплейсов и малого e-commerce.

**Флоу:** фото товара (или сгенерированная картинка) → оживление в короткий клип 5-8 сек (image-to-video на fal.ai) → готовый креатив (hook / product shot), скачивается MP4.

**Было до пивота (НЕ актуально):** генератор роликов из текста со сценариями (GigaChat), картинками (Yandex ART), озвучкой (SpeechKit), раскадровкой и автопубликацией в соцсети. Этот пайплайн демонтирован в Спринте A. Подробности — `VIDEOAI_STRATEGY_V2.md` и `SPRINT_A_REPORT.md`.

**Две модели оживления:**
- **Kling 2.5 turbo** — эконом, рабочая лошадка ($0.21/ролik, 5 сек, без аудио). Заменил Wan 2.7 (Wan давал «лотерею» движения и плыл текст).
- **Veo 3.1 fast** — премиум-апселл (720p, 8 сек, аудио выключено, эффектнее).

Единый доступ через fal.ai (`@fal-ai/client`, async queue submit→poll→result).

---

## PROJECT_CONFIG

```yaml
project_name: "VideoAI"
project_description: "AI Creative Engine для B2B: короткие рекламные видеокреативы для селлеров. Фото товара → оживление в клип 5-8 сек (image-to-video, fal.ai Kling/Cosmos/Veo) → готовый креатив (hook / product shot)."
audience: "b2b"
locale: "ru"

# Дизайн
primary_color: "#10B981"      # Изумрудный
dark_color: "#0A2E1F"          # Тёмно-зелёный
bg_color: "#F7FAF8"            # Слегка зелёноватый светлый фон
fonts_display: "Manrope"
fonts_body: "Inter"
fonts_ui: "Inter"

# Фичи
auth: true
auth_method: "email_otp + sso"   # email OTP + OAuth Яндекс ID / VK ID
payments: true
payment_provider: "yookassa"   # ЮKassa v3 API (api.yookassa.ru/v3). Legacy YooMoney-webhook оставлен для переходного периода
crm: false
admin_panel: true
upload: true                   # загрузка фото товара (multer → S3)

# Инфраструктура
github_repo: "https://github.com/ddvsnegDD/videoai"
github_remote: "origin"
domain: "ddvideoai.ru"         # Активен, HTTPS, DNS через Cloudflare
hosting: "reg.cloud VPS (РФ)"  # Free Tier, Москва, Ubuntu 26.04, IP 194.226.20.185
db: "PostgreSQL 18 (локальный)" # На том же VPS, данные в РФ (152-ФЗ)
email_provider: "smtp_mailru"   # SMTP Mail.ru (smtp.mail.ru:587)
email_from: "noreply@ddvideoai.ru"
mail_hosting: "VK WorkSpace (Mail.ru)"
```

---

## Роль

Ты — опытный fullstack-разработчик и UI/UX-дизайнер. Создаёшь стильные, производительные, технически сложные веб-приложения уровня продакшн. Пишешь чистый, поддерживаемый код без лишних абстракций. Общаешься на русском.

---

## Статус спринтов (актуально)

- **Спринт 0 — ЗАВЕРШЁН.** Лендинг на Railway, домен ddvideoai.ru с HTTPS, базовая структура.
- **Спринт 1 — ЗАВЕРШЁН.** Авторизация email OTP (Brevo), JWT в httpOnly cookie, кабинет, приветственные кредиты (`WELCOME_CREDITS`, дефолт 50). Таблицы `users`, `auth_codes` (с `attempts` для brute-force защиты). Безопасность: crypto.randomInt для OTP, обязательный JWT_SECRET (без fallback), лимит 5 попыток, rate limit 60 сек, очистка протухших кодов.
- **Спринт 2 — ЗАВЕРШЁН, частично перекрыт пивотом.** Движок задач (jobs + polling + retry + watchdog + возврат кредитов), таблицы `projects` и `generation_jobs`, EditorPage. Движок задач переиспользуется и сейчас. GigaChat (`llm.js`) сохранён для Спринта B; генерация сценариев/раскадровка демонтированы.
- **Спринт 3 — ОТМЕНЁН пивотом.** Yandex ART, SpeechKit, раскадровка (storyboard), выбор голоса — удалены в Спринте A. Yandex Object Storage (S3) сохранён и используется.
- **Спринт A — ЗАВЕРШЁН (с хвостами).** Демонтаж старого пайплайна; `falVideo.js` (image-to-video); загрузка фото (`multer` → S3); тип задачи `animate`; free-попытки; переработка EditorPage/ProjectPage. **Эконом-модель заменена Wan 2.7 → Kling 2.5 turbo** (дешевле и стабильнее). **Денежная утечка закрыта** — фикс из 5 слоёв + reconciler, подтверждён сквозным тестом №2 на проде (перезапуск в середине → дочитка без второго списания, $0.21). Хвосты: проверить `seed` у Kling, прогнать Veo, переписать промпты движения (убрать `rotation`), лендинг. Детали — `SPRINT_A_REPORT.md`.
- **Спринт B — ЗАВЕРШЁН (живой тест пройден 01.06.2026).** Ветка «нет фото»: русское описание → GigaChat строит английский промпт (`buildImagePrompt`, с очисткой вывода) → картинка через **Nano Banana 2** (`fal-ai/nano-banana-2`, $0.08/картинка, 3:4) → подтверждение → существующее оживление (Kling/Veo). `llm.js` починен (убран мёртвый `scenario.js`). Новое: `falImage.js`, тип задачи `image`, `CREDITS_IMAGE` (13), `free_image` (пробник на картинку). Сквозной путь text→image→animate проверен живьём, качество — лучшее за проект (текст на сгенерированной картинке пережил оживление). **Важно для позиционирования:** путь «генерация» создаёт иллюстрацию ПО ОПИСАНИЮ, а не реальный товар пользователя.
  - Хвосты: пропорции — генерация/Kling дают 3:4, Veo форсит 9:16 (не обрезает товар, достраивает фон — см. ниже); SSL-сертификаты GigaChat (`rejectUnauthorized:false` — долг до боевого запуска); лендинг.
- **Veo на проде — ПРОВЕРЕН (02.06.2026).** Премиум-модель наконец запущена вживую: 8 сек, 720×1280 (9:16), без аудио, ~$1.20/ролик. Текст идеально цел, выраженный кинематографичный наезд, качество — лучшее за проект, апселл оправдан. Форс `aspect_ratio:'9:16'` на менее вертикальном фото **не обрезает товар, а достраивает окружение** (фон/стол) — старый страх про обрезку снят.
- **Удаление проектов + ErrorBoundary (02.06.2026).** `DELETE /api/projects/:id` (проверка владельца, 409 при активной генерации, S3-cleanup best-effort, FK CASCADE на `generation_jobs`, `payments` не трогает). `<ErrorBoundary>` в `App.jsx` — защита от белого экрана при краше рендера.
- **Спринт 6 — ЗАВЕРШЁН. Платежи мигрированы на ЮKassa (актуально).** Биллинг через **ЮKassa v3 API** (`api.yookassa.ru/v3`, Basic Auth shopId:secretKey). Поток: `POST /api/payments/create` → redirect на ЮKassa → `POST /api/payments/yookassa/webhook` → **верификация GET-запросом** `GET /payments/{id}` (телу вебхука не доверяем) → идемпотентное начисление по `yookassa_payment_id` (UNIQUE-индекс, atomic TX + ON CONFLICT DO NOTHING). Дополнительно `Idempotence-Key` header при создании платежа. Reconciler платежей каждые 120с: pending старше 5 мин проверяет, TTL 1 час → cancel. Фронт полит статус через `GET /api/payments/order/:id/status`. **Тарифы:** 3 пакета — Hook Pack (599 ₽ / 120 кр.), Product Shots (1 099 ₽ / 240 кр.), Seller (1 599 ₽ / 360 кр.), источник истины `src/data/tariffs.js`. Legacy ЮMoney-webhook (`POST /api/payments/yoomoney-webhook`) оставлен на переходный период. Чеки НПД: очередь `pending_receipts` (выставление вручную через «Мой налог» — ЮKassa-авточеки для самозанятых отключены с 01.01.2026).
- **Спринт C — ЗАВЕРШЁН И ЗАДЕПЛОЕН (03-05.06.2026).** Редизайн фронтенда через Claude Design: новый B2B-лендинг (7 секций, адаптив, демо-видео), обновлённые Layout/Dashboard/Editor в glass-дизайне, фронт-гейт админки (`adminConfig.js` + `AdminRoute`). Мерж с бэкенд-логикой: EditorPage и DashboardPage работают через реальные API (upload, jobs, polling, кредиты, пробники). Тарифы сведены к 3 пакетам (единый источник `tariffs.js`). ErrorBoundary восстановлен, двойной BrowserRouter исправлен. Осиротевшие файлы почищены.
- **Миграция на reg.cloud VPS (РФ) — ЗАВЕРШЕНА (05.06.2026).** Переезд с Railway (США) → reg.cloud VPS (Москва) для локализации ПДн по 152-ФЗ. PostgreSQL 18 локально, Nginx + Let's Encrypt, PM2. DNS перенаправлен. Railway выведен из эксплуатации.
- **Спринт 7 — АКТУАЛЕН (ТЗ готовы, не исполнены).** Разбит на два блока:
  - **Блок 1:** Админка — доработка AdminPage (ТЗ `SPRINT_7_BLOCK1_ADMIN_PROMPT.md`).
  - **Блок 2:** Юр-страницы (`/oferta`, `/privacy`, `/consent`) + правки текстов BillingPage (убрать ложное «выставление чеков»). ТЗ `SPRINT_7_BLOCK2_SITE_PROMPT.md` + документы-болванки готовы.

> При работе над новым спринтом не ломай и не переписывай код завершённых спринтов без явного указания.

---

## Принципы работы

### Дизайн
- **Стиль:** современный минимализм с премиальными акцентами (glassmorphism, мягкие тени, микро-анимации)
- **Mobile-first:** все компоненты адаптивны, тестируй на 375px / 768px / 1440px
- **Типографика:** Manrope для заголовков, Inter для текста и UI
- **Скругления:** карточки 16-20px, кнопки/инпуты 10px
- **Тени:** многослойные (`0 4px 16px rgba(16,185,129,0.08)` стандарт)
- **Цвета:** все из объекта `C` в `theme.js`
- **Анимации:** `transition: all 0.2s ease`, IntersectionObserver для scroll-reveal

### Код
- Без лишних комментариев. Код читается через имена
- Без лишних абстракций. 3 похожие строки лучше преждевременной генерализации
- Без фиче-флагов и обратной совместимости
- Inline styles через объект `C` для динамических стилей, `global.css` для переиспользуемых
- Данные отдельно от компонентов (`src/data/`, `src/lib/`)

### Производительность
- Lazy-loading тяжёлых страниц через `React.lazy()` + `<Suspense>`
- Динамические imports для больших данных (>50 КБ)
- Целевой размер чанка <50 КБ gzip

---

## Технический стек

### Frontend
```
React 19 + Vite 8
React Router DOM 7
Lucide React (иконки)
global.css + inline styles через C из theme.js
Google Fonts: Manrope + Inter
```

### Backend
```
Express 5 (ESM)
PostgreSQL — пользователи, проекты, задачи генерации, платежи
JWT в httpOnly cookie (jsonwebtoken + cookie-parser)
multer — multipart upload фото товара
Brevo — email
ЮMoney-кошелёк — платежи (Quickpay + HTTP-уведомления, проверка подписи sign)
Yandex Object Storage (S3-совместимое) — хранение фото и видео
```

### AI-провайдеры (текущие)
```
fal.ai (@fal-ai/client) — image-to-video:
  - Kling 2.5 turbo (fal-ai/kling-video/v2.5-turbo/standard/image-to-video) — эконом (заменил Wan 2.7)
  - Veo 3.1 fast (fal-ai/veo3.1/fast/image-to-video) — премиум
fal.ai — text-to-image: **Nano Banana 2** (`fal-ai/nano-banana-2`, $0.08/картинка, поддерживает seed, выход 3:4) — реализовано в Спринте B
GigaChat (llm.js) — LLM. Активен в Спринте B: `buildImagePrompt` (русское описание → английский промпт картинки, с очисткой вывода и проверкой на кириллицу). `scenario.js` удалён.
Nano Banana 2 (falImage.js) — text-to-image, $0.08/картинка, выход 3:4, поддерживает seed.
```

### Легаси / вне текущего скоупа
```
Yandex ART (image.js)     — УДАЛЁН в Спринте A
Yandex SpeechKit (tts.js) — УДАЛЁН в Спринте A (своя озвучка — поздний слой)
Kandinsky Video (video.js)— перекрыт falVideo.js, считать мёртвым (не подтверждено удаление файла)
FFmpeg (editor.js)        — отложен до premium «ролик под ключ» (Этап 5)
Соцсети (vk.js / telegram.js / max.js, PublishPage, SocialConnector, PublishScheduler)
                          — пивот не трогал; текущий продукт = скачивание MP4, не автопубликация.
                            Считать отложенным легаси, в новом флоу не использовать.
```

> Перед работой со стеком сверяйся с `SPRINT_A_REPORT.md` (точный список удалённого/добавленного) и `AI_PROVIDERS.md`.

---

## Структура проекта

```
videoai/
├── index.html
├── package.json                # type: "module"
├── server.js                   # Express: API + статика
├── vite.config.js
├── ecosystem.config.cjs        # PM2 конфиг (ОБЯЗАТЕЛЬНО .cjs, не .js — ESM проект)
├── DEPLOY.md                   # Инструкция деплоя на VPS
├── .env.example                # Шаблон переменных окружения (23 ключа)
├── nginx/videoai.conf          # Конфиг Nginx reverse-proxy
├── CLAUDE.md                   # Этот файл
├── PROJECT.md                  # Описание продукта
├── ROADMAP.md                  # План спринтов
├── AI_PROVIDERS.md             # Контракты AI-провайдеров
├── VIDEOAI_STRATEGY_V2.md      # Стратегия (актуальна)
├── SPRINT_A_REPORT.md          # Отчёт пивота (актуален)
│
├── server/
│   ├── db.js                   # PostgreSQL: pool, initDB (+ free_wan/free_veo)
│   ├── email.js                # Brevo
│   ├── auth.js                 # JWT, OTP (sanitizeUser отдаёт free_wan/free_veo)
│   ├── storage.js              # S3 (uploadBuffer, deleteByPrefix)
│   ├── jobs.js                 # Очередь задач (тип 'animate', free-tries)
│   ├── payments.js             # ЮMoney-кошелёк: Quickpay, verifyYooMoneySign (HMAC-SHA256), webhook, идемпотентность по operation_id
│   └── providers/
│       ├── falVideo.js         # ★ fal.ai Kling/Veo, image-to-video, submit→poll→result
│       ├── falImage.js         # ★ fal.ai Nano Banana 2, text-to-image (extractImageUrl: 6 fallback-путей)
│       ├── llm.js              # GigaChat: buildImagePrompt (рус→англ промпт, очистка). scenario.js удалён
│       └── (legacy, см. раздел выше: video.js, editor.js, vk.js, telegram.js, max.js — если ещё на диске)
│
├── public/
│   └── images/
│
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles/global.css
    ├── data/
    │   └── tariffs.js          # ★ Единый источник тарифов: 3 пакета (hook/product_shots/seller)
    ├── components/
    │   ├── Layout.jsx          # Glass-шапка кабинета (Outlet), пункт «Админ» по isAdmin(), скрыта на гостевых
    │   ├── Btn.jsx
    │   └── (legacy: SocialConnector.jsx, PublishScheduler.jsx — вне скоупа)
    ├── lib/
    │   ├── auth.jsx            # AuthProvider
    │   ├── adminConfig.js      # ADMIN_EMAILS + isAdmin() — фронт-гейт админки
    │   ├── theme.js            # Палитра C
    │   ├── hooks.js            # useReveal, useJobPolling
    │   └── api.js              # fetch-обёртка
    └── pages/
        ├── HomePage.jsx        # ★ B2B-лендинг (7 секций: Hero+виджет, метрики, шаги, экономика, тарифы из PACKAGES, FAQ, CTA)
        ├── LoginPage.jsx       # Email OTP
        ├── DashboardPage.jsx   # ★ Реальные проекты из API, hover-play видео, glass-дизайн, удаление с подтверждением
        ├── EditorPage.jsx      # ★ 3-колоночный UI: фото/текст → движение → модель + монитор; реальные API (upload, jobs, polling, кредиты)
        ├── ProjectPage.jsx     # видео-плеер + скачать (не подключён к роутинг, legacy)
        ├── BillingPage.jsx     # ★ 3 пакета из tariffs.js + реальная оплата ЮMoney + история
        ├── AdminPage.jsx       # Админка (⚠ мёртвые ветки storyboard/regenerate_scene — Sprint 7 Блок 1)
        └── (legacy: PublishPage.jsx — вне скоупа)
```

---

## Паттерны

### Дизайн-система (theme.js)
```javascript
export const C = {
  primary: '#10B981',
  primaryDark: '#059669',
  primaryLight: '#D1FAE5',
  dark: '#0A2E1F',
  bg: '#F7FAF8',
  white: '#FFFFFF',
  gray100: '#F0F2F1',
  gray200: '#E4E7E5',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
};
```

### Задачи генерации — polling-модель

Оживление занимает 30 сек — несколько минут. Не блокируем HTTP-запросом:

1. `POST /api/jobs` (type `animate`) — создаёт запись в `generation_jobs`, возвращает `job_id`, запускает фоновую обработку. Проверяет free-попытку (`free_wan`/`free_veo`); если есть — кредиты не списываются. **Дедуп:** перед сабмитом проверяет активную задачу (user+project) и `idempotency_key` (partial UNIQUE индекс `uniq_active_job`); повторный клик не создаёт второй запрос в fal. Лимит `MAX_CONCURRENT_JOBS_PER_USER = 2`.
2. `GET /api/jobs/:id` — отдаёт `{ status, progress, result_url }`.
3. Фронт через `useJobPolling(jobId)` опрашивает каждые 2 секунды.
4. falVideo.js внутри задачи: задаётся явный `seed` (для воспроизводимости); `fal.queue.submit` → **`fal_request_id` сохраняется СРАЗУ, до поллинга** → цикл `fal.queue.status` → `fal.queue.result` → скачать видео → перезалить в S3.
5. **Возврат кредитов/free — только при реальном `FAILED` от fal**, идемпотентно (флаг `refunded`). По нашему таймауту поллинга — НЕ рефандим и НЕ пере-сабмитим, оставляем задачу `running` для reconciler.
6. **Reconciler** (`startReconciler`, каждые 90 c) подбирает «осиротевшие» задачи по `fal_request_id`, дочитывает у fal (COMPLETED→S3→done, FAILED→refund). 404 от fal = terminal failure. Это спасает результаты, за которые уже заплачено.
7. **Watchdog** убивает только задачи БЕЗ `fal_request_id` (не дошедшие до submit); с `fal_request_id` ведёт reconciler.

> Зачем так сложно: fal списывает за **выполненный** запрос независимо от того, забрало ли приложение результат. Без этих слоёв зависшие поллинги и повторные клики утекают в деньги (на тесте утекло $3 = 6 роликов вместо одного).

Хук:
```javascript
export function useJobPolling(jobId) {
  const [job, setJob] = useState(null);
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const tick = async () => {
      if (!active) return;
      const r = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
      setJob(r);
      if (r.status === 'pending' || r.status === 'running') {
        setTimeout(tick, 2000);
      }
    };
    tick();
    return () => { active = false; };
  }, [jobId]);
  return job;
}
```

### Параметры fal (по-модельно — имена полей РАЗНЫЕ)
- **Kling 2.5 turbo (эконом):** `duration:'5'` (строка!), `negative_prompt` (целевой по тексту), `cfg_scale:0.5` (строгость следования промпту). Нет `enable_prompt_expansion`, аудиодорожки нет. **`seed` — проверить, поддерживает ли Kling** (в текущем Input его нет). Эндпоинт `fal-ai/kling-video/v2.5-turbo/standard/image-to-video`. ~$0.21/ролик.
- **Veo:** `resolution:'720p'`, `duration:'8s'` (строка с суффиксом), `generate_audio:false` (по умолчанию true!), `aspect_ratio:'9:16'`, `negative_prompt`. Проверен на проде: 8с, 720×1280, без аудио, ~$1.20; 9:16 не обрезает товар, а достраивает фон.
- **seed:** задаётся явно и сохраняется (`generation_jobs.seed`, `projects.brief`). Без него — лотерея движения.
- **negative_prompt:** целиться в текст (`warped text, distorted lettering, deformed logo`), а не `text overlay`. Промпты `MOTION_PRESETS` держат товар лицом к камере, без `rotation` (иначе «вентилятор»).
- Финальный `input` логировать перед submit.

### Авторизация
email → POST `/api/auth/send-code` → код → verify → JWT cookie.

### Кнопки (Btn.jsx)
```jsx
<Btn variant="primary" size="lg">Создать креатив</Btn>
<Btn variant="outline" disabled={loading}>Отмена</Btn>
```

---

## Серверная часть

### server.js — структура
```javascript
import express from 'express';
import cookieParser from 'cookie-parser';
import { resolve, join } from 'path';
import pool, { initDB } from './server/db.js';

const app = express();
const DIST = resolve('dist');

app.set('trust proxy', 1);       // за Nginx reverse-proxy
app.use(express.json());
app.use(cookieParser());

// 1. Health
// 2. Auth (send-code, verify, me, logout)
// 3. Upload (POST /api/upload — multer multipart → S3)
// 4. Config (GET /api/config — модели + пресеты движения + цены)
// 5. Projects CRUD
// 6. Jobs (POST type='animate' с проверкой free-tries, polling, отмена)
// 7. Payments (ЮMoney: POST /create → Quickpay URL; POST /yoomoney-webhook → проверка sign + начисление; GET /history)
// 8. Admin

// 9. Статика + SPA fallback (ВСЕГДА ПОСЛЕДНИМ)
app.use(express.static(DIST));
app.get('/{*splat}', (req, res) => res.sendFile(join(DIST, 'index.html')));

async function start() {
  if (process.env.DATABASE_URL) {
    try { await initDB(); } catch (err) { console.warn('DB not available'); }
  }
  app.listen(process.env.PORT || 3000);
}
start();
```

### Схема БД — ключевые таблицы

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user',
  credits INTEGER DEFAULT 0,
  free_wan INTEGER DEFAULT 1,        -- бесплатная пробная генерация Wan/Kling (эконом)
  free_veo INTEGER DEFAULT 1,        -- бесплатная пробная генерация Veo (премиум)
  free_image INTEGER DEFAULT 1,      -- бесплатная пробная генерация картинки (Спринт B)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,        -- блок после 5 попыток
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  template_id VARCHAR(50),
  brief JSONB NOT NULL,              -- { source:'upload', image_url, model, motion, video_url }
  result_url TEXT,                   -- URL готового MP4 в S3
  status VARCHAR(20) DEFAULT 'draft',-- 'draft' | 'ready'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,         -- 'animate' (актуальный); 'image' добавится в Спринте B
  status VARCHAR(20) DEFAULT 'pending', -- pending | running | done | failed
  progress INTEGER DEFAULT 0,
  input JSONB NOT NULL,              -- содержит _freeColumn для возврата при сбое
  output JSONB,
  error TEXT,
  cost_credits INTEGER DEFAULT 0,
  seed BIGINT,                       -- сид генерации (воспроизводимость)
  fal_request_id TEXT,               -- id запроса в очереди fal (возобновление/сверка)
  last_polled_at TIMESTAMPTZ,        -- для reconciler
  idempotency_key TEXT,              -- дедуп; partial UNIQUE по активным
  refunded BOOLEAN DEFAULT FALSE,    -- идемпотентный возврат
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- partial UNIQUE: не более одной активной задачи на ключ (защита от гонок/двойных кликов)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_job ON generation_jobs (idempotency_key)
  WHERE status IN ('pending','running') AND idempotency_key IS NOT NULL;

CREATE TABLE payments (             -- ЮKassa (+ legacy YooMoney поля)
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  package_id TEXT,                   -- из tariffs.js (hook / product_shots / seller)
  label TEXT,                        -- legacy YooMoney (userId:packageId:nonce)
  expected_amount NUMERIC,           -- цена пакета
  paid_amount NUMERIC,               -- фактически оплачено
  operation_id TEXT,                 -- legacy YooMoney
  credits_granted INTEGER,
  status TEXT DEFAULT 'pending',     -- pending / completed / mismatch / canceled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  -- колонки ЮKassa-миграции:
  provider TEXT DEFAULT 'yoomoney',  -- 'yookassa' | 'yoomoney'
  yookassa_payment_id TEXT,          -- id платежа ЮKassa (идемпотентность)
  refunded BOOLEAN DEFAULT FALSE,
  receipt_status TEXT DEFAULT 'not_needed',  -- статус чека НПД
  idempotence_key TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_yookassa_payment_id ON payments (yookassa_payment_id)
  WHERE yookassa_payment_id IS NOT NULL;   -- одно начисление на платёж ЮKassa

-- Очередь чеков НПД (выставление вручную через «Мой налог»):
CREATE TABLE pending_receipts (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id),
  user_email TEXT,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Легаси (соцсети, вне текущего скоупа): social_connections, publications.
```

---

## Кредитная модель

Генерация платная — кредиты. Стоимость читается из env при старте:

- **Kling 2.5 (эконом):** `CREDITS_WAN` (дефолт 40) — имя переменной осталось от Wan, но управляет Kling-тарифом; факт ~$0.21/ролик
- **Veo (премиум):** `CREDITS_VEO` (дефолт 90)
- **Картинка (Спринт B):** `CREDITS_IMAGE` (дефолт 13); факт ~$0.08/картинка Nano Banana
- **Пробник:** `free_wan` / `free_veo` / `free_image` = по 1 на старте — не списывают кредиты. _freeColumn различает все три.
- Приветственные кредиты: `WELCOME_CREDITS` (дефолт 50).
- При сбое генерации — кредиты или free-попытка возвращаются.

**Тарифы (актуальная сетка — 3 пакета с универсальными кредитами):**
- **Hook Pack** — 599 ₽ / 120 кредитов (≈3 эконом-ролика)
- **Product Shots** — 1 099 ₽ / 240 кредитов (≈6 эконом / 2 премиум)
- **Seller** — 1 599 ₽ / 360 кредитов (≈9 эконом / 4 премиум), popular

Источник истины — `src/data/tariffs.js`. Бэкенд читает этот файл напрямую (`getPackageById`), фронту не доверяет.

---

## Vite конфигурация
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
```

---

## CSS — организация global.css
```css
/* ====== RESET + BASE ====== */
/* ====== LAYOUT ====== */
/* ====== TYPOGRAPHY ====== */
/* ====== BUTTONS ====== */
/* ====== FORMS ====== */
/* ====== CARDS ====== */
/* ====== EDITOR ====== */
/* ====== PROGRESS ====== */
/* ====== PAGE-SPECIFIC ====== */
/* ====== UTILITIES ====== */
/* ====== RESPONSIVE ====== */
```

### Glassmorphism карточка (с зелёным акцентом)
```css
.card-glass {
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(16, 185, 129, 0.08);
}
```

---

## Инфраструктура — reg.cloud VPS (РФ)

### Сервер
- **reg.cloud Free Tier C1-M1-D10** — 1 vCPU / 1 ГБ RAM / 10 ГБ NVMe + swap 2 ГБ.
- **Ubuntu 26.04 LTS**, IP `194.226.20.185`, Москва.
- **Node 22 LTS**, **PostgreSQL 18 локально** (не managed — данные в РФ, 152-ФЗ).
- **Nginx** как reverse-proxy, **HTTPS через Let's Encrypt** (certbot, автопродление).
- Процесс-менеджер **PM2**: `pm2 start ecosystem.config.cjs` — 1 экземпляр, `exec_mode: 'fork'`, `node_args: '--env-file=.env'`.
- Приложение работает под пользователем `deploy` в `/home/deploy/app`.
- DNS — **Cloudflare**, A-записи `ddvideoai.ru` + `www` → `194.226.20.185`, **режим DNS only** (серое облако; SSL терминируется на сервере).
- **Yandex Object Storage** (бакет `videoai-media`) — без изменений, файлы в РФ.

### Правки кода под VPS
- `server.js`: добавлен `app.set('trust proxy', 1)` — приложение за Nginx.
- `server/db.js`: SSL стал условным — отключается для `localhost`/`127.0.0.1` (локальный Postgres SSL не требует).
- Добавлены: `.env.example` (23 ключа), `nginx/videoai.conf`, `ecosystem.config.cjs`, `DEPLOY.md`.
- **Важно:** `ecosystem.config.cjs` (НЕ `.js`) — проект ESM (`"type": "module"`), `.js` с `module.exports` падает.

### Переменные окружения (`.env` на сервере)
```
DATABASE_URL              # postgres://... (локальный Postgres)
JWT_SECRET                # подпись JWT (перевыпущен при миграции)
# Email (SMTP Mail.ru)
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_USER=noreply@ddvideoai.ru
SMTP_PASS                  # пароль приложения Mail.ru
EMAIL_FROM=noreply@ddvideoai.ru
ADMIN_EMAIL               # промоут в admin
WELCOME_CREDITS           # приветственные кредиты (дефолт 50)
CREDITS_IMAGE             # стоимость картинки Nano Banana (дефолт 13)
GIGACHAT_AUTH_KEY         # OAuth-ключ GigaChat (активен — buildImagePrompt)
GIGACHAT_SCOPE            # scope GigaChat (дефолт GIGACHAT_API_PERS)

# fal.ai
FAL_KEY                   # единый ключ (Kling + Veo + Nano Banana)
CREDITS_WAN               # стоимость Kling-эконом (дефолт 40, имя от Wan)
CREDITS_COSMOS            # стоимость Cosmos 3 Super (дефолт 60)
CREDITS_VEO               # стоимость Veo (дефолт 90)

# S3 (Yandex Object Storage)
S3_ENDPOINT=https://storage.yandexcloud.net
S3_BUCKET=videoai-media
S3_ACCESS_KEY             # перевыпущен при миграции
S3_SECRET_KEY             # перевыпущен при миграции

# ЮKassa (платежи)
YOOKASSA_SHOP_ID
YOOKASSA_SECRET_KEY
APP_URL=https://ddvideoai.ru

# SSO (OAuth)
YANDEX_CLIENT_ID
YANDEX_CLIENT_SECRET
YANDEX_CALLBACK_URL
VK_CLIENT_ID              # VK использует PKCE, secret не нужен
VK_CALLBACK_URL

# Legacy ЮMoney (webhook оставлен на переходный период)
# YOOMONEY_WALLET
# YOOMONEY_NOTIFICATION_SECRET

NODE_ENV=production
```

> Секреты `JWT_SECRET` и ключи S3 перевыпущены при миграции (старые удалены). Legacy YooMoney-переменные закомментированы — миграция на ЮKassa завершена.
> GigaChat использует сертификат НУЦ Минцифры — сейчас `rejectUnauthorized:false` (долг безопасности).

---

## Юридический статус / 152-ФЗ

- Владелец зарегистрирован как **самозанятый (плательщик НПД)** — правовая основа для приёма платежей.
- Подготовлены юр-документы (оферта, политика конфиденциальности, согласие на ПДн) — болванки с плейсхолдерами, к публикации страницами `/oferta`, `/privacy`, `/consent` (Sprint 7 Блок 2).
- **152-ФЗ: локализация закрыта** переездом БД в РФ (reg.cloud, Москва).
- **Трансграничная передача НЕ требуется:** в оферте/политике закреплён запрет загружать изображения людей → данные, уходящие на fal.ai, персональных данных не содержат.
- **Уведомление в Роскомнадзор — в плане** (УКЭП через Госключ есть).
- Контакт: `ddv1121@yandex.ru`.
- **Переход на ЮKassa** (авто-чеки НПД) — после публикации оферты и прохождения модерации.

---

## Антипаттерны

- Не создавай документацию без запроса
- Не добавляй error handling для невозможных сценариев
- Не пиши комментарии к очевидному коду
- Не создавай utils/helpers для одноразовых функций
- Не используй CSS-in-JS библиотеки
- Не используй Redux/Zustand — useState + Context API
- Не используй TypeScript в MVP
- Не используй `alert()` — toast-уведомления
- Не блокируй HTTP-запрос на время генерации — всегда через jobs + polling
- Не храни видео/фото локально — всегда S3
- Не вызывай AI-провайдеры с фронта — только через бэк
- Не передавай параметры fal одним общим объектом — у Wan и Veo разные имена полей
- Не пере-сабмить задачу в fal по нашему таймауту — возобновляй по сохранённому `fal_request_id` (иначе платим дважды)
- Не возвращай кредиты по таймауту поллинга — только при реальном `FAILED` от fal, и идемпотентно (флаг `refunded`)
- Не сохраняй `fal_request_id` после поллинга — только СРАЗУ после submit, иначе обрыв осиротит оплаченную задачу
- Не используй `fal.subscribe` для генерации — только `fal.queue.submit` + опрос по `request_id` (subscribe не возобновляется после обрыва)
- Не полагайся на случайный seed — задавай и сохраняй явный seed; амплитуду движения чини промптом, не подбором сида
- Не возрождай удалённый в Спринте A код (Yandex ART, SpeechKit, раскадровка) без явного указания
- Не используй общую БД с другими проектами — только Postgres-DDvideoai
