# Sprint 3 Report — Картинки (ART), озвучка (SpeechKit), хранилище (S3), раскадровка

## Статус
**Завершён частично.** Весь код написан, билд проходит без ошибок. Не деплоился, не тестировался с живыми API Yandex. Env-переменные на Railway не настроены, бакет S3 не создан.

## Что сделано

### Бэкенд — новые файлы
- `server/storage.js` — S3-клиент (uploadBuffer, deleteByPrefix) для Yandex Object Storage
- `server/providers/image.js` — Yandex ART: async генерация (POST → operationId → poll → base64 → Buffer → S3)
- `server/providers/tts.js` — SpeechKit: синхронный синтез (POST form-data → MP3 buffer → S3), 5 голосов
- `server/prompts/imagePrompt.js` — buildImagePrompt() для формирования промпта ART из описания + тона + стиля

### Бэкенд — изменённые файлы
- `server/jobs.js` — новый тип задачи `storyboard`: runStoryboard(), calculateStoryboardCost(), экспорт IMAGE_COST/TTS_COST/SCENE_COST, watchdog увеличен до 15 мин, partial refund на уровне шагов
- `server.js` — эндпоинт `GET /api/voices`, калькуляция стоимости storyboard в `POST /api/jobs`, импорт VOICES и calculateStoryboardCost

### Фронтенд — новые файлы
- `src/data/voices.js` — список голосов для селекта
- `src/components/Storyboard.jsx` — карточки сцен: картинка 9:16, аудио-плеер, текст, failed-state, заглушка «Перегенерировать»

### Фронтенд — изменённые файлы
- `src/pages/ProjectPage.jsx` — блок создания раскадровки (выбор голоса, стоимость, прогресс), сохранение результата в brief, отображение через Storyboard, кнопка «Собрать видео» (заглушка Sprint 4)
- `src/components/GenerationProgress.jsx` — поддержка type="storyboard": другой текст, прогресс-бар с процентами, минимум 5% при running
- `src/components/ProjectCard.jsx` — статус «Раскадровка», thumbnail из первой сцены, счётчик фото

### Закрыто из ROADMAP Спринта 3
- ✅ server/providers/image.js
- ✅ server/providers/tts.js
- ✅ server/storage.js
- ✅ Логика «сценарий → раскадровка» (тип storyboard в jobs.js)
- ✅ Предпросмотр сцен (Storyboard.jsx на ProjectPage)
- ✅ src/data/voices.js
- ✅ Выбор голоса перед генерацией

## Чего НЕ сделано из запланированного
- **Создание бакета `videoai-media`** — бакет не создан в Yandex Cloud, env-переменные не выставлены на Railway
- **Перегенерация отдельной сцены** — в ROADMAP: «Возможность перегенерировать отдельную сцену». Кнопка есть, но логика — заглушка (показывает toast). Причина: требуется отдельный тип задачи `regen_scene`, отложено на следующую итерацию
- **Мок-провайдеры (MOCK_PROVIDERS=true)** — описаны в AI_PROVIDERS.md, не реализованы. Причина: не входило в ТЗ этого спринта
- **Реальное тестирование на проде** — деплой не произведён, все интеграции не проверены живьём

## Хранилище (Object Storage / S3)
- **Реально ли загружаются файлы?** Нет. Не проверено живьём. Бакет `videoai-media` не создан, env-переменные S3_ACCESS_KEY / S3_SECRET_KEY не установлены на Railway.
- **Формат публичных URL:** `https://videoai-media.storage.yandexcloud.net/projects/{projectId}/scene-{sceneIndex}.jpg` (.mp3 для аудио). Бакет должен быть настроен на публичное чтение.
- **Структура ключей:**
  - `projects/{projectId}/scene-{sceneIndex}.jpg` — картинка
  - `projects/{projectId}/scene-{sceneIndex}.mp3` — озвучка
- **SDK:** `@aws-sdk/client-s3` ^3.1056. Настройки: `forcePathStyle: true` (требуется для Yandex Object Storage), endpoint по умолчанию `https://storage.yandexcloud.net`, region `ru-central1`.
- **deleteByPrefix()** написан (для очистки при удалении проекта), но нигде не вызывается — техдолг.

