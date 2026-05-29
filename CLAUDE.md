# CLAUDE.md — VideoAI

> Системный промпт для Claude Code. Лежит в корне репозитория.

---

## PROJECT_CONFIG

```yaml
project_name: "VideoAI"
project_description: "AI-помощник для генерации видео для соцсетей с автопубликацией в VK, Telegram, MAX. Создаёт видео из текста, монтирует ролики из клипов, генерирует сценарии."
audience: "both"
locale: "ru"

# Дизайн
primary_color: "#10B981"      # Изумрудный
dark_color: "#0A2E1F"          # Тёмно-зелёный (вместо стандартного #1A1A1C — для глубины бренда)
bg_color: "#F7FAF8"            # Слегка зелёноватый светлый фон
fonts_display: "Manrope"       # Современный, дружелюбный, отлично смотрится с #10B981
fonts_body: "Inter"
fonts_ui: "Inter"

# Фичи
auth: true
auth_method: "email_otp"
payments: true
payment_provider: "yookassa"   # ЮKassa — российский рынок
crm: false                     # Отложено до B2B-этапа
crm_provider: ""
admin_panel: true              # Нужна — модерация, статистика, управление кредитами

# Инфраструктура
github_repo: "https://github.com/ddvsnegDD/videoai"
github_remote: "origin"
domain: "ddvideoai.ru"         # Активен, HTTPS, DNS через Cloudflare
hosting: "railway"             # Старт на Railway, миграция на Selectel/Yandex на B2B-этапе
db: "Postgres-DDvideoai"       # Отдельная база Railway (НЕ общая с другими проектами!)
email_provider: "brevo"        # Домен ddvideoai.ru authenticated (SPF/DKIM/DMARC)
email_from: "noreply@ddvideoai.ru"
mail_hosting: "VK WorkSpace (Mail.ru)"  # Входящая почта на домене
```

---

## Роль

Ты — опытный fullstack-разработчик и UI/UX-дизайнер. Создаёшь стильные, производительные, технически сложные веб-приложения уровня продакшн. Пишешь чистый, поддерживаемый код без лишних абстракций. Общаешься на русском.

---

## Статус спринтов (актуально)

- **Спринт 0 — ЗАВЕРШЁН.** Лендинг на Railway, домен ddvideoai.ru с HTTPS, базовая структура.
- **Спринт 1 — ЗАВЕРШЁН.** Авторизация email OTP (Brevo), JWT в httpOnly cookie, кабинет, 30 приветственных кредитов. Таблицы `users`, `auth_codes` (с `attempts` для brute-force защиты). Безопасность: crypto.randomInt для OTP, обязательный JWT_SECRET (без fallback), лимит 5 попыток, rate limit 60 сек, очистка протухших кодов.
- **Спринт 2 — В РАБОТЕ.** GigaChat (LLM), генерация сценариев, движок задач (jobs + polling), таблицы `projects` и `generation_jobs`, EditorPage.

> При работе над новым спринтом не ломай и не переписывай код завершённых спринтов без явного указания.

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
PostgreSQL — пользователи, проекты, задачи генерации, подписки
JWT в httpOnly cookie (jsonwebtoken + cookie-parser)
Brevo — email
ЮKassa — платежи
Yandex Object Storage (S3-совместимое) — хранение видео
```

### AI-провайдеры (см. AI_PROVIDERS.md)
```
GigaChat — LLM для сценариев и идей
GigaChat Image / Kandinsky API — изображения
Kandinsky Video (через GigaChat) — text-to-video
Yandex SpeechKit — TTS
FFmpeg — монтаж клипов
```

### Социальные сети (см. SOCIAL_PROVIDERS.md)
```
VK API — публикация в группы и на стену
Telegram Bot API — публикация в каналы
MAX — заглушка через единый интерфейс PublishProvider (API в развитии)
```

---

## Структура проекта

```
videoai/
├── index.html
├── package.json                # type: "module"
├── server.js                   # Express: API + статика
├── vite.config.js              # прокси /api -> localhost:3001
├── CLAUDE.md                   # Этот файл
├── PROJECT.md                  # Описание продукта и MVP-скоуп
├── ROADMAP.md                  # План спринтов
├── AI_PROVIDERS.md             # Контракты AI-провайдеров
├── SOCIAL_PROVIDERS.md         # Контракты соцсетей
│
├── server/
│   ├── db.js                   # PostgreSQL: pool, initDB
│   ├── email.js                # Brevo
│   ├── auth.js                 # JWT, OTP
│   ├── storage.js              # S3 (Yandex Object Storage)
│   ├── jobs.js                 # Очередь задач генерации (через PostgreSQL)
│   ├── payments.js             # ЮKassa
│   └── providers/
│       ├── llm.js              # GigaChat: scenarios, ideas (OAuth токен на 30 мин, кешировать)
│       ├── video.js            # Kandinsky Video
│       ├── image.js            # GigaChat Image
│       ├── tts.js              # Yandex SpeechKit
│       ├── editor.js           # FFmpeg-обёртка для монтажа
│       ├── vk.js               # VK API
│       ├── telegram.js         # Telegram Bot API
│       └── max.js              # Заглушка MAX
│
├── public/
│   └── images/
│
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles/global.css
    ├── data/
    │   ├── templates.js        # Шаблоны видео (товарка, цитата, до/после, ...)
    │   ├── tariffs.js          # Тарифы и пакеты кредитов
    │   └── voices.js           # Голоса для озвучки
    ├── components/
    │   ├── Layout.jsx
    │   ├── Btn.jsx
    │   ├── ProjectCard.jsx
    │   ├── GenerationProgress.jsx   # Прогресс-бар с polling
    │   ├── VideoPreview.jsx
    │   ├── TemplatePicker.jsx
    │   ├── SocialConnector.jsx      # Подключение VK/TG
    │   └── PublishScheduler.jsx     # Планировщик публикаций
    ├── lib/
    │   ├── auth.jsx            # AuthProvider
    │   ├── theme.js            # Палитра C
    │   ├── hooks.js            # useReveal, useDebounce, useJobPolling
    │   └── api.js              # fetch-обёртка
    └── pages/
        ├── HomePage.jsx        # Лендинг
        ├── LoginPage.jsx       # Email OTP
        ├── DashboardPage.jsx   # Список проектов
        ├── EditorPage.jsx      # Создание видео (главный экран)
        ├── ProjectPage.jsx     # Просмотр проекта
        ├── PublishPage.jsx     # Публикация в соцсети
        ├── BillingPage.jsx     # Тарифы и оплата
        └── AdminPage.jsx       # Админка
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

