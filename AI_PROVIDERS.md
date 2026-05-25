# AI_PROVIDERS.md — VideoAI

Документ описывает единый интерфейс работы с AI-провайдерами. Цель — изолировать бизнес-логику от конкретного провайдера, чтобы можно было заменить Kandinsky на YandexART одной правкой.

---

## Принципы

1. Каждый провайдер живёт в `server/providers/`
2. У каждого есть **одна точка входа** — экспортируемая функция с типизированным контрактом
3. Все вызовы — асинхронные, возвращают `{ ok, data, error }` или бросают типизированные ошибки
4. Стоимость в кредитах — константа в файле провайдера
5. Промпты — отдельно в `server/prompts/`, не хардкодим

---

## LLM: GigaChat (сценарии и идеи)

**Файл:** `server/providers/llm.js`

**Авторизация:** OAuth 2.0, токен на 30 минут. Кешируем в памяти.

```javascript
// Контракт
export async function generateScenarios({ topic, style, duration }) {
  // → returns { scenarios: [{ title, description, scenes: [...] }, ...] }
}

export async function generateIdeas({ niche, count = 5 }) {
  // → returns { ideas: [{ title, hook, format }, ...] }
}

export async function rewriteText({ text, tone }) {
  // → returns { text }
}
```

**Стоимость:** 1 кредит за вызов.

**Эндпоинты:**
- `https://ngw.devices.sberbank.ru:9443/api/v2/oauth` — токен
- `https://gigachat.devices.sberbank.ru/api/v1/chat/completions` — чат

**Промпт-файлы:**
- `server/prompts/scenario.js` — генерация 3 вариантов сценария по теме
- `server/prompts/ideas.js` — генерация идей контента
- `server/prompts/rewrite.js` — переписать в нужном тоне

---

## Image: Kandinsky 5.0 (генерация картинок)

**Файл:** `server/providers/image.js`

```javascript
export async function generateImage({ prompt, style, aspectRatio = '9:16' }) {
  // → returns { url } — URL изображения в нашем S3
}
```

**Стоимость:** 3 кредита.

**Реализация:**
1. Зовём API Сбера
2. Получаем base64 или URL картинки
3. Загружаем в наш Yandex Object Storage
4. Возвращаем подписанный URL из нашего бакета

**Почему перекладываем в S3:** URL от Сбера могут быть временными, нам нужно постоянное хранилище для итоговых видео.

---

## Video: Kandinsky Video (text-to-video)

**Файл:** `server/providers/video.js`

```javascript
export async function generateVideoClip({ prompt, duration = 5, aspectRatio = '9:16' }) {
  // → returns { url } — URL MP4 в нашем S3
}
```

**Стоимость:** 15 кредитов за клип 5 сек.

**Особенности:**
- Долгая операция (1-3 минуты), вызывается из контекста job
- API может вернуть `task_id` — тогда poll'им провайдера каждые 10 сек
- При timeout (> 5 минут) — задача fails

---

## TTS: Yandex SpeechKit (синтез речи)

**Файл:** `server/providers/tts.js`

```javascript
export async function synthesize({ text, voice = 'alena', speed = 1.0 }) {
  // → returns { url } — URL MP3 в нашем S3
}
```

**Стоимость:** 2 кредита за 30 сек речи.

**Эндпоинт:** `https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize`

**Голоса** (список в `src/data/voices.js`):
- `alena` — женский, нейтральный
- `filipp` — мужской, спокойный
- `ermil` — мужской, дикторский
- `jane` — женский, эмоциональный

---

## Editor: FFmpeg (монтаж)

**Файл:** `server/providers/editor.js`

```javascript
export async function composeVideo({ template, scenes, music, output_path }) {
  // scenes = [{ image_url, audio_url, text_overlay, duration }, ...]
  // → returns { url } — URL итогового MP4 в S3
}
```

**Стоимость:** 0 кредитов (это наша работа, мы её оплачиваем хостингом).

**Реализация:**
1. Скачиваем все материалы (картинки, аудио) во временную папку `/tmp/{job_id}/`
2. Применяем шаблон через сложную ffmpeg-команду
3. Загружаем результат в S3
4. Удаляем `/tmp/{job_id}/`

**Шаблон** — это JSON-структура, которая транслируется в ffmpeg-фильтр. Описание шаблонов — в `src/data/templates.js`.

**Зависимости:** ffmpeg в PATH. На Railway добавить `nixpacks.toml`:
```toml
[phases.setup]
nixPkgs = ['ffmpeg-full']
```

---

## Общая структура ответа провайдера

```javascript
// Успех
{ ok: true, data: { ... }, credits_used: 3 }

// Ошибка
{ ok: false, error: { code: 'PROVIDER_ERROR', message: '...', retryable: true } }
```

**Коды ошибок:**
- `AUTH_ERROR` — не получили токен (не повторяем)
- `RATE_LIMIT` — превышен лимит провайдера (повторяем через 30 сек)
- `INVALID_INPUT` — плохой промпт (не повторяем)
- `PROVIDER_ERROR` — 5xx от провайдера (повторяем 1 раз)
- `TIMEOUT` — провайдер не ответил вовремя (повторяем 1 раз)

---

## Retry-логика

В `server/jobs.js` при failed задаче:
1. Если `error.retryable === true` — повторяем 1 раз через 5 секунд
2. Если снова failed — отмечаем задачу как failed, **возвращаем кредиты** пользователю
3. Логируем ошибку для админки

---

## Учёт стоимости

Каждый провайдер экспортирует константу:
```javascript
export const CREDITS_COST = 15; // для video
```

При создании задачи в `server/jobs.js`:
1. Списываем кредиты **до** вызова провайдера
2. Если провайдер failed — возвращаем кредиты
3. Если провайдер succeeded — кредиты остаются списанными

---

## Тестирование без реальных API

Для разработки делаем мок-провайдеры. Активируются переменной `MOCK_PROVIDERS=true`:
- LLM возвращает фиктивные сценарии
- Image возвращает placeholder с picsum.photos
- Video возвращает фиксированный clip из тестового бакета
- TTS возвращает тишину 3 секунды

Это позволяет разрабатывать UI без расходов на API.
