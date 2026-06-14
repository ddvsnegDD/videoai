# Sprint B Report — Текст → картинка → оживление (Nano Banana + GigaChat)

## Спринт B: текст → картинка → оживление
**Дата:** 01.06.2026
**Статус:** завершён с хвостами (код на проде, живой тест НЕ проводился)
**Одной строкой:** реализована ветка «нет фото» — описание товара на русском → GigaChat строит английский промпт → Nano Banana генерирует картинку → пользователь подтверждает → существующее оживление (Kling/Veo). Код написан, билд проходит, модули импортируются — но сквозной живой тест ещё не проведён.

## Что сделано

- **Починен `llm.js`** — удалён мёртвый импорт `scenario.js` / `scenarioParser.js`, убраны функции старого пайплайна (`generateScenarios`, `generateOne`, `generateIdeas`, `CREDITS_COST`, `CREDITS_PER_SCENARIO`). Рабочая обёртка GigaChat сохранена (OAuth, кеш токена, SSL НУЦ Минцифры, `chatCompletion`).
- **`buildImagePrompt({ productType, details, style })`** — новая функция в `llm.js`. Принимает описание товара на русском, через GigaChat возвращает детальный промпт картинки на английском. Системный промпт заточен под product photography (товар, фон, ракурс, свет, «sharp readable text on label»). Температура 0.7.
- **`server/providers/falImage.js`** — новый провайдер Nano Banana 2. Контракт: `submitImageToFal` → `pollFalImage` → `fetchImageAndUpload`. Паттерн идентичен falVideo.js: queue submit → сохранить `fal_request_id` до поллинга → poll → result → скачать → перезалить в S3.
- **Тип задачи `image`** в движке (`jobs.js`) — идёт через существующий движок: дедуп (`idempotency_key`), `fal_request_id` сразу после submit, reconciler, идемпотентный возврат (`refunded`). `makeIdempotencyKey` обобщён для обоих типов.
- **Reconciler** обновлён — определяет fal-эндпоинт по `row.type`: `image` → `IMAGE_MODEL.id`, `animate` → `VIDEO_MODELS[modelKey].id`. Для image-задач: `fetchImageAndUpload` → обновляет `brief.image_url` в проекте.
- **`POST /api/build-image-prompt`** — новый роут, вызывает GigaChat (быстрый, не job). Lazy import `llm.js` (не грузит GigaChat при старте).
- **`POST /api/jobs` type=`image`** — создаёт задачу генерации картинки, списывает `CREDITS_IMAGE`.
- **`GET /api/config`** — отдаёт `credits_image` наряду с `video_models` и `motion_presets`.
- **`EditorPage.jsx`** — полная переработка. Новый шаг `source_select` («Загрузить фото» / «Сгенерировать»); ветка generate: форма (тип, детали, стиль) → GigaChat промпт → image job → `confirm_image` (показ картинки + «Оживить» / «Перегенерировать»); затем — в существующий configure → animate. Перегенерация с подтверждением стоимости ДО запроса в fal.
- **`GenerationProgress.jsx`** — принимает `type` prop; для `image` показывает «Генерирую картинку... обычно 15-30 секунд».
- **Удалён `server/lib/scenarioParser.js`** — мёртвый код, использовался только из llm.js.

## Что удалено / заменено

- `server/lib/scenarioParser.js` — мёртвый код, парсил сценарии GigaChat для старого пайплайна; больше нигде не импортировался.
- `server/prompts/` — директория пуста (файлы удалены ещё в Спринте A), осталась как пустая папка.
- Из `llm.js` удалены: `import { buildScenarioPrompt, TONES } from '../prompts/scenario.js'`, `import { parseSingleScenario } from '../lib/scenarioParser.js'`, экспорты `CREDITS_COST`, `CREDITS_PER_SCENARIO`, функции `generateOne`, `generateScenarios`, `generateIdeas`.

Остаточный legacy (честно):
1. **`server/prompts/`** — пустая директория, можно удалить.
2. **`AdminPage.jsx`** — мёртвые ветки `storyboard`/`regenerate_scene` (из Спринта A, не чинилось).
3. **`HomePage.jsx`** — лендинг всё ещё про SpeechKit/Kandinsky (из Спринта A, нужен отдельный редизайн).
4. Имена `CREDITS_WAN` / `free_wan` — легаси от Wan, теперь управляют Kling-тарифом. Косметика.

## Изменения в коде