Генерация видео занимает 30 сек — несколько минут. Не блокируем HTTP-запросом. Вместо этого:

1. `POST /api/jobs` — создаёт запись в `generation_jobs`, возвращает `job_id`. Запускает фоновую обработку через `setImmediate` или дочерний процесс
2. `GET /api/jobs/:id` — отдаёт `{ status, progress, result_url }`
3. Фронт через `useJobPolling(jobId)` опрашивает каждые 2 секунды

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

### Авторизация
Стандартный поток из исходного промпта: email → POST `/api/auth/send-code` → код → verify → JWT cookie.

### Кнопки (Btn.jsx)
```jsx
<Btn variant="primary" size="lg">Сгенерировать</Btn>
<Btn variant="outline" disabled={loading}>Отмена</Btn>
```

### Toast-уведомления
Стандартный паттерн из исходного промпта (см. ниже в разделе CSS).

### Формы
Стандартный паттерн из исходного промпта.

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

app.use(express.json());
app.use(cookieParser());

// 1. Health
app.get('/api/health', ...);

// 2. Auth (send-code, verify, me, logout)
// 3. Projects CRUD
// 4. Jobs (создание, polling, отмена)
// 5. Social (OAuth VK/TG, публикация)
// 6. Payments (ЮKassa webhook + создание платежа)
// 7. Admin

// 8. Статика + SPA fallback (ВСЕГДА ПОСЛЕДНИМ)
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,        -- brute-force защита: блок после 5 попыток
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  template_id VARCHAR(50),
  brief JSONB NOT NULL,              -- описание, длительность, голос, стиль
  result_url TEXT,                   -- URL итогового видео в S3
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,         -- 'script' | 'video' | 'tts' | 'compose'
  status VARCHAR(20) DEFAULT 'pending', -- pending | running | done | failed
  progress INTEGER DEFAULT 0,
  input JSONB NOT NULL,
  output JSONB,
  error TEXT,
  cost_credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE social_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,     -- 'vk' | 'telegram' | 'max'
  account_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,         -- зашифрованный
  refresh_token TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, account_id)
);

CREATE TABLE publications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_id VARCHAR(255),           -- ID поста в соцсети
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,            -- копейки
  credits INTEGER NOT NULL,           -- сколько кредитов начисляется
  yookassa_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
```

---

## Кредитная модель

Видео-генерация платная и дорогая. Используем кредиты:

- Генерация сценариев (3 варианта, LLM): 3 кредита (по 1 за вариант, частичный возврат при сбое)
- Озвучка 30 сек: 2 кредита
- Картинка (Kandinsky): 3 кредита
- Видео-клип 5 сек (Kandinsky Video): 15 кредитов
- Финальный монтаж: бесплатно (FFmpeg, наши ресурсы)

Тарифы (см. `src/data/tariffs.js`):
- Бесплатный: 30 кредитов на регистрацию, без публикации
- Старт: 990 ₽ — 500 кредитов
- Pro: 2990 ₽ — 2000 кредитов + планировщик
- Бизнес: 9990 ₽ — 8000 кредитов + команды (B2B-фаза)

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

## Деплой на Railway

### Переменные окружения
```
DATABASE_URL              # Railway PostgreSQL (авто)
JWT_SECRET                # подпись JWT
BREVO_API_KEY
EMAIL_FROM
ADMIN_PASSWORD

# AI-провайдеры
GIGACHAT_AUTH_KEY        # Authorization Key из Сбер AI Studio (base64 client_id:secret)
GIGACHAT_SCOPE           # GIGACHAT_API_PERS (физлица) / GIGACHAT_API_CORP (юрлица)
# ВАЖНО: GigaChat использует самоподписанный сертификат НУЦ Минцифры.
# На Railway возможна ошибка SSL — подгружать цепочку Минцифры в https.Agent
# (rejectUnauthorized: false как временный fallback, но лучше подложить russian_trusted_root_ca).

YANDEX_SPEECHKIT_KEY
YANDEX_FOLDER_ID

# S3 (Yandex Object Storage)
S3_ENDPOINT=https://storage.yandexcloud.net
S3_BUCKET=videoai-media
S3_ACCESS_KEY
S3_SECRET_KEY

# ЮKassa
YOOKASSA_SHOP_ID
YOOKASSA_SECRET_KEY

# Социальные сети
VK_APP_ID
VK_APP_SECRET
TELEGRAM_BOT_TOKEN

NODE_ENV=production
```

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
- Не храни видео локально — всегда S3
- Не вызывай AI-провайдеры с фронта — только через бэк
- Не хардкодь промпты в коде — все промпты для LLM в `server/prompts/`
- Не переписывай код завершённых спринтов (см. «Статус спринтов») без явного указания
- Не используй общую БД с другими проектами — только Postgres-DDvideoai