## Картинки (Yandex ART)
- **Работает ли на проде?** Нет. Код не деплоился, ни один живой запрос не отправлен.
- **Асинхронный флоу:** Реализован. POST на `https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync` → получаем `operationId` → poll `https://operation.api.cloud.yandex.net/operations/{id}` каждые 3 сек → при `done` достаём `response.image` (base64) → Buffer → uploadBuffer в S3.
- **Модель:** `art://${YANDEX_FOLDER_ID}/yandex-art/latest`
- **Соотношение сторон:** 9:16 (widthRatio: 9, heightRatio: 16) — задано в запросе.
- **Среднее время генерации:** Не замерено. По документации Yandex — 10-30 секунд. Таймаут в коде: 90 секунд.
- **Цензура ART:** Обрабатывается как HTTP 400 → код `INVALID_INPUT`, не повторяем, возвращаем 3 кредита за картинку. Логируем ошибку. Сцена помечается ok: false.
- **Обработка ошибок:** AUTH_ERROR (401/403), INVALID_INPUT (400), RATE_LIMIT (429, повтор через 30 сек), PROVIDER_ERROR (5xx, повтор 1 раз), TIMEOUT (90 сек).
- **Промпт:** buildImagePrompt() добавляет тоновые хинты + суффикс «Вертикальная композиция, без текста, без надписей, качественная иллюстрация».

## Озвучка (SpeechKit)
- **Работает ли на проде?** Нет. Код не деплоился.
- **Голоса:** 5 штук — alena (жен., нейтральный, дефолт), filipp (муж., спокойный), ermil (муж., дикторский), jane (жен., эмоциональный), omazh (жен., глубокий).
- **Формат:** MP3, sampleRateHertz 48000, язык ru-RU, emotion neutral.
- **Средняя длительность запроса:** Не замерена. По документации — 1-3 секунды. Таймаут в коде: 30 секунд.
- **Лимит текста:** 5000 символов. При превышении — обрезка + warning в лог.
- **Валидация голоса:** если передан невалидный voice — fallback на alena.
- **Обработка ошибок:** аналогична image.js — AUTH_ERROR, INVALID_INPUT, RATE_LIMIT, PROVIDER_ERROR.

## Раскадровка (storyboard в движке задач)
- **Проход по сценам:** Последовательно. Для каждой сцены: сначала generateImage(), затем synthesize(). Параллельно не делаем — ART async с polling перегружает, проще контролировать.
- **Прогресс:** После каждой сцены: `progress = round((i+1) / totalScenes * 100)`. UPDATE в БД, фронт видит через polling каждые 2 сек. На фронте минимум 5% при status=running.
- **Прогресс реально растёт?** Не проверено живьём.
- **Частичный возврат кредитов:** Реализован на уровне шагов.
  - Упала картинка → +3 кредита назад
  - Упал TTS → +1 кредит назад
  - ВСЕ сцены полностью (0 succeeded) → полный возврат, задача failed
  - Хотя бы 1 сцена с чем-то → задача done + refund за упавшие шаги
  - **Проверен?** Нет, только логика в коде.
- **Watchdog:** 15 минут (было 10). Раскадровка из 5-6 сцен может занять 3-5 минут при нормальной работе ART.
- **Создание задачи:** `POST /api/jobs { type: 'storyboard', projectId, input: { scenario, voice, style } }`. Стоимость = N_сцен × 4 кредитов. Транзакция: BEGIN → SELECT credits FOR UPDATE → UPDATE credits → INSERT job → COMMIT → setImmediate(runJob).

## Технические решения
- **Сделал последовательную генерацию сцен вместо параллельной**, потому что ART async требует polling каждые 3 сек, параллельные запросы создадут N потоков polling и перегрузят, а также усложнят прогресс-трекинг.
- **Сделал partial refund на уровне шагов (image/TTS) вместо на уровне сцен**, потому что если у сцены упала только картинка — аудио всё равно может быть полезно. Возвращаем 3 кредита за картинку, 1 за аудио, независимо.
- **Сделал scene.ok = true только когда ОБА (image + audio) успешны**, потому что фронту нужно различать полностью готовую сцену от частично. Но succeededScenes считает сцену как «что-то есть» если хотя бы image или audio.
- **Сделал buildImagePrompt в отдельном файле `server/prompts/imagePrompt.js`**, потому что AI_PROVIDERS.md требует промпты в `server/prompts/`, не хардкодить.
- **Сделал lazy-инициализацию S3Client (getClient())**, потому что при старте сервера env-переменных может не быть, а S3 нужен только при стройке.
- **Сделал `forcePathStyle: true` для S3**, потому что Yandex Object Storage требует path-style для совместимости с AWS SDK.
- **Сделал публичный URL через виртуальный хостинг `https://${bucket}.storage.yandexcloud.net/${key}`**, хотя `forcePathStyle` для API — потому что бакет настраивается на публичное чтение, URL не требует подписи.