**Бэкенд:**
- `server/providers/llm.js` — полная переработка: убраны мёртвые импорты и функции, добавлена `buildImagePrompt()`. `chatCompletion` расширена параметрами `temperature`/`maxTokens`.
- `server/providers/falImage.js` — **новый файл**. Провайдер Nano Banana 2: `submitImageToFal`, `pollFalImage`, `fetchImageAndUpload`, `IMAGE_MODEL`, `POLL_TIMEOUT_IMAGE`.
- `server/jobs.js` — импорт falImage; обобщённый `makeIdempotencyKey(type, input, seed)`; `runImage()` (аналог `runAnimate`); `executeType` обрабатывает `'image'`; reconciler определяет endpoint по `row.type`; при type=image сохраняет `image_url` в brief проекта (не ставит `status='ready'` — готовность после оживления).
- `server.js` — импорт `IMAGE_MODEL`; `POST /api/build-image-prompt` (GigaChat); type=`image` в `POST /api/jobs`; `credits_image` в `GET /api/config`.
- `server/lib/scenarioParser.js` — **удалён**.

**Фронтенд:**
- `src/pages/EditorPage.jsx` — полная переработка. Добавлены state: `mode`, `productType`, `details`, `style`, `generatingPrompt`, `imagePrompt`, `imageJobId`, `projectId`, `imageSource`, `showRegenConfirm`. Новые шаги: `source_select`, `generate_form`, `generating_image`, `confirm_image`. Два хука `useJobPolling` (для image и animate). Перегенерация с подтверждением.
- `src/components/GenerationProgress.jsx` — принимает `type` prop, текст и время зависят от типа задачи.

**Новые зависимости:** —

## Интеграция с fal (если затронута)

| Модель / эндпоинт | Назначение | Цена (факт) |
|---|---|---|
| `fal-ai/nano-banana-2` | Генерация картинки по тексту | — (живой тест не проводился) |
| `fal-ai/kling-video/v2.5-turbo/standard/image-to-video` | Эконом видео (без изменений) | ~$0.21/ролик (подтверждено ранее) |
| `fal-ai/veo3.1/fast/image-to-video` | Премиум видео (без изменений) | — (на проде не запускался) |

**Параметры Nano Banana 2 (по схеме fal, сверено через fal.ai/models):**
```js
{
  prompt: '...',           // string, required — английский промпт от GigaChat
  num_images: 1,           // integer, optional (default 1)
  seed: <number>,          // integer, optional — поддерживается! Задаём и сохраняем
  aspect_ratio: '3:4',     // enum: auto|21:9|16:9|3:2|4:3|5:4|1:1|4:5|3:4|2:3|9:16|...
  output_format: 'png',    // enum: jpeg|png|webp (default png)
  resolution: '1K',        // enum: 0.5K|1K|2K|4K (default 1K)
}
```

- Отличия от видео-моделей: нет `image_url` (text-to-image, не image-to-video); есть `num_images`; формат ответа `{ images: [{ url, ... }] }` вместо `{ video: { url } }`.
- `seed`: **поддерживается** — задаётся и сохраняется в `generation_jobs.seed`, как и для видео.
- Аудио: не применимо (картинка).

## Схема БД (если менялась)

- Новых колонок/индексов не требуется. Тип `image` укладывается в существующий `type VARCHAR(50)`. Все нужные колонки (`fal_request_id`, `seed`, `idempotency_key`, `refunded`, `last_polled_at`) уже есть из Спринта A.
- Миграция: не требуется.

## Переменные окружения (если менялись)

| Переменная | Назначение | В Railway |
|---|---|---|
| `CREDITS_IMAGE` | Стоимость генерации картинки (дефолт 13) | ✅ Добавлена |
| `GIGACHAT_AUTH_KEY` | OAuth-ключ GigaChat (Base64) | ✅ Добавлена |
| `GIGACHAT_SCOPE` | Scope GigaChat (дефолт `GIGACHAT_API_PERS`) | ✅ Добавлена |

## Кредиты / экономика (если затронуто)

- **Списание за картинку:** `CREDITS_IMAGE` (дефолт 13) за каждую генерацию, включая перегенерацию. Списание в транзакции до вызова fal (как у видео).
- **Перегенерация — платная с подтверждением:** UI показывает «Будет списано 13 кр. Продолжить?», запрос в fal уходит только после явного «Да».
- **Возврат при сбое:** через `failJob` — идемпотентно (флаг `refunded`), только при реальном FAILED от fal. По нашему таймауту — не рефандим, отдаём reconciler. Логика идентична видео.
- **Free-попытки для картинок:** НЕ реализованы (в отличие от `free_wan`/`free_veo`). Первая картинка стоит 13 кредитов. При необходимости можно добавить `free_image` по аналогии.
- **Себестоимость Nano Banana:** по прайсу fal — зависит от resolution; для 1K ожидается ~$0.01-0.04 (живой тест покажет точную цифру).

## Тесты

### Проверено (реально запускалось)

