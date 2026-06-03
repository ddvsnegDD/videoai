# Sprint B.2 Report — Защиты перед живым тестом + бесплатная картинка

## Спринт B.2: hardening перед живым тестом
**Дата:** 01.06.2026
**Статус:** завершён (код на проде, живой тест НЕ проводился — это следующий шаг)
**Одной строкой:** три защитных слоя перед первым платным прогоном — очистка вывода GigaChat от мусора/кириллицы, устойчивый парсинг ответа Nano Banana с fallback-цепочкой, бесплатная первая картинка (free_image по аналогии с free_wan/free_veo).

## Что сделано

### 1. Очистка вывода GigaChat (`buildImagePrompt` в `llm.js`)

Постобработка ответа:
- Снятие markdown-огражений (````...````), бэктиков, обрамляющих кавычек (`"`, `«»`).
- Удаление ведущих меток: `Prompt:`, `Here is...`, `Промпт:`, `Output:`, `Результат:` (case-insensitive).
- Схлопывание пробелов и переводов строк.
- **Проверка на кириллицу:** regex `/[а-яёА-ЯЁ]/` по очищенному тексту.
  - Если найдена → один повторный запрос к GigaChat с `IMAGE_PROMPT_SYSTEM_STRICT` (температура 0.5, «English only, no Cyrillic, output the prompt and nothing else»).
  - Если и повтор с кириллицей → ошибка `INVALID_PROMPT`, генерация картинки НЕ запускается, кредиты НЕ списываются.
- Проверка на пустой/короткий результат (< 10 символов) → `INVALID_PROMPT`.

### 2. Устойчивый разбор ответа Nano Banana (`fetchImageAndUpload` в `falImage.js`)

Функция `extractImageUrl(data)` пробует 6 путей:
1. `data.images[0].url` (ожидаемый формат)
2. `data.images[0]` как строка-URL
3. `data.image.url`
4. `data.url`
5. `data.output[0].url`
6. `data.output[0]` как строка-URL

Берёт первый валидный (строка, начинается с `http`). Логирует, какой ключ сработал.

**COMPLETED без URL:** НЕ пере-сабмитит (fal уже списал деньги). Бросает ошибку → `failJob` → идемпотентный возврат кредитов/пробника пользователю. `fal_request_id` остаётся в БД для ручного расследования.

Добавлено логирование `Result preview` (первые 500 символов JSON) — как у видео.

### 3. Бесплатная первая картинка (`free_image`)

- **БД:** `ALTER TABLE users ADD COLUMN IF NOT EXISTS free_image INTEGER DEFAULT 1` — в `db.js`, `initDB`. Существующим пользователям проставится дефолт 1.
- **`auth.js`:** `sanitizeUser` возвращает `free_image`.
- **`server.js`:** роут `POST /api/jobs` type=`image` — проверяет `free_image > 0`; если да → `costCredits: 0`, `freeColumn: 'free_image'`; если нет → `costCredits: IMAGE_MODEL.credits`.
- **`server.js`:** `GET /api/admin/users` — включает `free_image` в ответ.
- **`jobs.js`:** `failJob` распознаёт `_freeColumn = 'free_image'` (whitelist расширен: `['free_wan', 'free_veo', 'free_image']`). `createJob` SELECT теперь включает `free_image`.
- **UI (`EditorPage.jsx`):**
  - `isFreeImage = freeImage > 0`; `canAffordImage = isFreeImage || credits >= creditsImage`.
  - Кнопка выбора «Сгенерировать»: показывает «Первая картинка бесплатно» если есть пробник.
  - Форма генерации: «Бесплатно (пробная генерация)» вместо «Стоимость: 13 кр.».
  - Перегенерация: показывает «(бесплатно)» / «(13 кр.)» в зависимости от пробника; подтверждение «Бесплатно. Продолжить?» / «Будет списано 13 кр. Продолжить?».

**Правило:** пробник тратится на первую генерацию картинки (любую — первичную или перегенерацию); пока `free_image > 0` — бесплатно, дальше платно. Единообразно с `free_wan`/`free_veo`.

## Что удалено / заменено

— (нет удалений)

## Изменения в коде

**Бэкенд:**
- `server/providers/llm.js` — `cleanPromptOutput()`, `IMAGE_PROMPT_SYSTEM_STRICT`, `CYRILLIC_RE`, проверка кириллицы с retry в `buildImagePrompt`.
- `server/providers/falImage.js` — `extractImageUrl()` (6 fallback-путей), логирование Result preview, комментарий про COMPLETED-без-URL.
- `server/jobs.js` — SELECT `free_image` в `createJob`; whitelist `free_image` в `failJob`.
- `server/db.js` — `ALTER TABLE users ADD COLUMN IF NOT EXISTS free_image INTEGER DEFAULT 1`.
- `server/auth.js` — `sanitizeUser` отдаёт `free_image`.
- `server.js` — type=`image` проверяет `free_image`; admin users SELECT включает `free_image`.