## Отклонения от CLAUDE.md / AI_PROVIDERS.md
1. **AI_PROVIDERS.md указывает Kandinsky 5.0 для картинок**, но ТЗ спринта явно указало Yandex ART. Реализован Yandex ART. Сигнатура `generateImage()` отличается — добавлены параметры `projectId`, `sceneIndex`, `tone`, `style` (для S3-ключа и промпта). Контракт возврата `{ ok, data: { url }, credits_used }` совместим.
2. **AI_PROVIDERS.md указывает стоимость TTS = 2 кредита за 30 сек речи**, но ТЗ спринта задало 1 кредит за вызов (за сцену). Реализовано: `CREDITS_COST = 1` в tts.js.
3. **AI_PROVIDERS.md указывает сигнатуру `synthesize({ text, voice, speed })`**, реализовано: `synthesize({ text, voice, projectId, sceneIndex })` — speed убран (SpeechKit v1 не поддерживает), добавлены projectId/sceneIndex для S3-ключа.
4. **AI_PROVIDERS.md указывает 4 голоса**, реализовано 5 — добавлен `omazh` (жен., глубокий), которого не было в AI_PROVIDERS.md.
5. **AI_PROVIDERS.md описывает retry-логику: повтор через 5 секунд**, реализовано: RATE_LIMIT — через 30 сек, остальные retryable — через 5 сек (в runJob, для storyboard retry на уровне шагов не делается — retry делает runJob для всего типа).

## Технический долг
1. **Перегенерация отдельной сцены** — кнопка на фронте есть (заглушка), нужен отдельный тип задачи `regen_scene` в jobs.js.
2. **deleteByPrefix() не вызывается** — написан в storage.js для очистки S3 при удалении проекта, но API удаления проекта не реализован.
3. **SSL GigaChat `rejectUnauthorized: false`** — не трогали, долг из Sprint 2.
4. **Мок-провайдеры (MOCK_PROVIDERS=true)** — описаны в AI_PROVIDERS.md, не реализованы. Без них невозможна разработка без расходов на API.
5. **Валидация голоса на бэке** — fallback на alena при невалидном voice, но нет явной ошибки в API-ответе.
6. **Кеширование/логирование промптов ART** — одинаковые промпты могут давать разные картинки, полезно логировать для отладки.
7. **Нет retry на уровне отдельных шагов storyboard** — если generateImage вернул ok: false, шаг помечается failed, retry не делается. Retry есть только на уровне всей задачи в runJob (для retryable-ошибок, но generateImage/synthesize ловят ошибки внутри и возвращают `{ ok: false }`, а не бросают).

## Известные баги
Не обнаружено — **но реально не тестировалось на живых API**. Баги проявятся только при первом деплое. Потенциальные проблемы:
- Yandex ART может возвращать не `response.image`, а другое поле — зависит от версии API.
- SpeechKit form-data через URLSearchParams — возможно нужен multipart, а не URL-encoded. Документация Yandex говорит `application/x-www-form-urlencoded`, но стоит проверить.
- S3 `forcePathStyle: true` + виртуальный хостинг в публичном URL — если бакет не настроен на публичное чтение, URL будет 403.

## Изменения в схеме БД
Новых таблиц и колонок нет. Используется существующий `brief` (JSONB) в таблице `projects`.

Добавлены поля в JSONB `brief`:
- `scenes_media` — массив объектов `{ sceneIndex, image_url, audio_url, ok }`. Записывается через PATCH /api/projects/:id после завершения storyboard-задачи.
- `voice` — ID выбранного голоса (string, например "alena"). Сохраняется вместе с scenes_media.

Таблица `generation_jobs` без изменений — тип `storyboard` работает через существующее поле `type` (text), input/output хранятся в JSONB.

## Изменения в переменных окружения

| Переменная | Назначение | Установлена на Railway |
|---|---|---|
| `YANDEX_API_KEY` | API-ключ для ART и SpeechKit | ❌ Нет |
| `YANDEX_FOLDER_ID` | Folder ID Yandex Cloud | ❌ Нет |
| `S3_ACCESS_KEY` | Ключ доступа к Object Storage | ❌ Нет |
| `S3_SECRET_KEY` | Секретный ключ Object Storage | ❌ Нет |
| `S3_ENDPOINT` | Endpoint S3 (default: `https://storage.yandexcloud.net`) | ❌ Нет (можно не ставить) |
| `S3_REGION` | Регион (default: `ru-central1`) | ❌ Нет (можно не ставить) |
| `S3_BUCKET` | Имя бакета (default: `videoai-media`) | ❌ Нет (можно не ставить) |