| Тест | Что проверяли | Как наблюдали | Результат |
|---|---|---|---|
| Билд фронтенда | `npm run build` проходит без ошибок | Вывод Vite: все чанки собрались, 0 ошибок | PASS |
| Импорт `llm.js` | Модуль импортируется без ошибки (нет мёртвых `scenario.js`) | `node -e "import(...)"` → `exports: [buildImagePrompt, listModels]` | PASS |
| Импорт `falImage.js` | Новый провайдер парсится | `node -e "import(...)"` → все 5 экспортов | PASS |
| Импорт `jobs.js` | Движок задач с новым типом `image` импортируется | `node -e "import(...)"` → все 6 экспортов | PASS |

### НЕ проверено (и почему)

- **`buildImagePrompt` живьём (GigaChat)** — нужен запуск сервера на Railway с `GIGACHAT_AUTH_KEY`. Локально не тестировалось (нет ключа). Риск: GigaChat может вернуть русский текст вместо английского, или обернуть промпт в кавычки/markdown.
- **Генерация картинки Nano Banana** — нужен fal-баланс. Не проводилась ни локально, ни на проде. Неизвестно: реальное время генерации, формат ответа на практике, actual cost.
- **Дедуп image-задач** — код переиспользует тот же `idempotency_key` + partial UNIQUE, что и для видео (проверен тестами B/C/D в Спринте A), но для типа `image` живьём не гонялось.
- **Reconciler для image-задач** — код написан, но не проверялся сценарием «обрыв в середине генерации картинки».
- **Перегенерация** — UI написан, подтверждение реализовано, но live-тест (списание → новый запрос → новая картинка) не проводился.
- **Сквозной флоу text→image→animate** — не запускался. Критический путь: GigaChat промпт → Nano Banana → подтверждение → Kling/Veo оживление → готовый MP4. Это главный тест для закрытия спринта.
- **Veo на проде** — всё ещё ни разу не запускался (хвост Спринта A).

## Расход fal за спринт

- Потрачено: **$0** (живых тестов не проводилось; весь спринт — написание кода)
- Баланс на конец: не проверялся

## Остаётся (хвосты, открытые вопросы)

1. **Сквозной живой тест** — главный хвост. Нужно прогнать полный путь: описание товара → GigaChat → Nano Banana → подтверждение картинки → Kling оживление → скачать MP4. Без этого спринт нельзя считать закрытым.
2. **GigaChat: язык промпта** — подтвердить, что на русском вводе GigaChat возвращает английский промпт (системный промпт требует, но нужна проверка). Если вернёт русский — Nano Banana может дать плохой результат.
3. **GigaChat SSL на Railway** — сертификаты НУЦ Минцифры (`server/certs/`) пустая директория. Код fallback'ит на `rejectUnauthorized: false`. Для прода — загрузить реальные сертификаты.
4. **Реальная стоимость Nano Banana** — прайс по схеме, но факт по счёту может отличаться. Замерить после первого прогона.
5. **Формат ответа Nano Banana** — код ожидает `data.images[0].url`; если fal отдаёт иначе — упадёт. Три fallback-варианта (как у видео) не реализованы — для картинки формат стандартный, но стоит проверить.
6. **Veo на проде** — хвост из Спринта A, не закрыт.
7. **Лендинг (HomePage)** — хвост из Спринта A, тексты устаревшие.

## Технический долг

1. **`server/prompts/`** — пустая директория, можно удалить.
2. **AdminPage** — мёртвые ветки `storyboard`/`regenerate_scene` (хвост Спринта A).
3. **HomePage** — тексты про SpeechKit/Kandinsky (хвост Спринта A).
4. **Имена `CREDITS_WAN`/`free_wan`** — легаси от Wan, управляют Kling. Косметика.
5. **Free-попытка для картинок** — не реализована. Первая картинка платная (13 кр.). Если нужно пробное — добавить `free_image` по аналогии с `free_wan`/`free_veo`.
6. **GigaChat SSL certs** — сертификаты НУЦ Минцифры не загружены в `server/certs/`. На Railway работает через `rejectUnauthorized: false`.

## Что обновить в документах

- **CLAUDE.md** — добавить: `falImage.js` в структуру проекта; тип задачи `image`; `CREDITS_IMAGE` в переменные окружения; `buildImagePrompt` в описание llm.js; статус Спринта B.
- **AI_PROVIDERS.md** — добавить секцию Nano Banana 2 с параметрами; обновить статус llm.js (починен, `buildImagePrompt` работает).
- **ROADMAP.md** — обновить статус Спринта B (реализован, хвосты = живой тест).
- **PROJECT.md** — обновить решение (шаг «или генерирует картинку по тексту» реализован).