**Фронтенд:**
- `src/pages/EditorPage.jsx` — `freeImage`, `isFreeImage`, `canAffordImage` с учётом пробника; UI показывает «Бесплатно» / «N кр.» во всех точках (выбор, форма, перегенерация).

**Новые зависимости:** —

## Интеграция с fal (если затронута)

Формат ответа Nano Banana не менялся. Добавлена устойчивая цепочка парсинга (6 путей) и комментарий: COMPLETED без URL ≠ повторный сабмит.

## Схема БД (если менялась)

- `ALTER TABLE users ADD COLUMN IF NOT EXISTS free_image INTEGER DEFAULT 1` — новая колонка, дефолт 1 для всех пользователей (в том числе существующих).
- Миграция применяется автоматически при старте сервера (`initDB`). На проде применится при следующем деплое.

## Переменные окружения (если менялись)

— (нет новых)

## Кредиты / экономика (если затронуто)

- **Пробник:** `free_image = 1` для нового пользователя (и для существующих после миграции). Первая генерация картинки бесплатна.
- **Списание:** `free_image > 0` → decrement, кредиты не трогаем; `free_image = 0` → списать `CREDITS_IMAGE` (13). `_freeColumn = 'free_image'` сохраняется в input задачи.
- **Возврат при сбое:** `failJob` проверяет `_freeColumn`; если `free_image` → восстанавливает `free_image + 1`; иначе — возвращает кредиты. Идемпотентно (флаг `refunded`).
- **COMPLETED без URL:** кредиты/пробник возвращаются пользователю; повторный submit в fal НЕ уходит.
- **INVALID_PROMPT (кириллица):** генерация картинки не запускается, кредиты/пробник не списываются (ошибка на этапе промпта, до создания job).

## Тесты

### Проверено (реально запускалось)

| Тест | Что проверяли | Как наблюдали | Результат |
|---|---|---|---|
| Билд | `npm run build` без ошибок | Вывод Vite: 0 ошибок | PASS |
| Импорт llm.js | Модуль парсится, экспорты на месте | `node -e "import(...)"` → `[buildImagePrompt, listModels]` | PASS |
| Импорт falImage.js | Модуль парсится с новой `extractImageUrl` | `node -e "import(...)"` → 5 экспортов | PASS |
| Импорт jobs.js | Движок с расширенным whitelist | `node -e "import(...)"` → 6 экспортов | PASS |
| `cleanPromptOutput` — логика | Снятие кавычек, markdown, меток | По коду: 5 regex-шагов, не трогает содержимое | PASS (по коду) |
| `extractImageUrl` — fallback | 6 путей, первый валидный | По коду: проверяет `string` + `startsWith('http')` | PASS (по коду) |
| `failJob` whitelist | `free_image` распознаётся | По коду: `['free_wan', 'free_veo', 'free_image'].includes(...)` | PASS (по коду) |

### НЕ проверено (и почему)

- **GigaChat живьём** — нужен запуск на Railway с GIGACHAT_AUTH_KEY. Непроверено: действительно ли GigaChat отвечает на английском; срабатывает ли retry при кириллице; корректна ли очистка на реальном ответе.
- **Nano Banana живьём** — нужен fal-баланс. Неизвестен реальный формат ответа (какой именно путь из 6 сработает).
- **`free_image` миграция на проде** — колонка добавится при следующем деплое автоматически. Не проверялось, что для существующих пользователей дефолт 1 проставился.
- **Полный пробник: первая бесплатно → вторая за кредиты** — не запускалось.
- **COMPLETED без URL** — невозможно проверить без реального сбоя fal.

## Расход fal за спринт

- Потрачено: **$0** (код, без живых тестов)

## Остаётся (хвосты, открытые вопросы)

1. **Сквозной живой тест** — главный хвост из Sprint B. Теперь с защитами: GigaChat → Nano Banana → подтверждение → Kling → MP4. Первая картинка и первое Kling-видео — бесплатно (free_image + free_wan).
2. **Проверить миграцию `free_image`** — после деплоя убедиться через админку, что у существующих пользователей `free_image = 1`.
3. **Все хвосты Sprint B** (Veo на проде, лендинг, SSL-сертификаты) — без изменений.

## Технический долг

1. Все пункты из Sprint B Report остаются.
2. **Пропорции:** картинка 3:4 (Nano Banana) → Veo форсит 9:16. Может обрезать. Решение — отдельно.

## Что обновить в документах

- **CLAUDE.md** — добавить: `free_image` в схему БД и кредитную модель; `cleanPromptOutput`/retry в описание llm.js; `extractImageUrl` в описание falImage.js.
- **AI_PROVIDERS.md** — отметить в секции Nano Banana: 6 fallback-путей парсинга; COMPLETED без URL → refund, не re-submit.
- **SPRINT_B_REPORT.md** — обновить: free_image реализован (был в «не реализовано»); GigaChat cleanup реализован; устойчивый парсинг реализован.