**Ни одна из новых переменных не установлена на Railway.** Без них storyboard-задачи будут падать с AUTH_ERROR.

## Новые зависимости
- `@aws-sdk/client-s3` ^3.1056 — S3-клиент для Yandex Object Storage (PutObject, ListObjectsV2, DeleteObjects)

## Как проверить (чек-лист для ручного теста на проде ddvideoai.ru)

### Подготовка (до деплоя)
1. Создать бакет `videoai-media` в Yandex Cloud Console
2. Настроить публичное чтение бакета (ACL: public-read)
3. Создать сервисный аккаунт с ролью `storage.uploader` + `storage.viewer`
4. Получить статический ключ (access key + secret key)
5. Получить API-ключ для Yandex ART + SpeechKit (или использовать существующий с правами `ai.imageGeneration.user` + `ai.speechkit-tts.user`)
6. Установить на Railway: YANDEX_API_KEY, YANDEX_FOLDER_ID, S3_ACCESS_KEY, S3_SECRET_KEY
7. Деплой

### Ручной тест
1. Открыть ddvideoai.ru → войти (OTP)
2. Создать новый проект → заполнить тему, стиль, длительность
3. Сгенерировать сценарии (Sprint 2 — убедиться что не сломали)
4. Выбрать сценарий → попасть на ProjectPage
5. Убедиться, что видны сцены в текстовом виде
6. В блоке «Создать раскадровку»:
   - Выбрать голос из дропдауна (дефолт — Алёна)
   - Проверить отображение стоимости: «N сцен × 4 = M кредитов. У вас: K»
   - Нажать «Озвучить и нарисовать сцены»
7. Прогресс: проценты должны расти от 0 до 100 по мере генерации сцен
8. Результат:
   - Карточки сцен с вертикальными картинками (9:16)
   - Аудио-плееры — нажать play, проверить что звук воспроизводится
   - Текст сцены под картинкой
9. Проверить файлы в бакете через Yandex Cloud Console:
   - `projects/{id}/scene-0.jpg`, `scene-1.jpg`, ...
   - `projects/{id}/scene-0.mp3`, `scene-1.mp3`, ...
10. Кредиты: проверить что списалось N×4
11. Dashboard: карточка проекта показывает thumbnail + статус «Раскадровка» + «N фото»
12. **Тест partial failure:** временно подсунуть плохой промпт или отключить ART-ключ → проверить что кредиты за упавшие шаги вернулись, а работающие сцены показываются

## Расход ресурсов
**Не замерено.** Код не деплоился, ни одного живого запроса к Yandex API не было.

Ожидаемый расход (по документации):
- Yandex ART: ~0.04 ₽ за картинку (бесплатный грант покрывает сотни генераций)
- SpeechKit: ~0.002 ₽ за 1000 символов (описание сцены ~100-200 символов → копейки)
- Object Storage: ~0.001 ₽ за PUT + хранение ~0.02 ₽/ГБ/мес
- **Раскадровка 5 сцен:** ожидаемое время ~50-150 сек (ART 10-30 сек × 5 + TTS 1-3 сек × 5)

Реальные цифры можно получить только после первого деплоя и тестового прогона.

## Вопросы / на что обратить внимание
1. **Нужно создать бакет и настроить env на Railway** — без этого ничего из Sprint 3 не заработает. Это блокер.
2. **Проверить формат ответа Yandex ART** — в коде ожидаем `op.response.image` (base64). Если API вернёт другую структуру — нужно будет быстро поправить.
3. **Проверить content-type SpeechKit** — используем URLSearchParams (x-www-form-urlencoded). Если SpeechKit потребует multipart — нужно будет переделать.
4. **Решить по перегенерации сцен** — сейчас заглушка. Для Sprint 4 (монтаж) пользователю захочется поменять неудачную картинку. Делать до Sprint 4 или параллельно?
5. **Мок-провайдеры** — без них каждый тест расходует грант Yandex. Стоит реализовать до активного тестирования.
6. **SSL GigaChat** — `rejectUnauthorized: false` висит с Sprint 2, не критично для работы, но уязвимость.
