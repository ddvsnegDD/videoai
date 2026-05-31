# Sprint A Report — Пивот ядра: оживление фото товара через fal (Wan/Veo)

## Статус
**Завершён частично.** Код написан, билд проходит, задеплоен. FAL_KEY добавлен на Railway. **Живой тест с реальным fal.ai НЕ проведён** — нужно прогнать загрузку фото + генерацию Wan и Veo вручную и посмотреть логи.

## Что удалено (чистка старого пайплайна)
Реально удалённые файлы:
- `server/providers/image.js` — Yandex ART
- `server/providers/tts.js` — SpeechKit
- `server/prompts/scenario.js` — промпт генерации сценариев
- `server/prompts/imagePrompt.js` — промпт для ART
- `src/components/Storyboard.jsx` — компонент раскадровки
- `src/data/voices.js` — список голосов SpeechKit

Убрано из кода:
- Типы задач `storyboard`, `regenerate_scene`, `script` из jobs.js
- Вся логика раскадровки/перегенерации/голосов из ProjectPage, EditorPage
- Импорты VOICES, calculateStoryboardCost, IMAGE_COST, TTS_COST из server.js

**Проект собирается:** `npm run build` проходит без ошибок, мёртвых импортов в билде нет.

### Остаточный legacy (честно)
1. **`server/providers/llm.js`** — сохранён для Спринта B, НО содержит `import { buildScenarioPrompt, TONES } from '../prompts/scenario.js'` — файл удалён. Сейчас llm.js НЕ импортируется никем (jobs.js его не трогает), поэтому сервер работает. Но если кто-то попытается `import` из llm.js — упадёт с ошибкой. **Нужно починить в Спринте B.**
2. **`server/lib/scenarioParser.js`** — остался на диске, не удалён. Используется только из llm.js (который не импортируется). Мёртвый код.
3. **`src/pages/AdminPage.jsx`** строки 219-220 — цветовая маркировка типов `storyboard` и `regenerate_scene` осталась. Не ломает ничего (просто мёртвые ветки if), но legacy.
4. **`src/pages/HomePage.jsx`** — тексты всё ещё про «GigaChat · Kandinsky · SpeechKit», «Озвучка SpeechKit», «российский стек без VPN». **Лендинг не обновлён под новый продукт.** Нужен отдельный редизайн.

## Что добавлено

### Бэкенд — новые файлы
- `server/providers/falVideo.js` — fal.ai клиент. 2 модели (Wan + Veo), 4 пресета движений, async queue submit→poll→result, скачивание видео → перезаливка в S3.

### Бэкенд — изменённые файлы
- `server/jobs.js` — тип задачи `animate`. Логика free-tries (free_wan/free_veo): если есть бесплатная попытка — не списываем кредиты, уменьшаем счётчик. При сбое — возвращаем кредиты ИЛИ free-попытку. Progress по этапам. Watchdog 10 мин.
- `server.js` — POST /api/upload (multer multipart → S3), GET /api/config (модели + пресеты + цены), POST /api/jobs type='animate' с проверкой free-tries. Убраны старые роуты (calculateStoryboardCost, VOICES).
- `server/db.js` — `ALTER TABLE users ADD COLUMN IF NOT EXISTS free_wan INTEGER DEFAULT 1` и `free_veo`.
- `server/auth.js` — `sanitizeUser()` возвращает `free_wan`, `free_veo`. WELCOME_CREDITS читается из env (дефолт 50).

### Фронтенд — изменённые файлы
- `src/pages/EditorPage.jsx` — полная переработка. 4 шага: drag&drop фото → выбор движения (4 пресета + свой промпт) → выбор модели (Wan/Veo) → прогресс → видео-результат.
- `src/pages/ProjectPage.jsx` — упрощён: video-плеер + скачать + создать ещё.
- `src/components/ProjectCard.jsx` — thumbnail из brief.image_url, бейдж «Готово»/«Черновик».
- `src/components/GenerationProgress.jsx` — текст «Оживляю товар... 1-3 минуты», прогресс-бар.
- `src/components/Layout.jsx` — бейдж кредитов + free-попытки в хедере.
- `src/pages/DashboardPage.jsx` — тексты «Создать креатив» вместо «Создать видео».

### Новые зависимости
- `@fal-ai/client` — официальный клиент fal.ai (queue submit/status/result)
- `multer` — middleware multipart upload для Express

## Что переиспользовано без изменений
- **Движок задач** (createJob транзакция, runJob, retry, watchdog, failJob с возвратом) — работает, расширен для free-tries.
- **Хранилище** `server/storage.js` (uploadBuffer, deleteByPrefix) — без изменений.
- **Авторизация** (JWT, OTP, requireAuth) — без изменений (кроме sanitizeUser + WELCOME_CREDITS).
- **Кредиты** — логика списания/возврата сохранена, расширена для free-tries.
- **Админка** — requireAdmin, роуты /api/admin/* — работают (добавлены free_wan/free_veo в ответ users).
- **useJobPolling** на фронте — переиспользуется без изменений.

## Интеграция с fal — отдельный раздел (критично)

### Endpoint'ы
| Модель | Endpoint (полная строка) |
|---|---|
| Wan 2.7 (эконом) | `fal-ai/wan/v2.7/image-to-video` |
| Veo 3.1 fast (премиум) | `fal-ai/veo3.1/fast/image-to-video` |

Версии: **Wan v2.7**, **Veo 3.1 fast** (дешёвая версия, не полная Veo 3.1).

### Параметры запроса
Сейчас передаём минимальный набор:
```js
{ image_url: <публичный URL>, prompt: <текст движения> }
```
Параметры `resolution`, `duration`, `enable_audio` **НЕ передаются** — используются дефолты модели. Это потенциальная проблема:
- **Аудио:** НЕ выключено явно (`enable_audio: false` не передаётся). Если модель генерирует аудио по умолчанию — это удорожает генерацию. **Нужно проверить и добавить при необходимости.**
- **Разрешение:** не задано, модель выбирает сама (вероятно 720p для Wan, неизвестно для Veo).
- **Длительность:** не задана, модель выбирает (вероятно 5 сек Wan, 8 сек Veo).

### Асинхронный паттерн
Реализован свой polling, НЕ вебхуки:
1. `fal.queue.submit(modelId, { input })` → получаем `request_id`
2. Цикл: `fal.queue.status(modelId, { requestId })` каждые 5 сек
3. При `COMPLETED`: `fal.queue.result(modelId, { requestId })` → достаём video URL
4. Скачиваем видео (`fetch(videoUrl)`) → перезаливаем в наш S3 (`uploadBuffer`)

Таймаут: 5 минут. При `FAILED` — немедленная ошибка.

### Парсинг ответа fal
Пробуем три варианта: `data.video.url` → `data.output.url` → `data.url`. Если ни один не сработает — ошибка с логированием raw response.

### Картинка как публичный URL
Фото загружается в наш S3: `uploads/{userId}/{timestamp}.jpg`. URL формата `https://videoai-media.storage.yandexcloud.net/uploads/...`. Бакет настроен на публичное чтение. fal должен принять этот URL. **Не проверено живьём.**

### Живой тест
- **Wan — НЕ проверен.** Ни один запрос не отправлен.
- **Veo — НЕ проверен.**
- Среднее время генерации: **не замерено.** Ожидание по документации: Wan ~30-90 сек, Veo ~60-180 сек.

### Логирование
Да, залогировано:
- `[fal] Starting {model} for project {id}` — при старте
- `[fal] Model: {endpoint}` — полный endpoint
- `[fal] Prompt: {первые 100 символов}` — промпт
- `[fal] Submitted, request_id: {id}` — после submit
- `[fal] Status: {status}` — при каждом poll
- `[fal] Raw result keys: [...]` — ключи ответа
- `[fal] Result preview: {первые 500 символов JSON}` — сырой ответ
- `[fal] Uploaded to S3: {url} ({bytes} bytes)` — после загрузки

## Загрузка фото
- **Реализация:** `multer` с `memoryStorage()` → `uploadBuffer()` в S3.
- **Лимиты:** 10 МБ, форматы JPG/PNG/WEBP (`fileFilter` по mimetype).
- **Путь в бакете:** `uploads/{userId}/{Date.now()}.{ext}` (jpg/png/webp).
- **Публичный URL:** `https://videoai-media.storage.yandexcloud.net/uploads/{userId}/{ts}.ext`.
- **Эндпоинт:** `POST /api/upload` (requireAuth, multipart, поле `image`).

## Движок задач — тип 'animate'

### Списание
1. Роут `POST /api/jobs` проверяет `free_{modelKey}` у юзера.
2. Если `free_wan > 0` (или `free_veo > 0`) — передаёт `freeColumn='free_wan'` в createJob, `costCredits=0`.
3. `createJob` в транзакции (BEGIN → SELECT FOR UPDATE → UPDATE free_column - 1 → INSERT job → COMMIT).
4. Если free нет — обычное списание кредитов в транзакции.
5. `_freeColumn` сохраняется в input задачи (для восстановления при сбое).

### Возврат при ошибке
- `failJob` проверяет `input._freeColumn`:
  - Если есть и валидный (`free_wan` / `free_veo`) — `UPDATE users SET free_X = free_X + 1`.
  - Иначе — возвращает `cost_credits` как обычно.
- Валидация: `['free_wan', 'free_veo'].includes(freeColumn)` — защита от SQL injection.

### Progress
| Этап | Процент |
|---|---|
| Старт runAnimate | 10% |
| После submit в fal queue | 20% |
| IN_PROGRESS от fal | 50% |
| COMPLETED, получаем result | 70% |
| Скачали видео | 80% |
| Залили в S3 | 95% |
| Финал (runJob → done) | 100% |

## Экономика (как реализовано)
- `CREDITS_WAN` = `process.env.CREDITS_WAN || 40` (читается в falVideo.js при старте).
- `CREDITS_VEO` = `process.env.CREDITS_VEO || 90`.
- `free_wan` / `free_veo` — по умолчанию 1/1 для нового юзера (ALTER TABLE в db.js).
- **UI:** перед запуском показывает «Бесплатно (пробная генерация)» если free > 0, иначе «Стоимость: N кр. У вас: M».
- Кнопка disabled если кредитов < стоимости и free = 0.

## Схема БД
Новые поля в `users`:
- `free_wan INTEGER DEFAULT 1` — бесплатные генерации Wan
- `free_veo INTEGER DEFAULT 1` — бесплатные генерации Veo

В `brief` (JSONB поле projects):
- Раньше: `{ topic, style, duration, selectedScenario, scenarios, scenes_media, voice }`
- Теперь: `{ source: 'upload', image_url, model, motion, video_url }`
- Старые поля не мигрированы, просто не читаются. Старые проекты останутся с устаревшим brief.

В `projects`:
- `result_url` — URL готового MP4 (заполняется при успехе задачи animate).
- `status` — ставится `'ready'` при завершении.

## Переменные окружения
| Переменная | Назначение | В Railway |
|---|---|---|
| `FAL_KEY` | API-ключ fal.ai | ✅ Добавлен |
| `CREDITS_WAN` | Стоимость Wan | ❌ Не добавлен (дефолт 40) |
| `CREDITS_VEO` | Стоимость Veo | ❌ Не добавлен (дефолт 90) |
| `WELCOME_CREDITS` | Кредиты при регистрации | ✅ Был (50) |
| `ADMIN_EMAIL` | Промоут в admin | ✅ Был |

Yandex-переменные (YANDEX_API_KEY, YANDEX_FOLDER_ID) остались в Railway, но код их больше не читает. S3-переменные (S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET) — всё ещё используются для хранилища.

## Новые зависимости
| Пакет | Назначение |
|---|---|
| `@fal-ai/client` | Официальный клиент fal.ai — queue submit/status/result |
| `multer` | Middleware для multipart file upload в Express |

## Как проверить (чек-лист, живой тест на ddvideoai.ru)
1. Войти (OTP)
2. «Новый креатив» → попасть на EditorPage
3. Загрузить фото товара (drag&drop или клик) → должен показаться превью
4. Проверить что фото появилось в бакете: `uploads/{userId}/...`
5. Выбрать движение (наезд/поворот/облёт/парение)
6. Попробовать ввести свой промпт в поле — должен заменить пресет
7. Выбрать Wan (эконом) → должно написать «Бесплатно (пробная генерация)»
8. «Создать креатив» → прогресс (10% → 20% → 50% → 70% → 80% → 95% → 100%)
9. Готовый MP4 — воспроизводится в плеере на странице
10. «Скачать MP4» — файл скачивается
11. Проверить файл в бакете: `projects/{projectId}/creative-{ts}.mp4`
12. В админке (/admin): free_wan стало 0, кредиты не списаны
13. Создать ещё один Wan → теперь за кредиты (40 кр.), кредиты списались
14. Первая Veo → бесплатно (free_veo=1→0)
15. Сбой: если fal вернул ошибку → кредиты/free-попытка вернулись (проверить в логах Railway)
16. Dashboard: карточка проекта с thumbnail + бейдж «Готово»
17. ProjectPage: видео-плеер + скачать

## Технический долг
1. **llm.js импортирует удалённый scenario.js** — упадёт при import. Не ломает сервер сейчас (никто не импортирует llm.js), но нужно починить в Спринте B.
2. **scenarioParser.js** — мёртвый файл, не удалён.
3. **AdminPage** — цветовая маркировка типов `storyboard`/`regenerate_scene` — мёртвые ветки.
4. **HomePage (лендинг)** — тексты про SpeechKit, Kandinsky, «российский стек без VPN». Не соответствует новому продукту. Нужен отдельный редизайн.
5. **Параметры fal** — `enable_audio`, `resolution`, `duration` не передаются явно. Может привести к лишним расходам (аудио) или неоптимальному качеству.
6. **Нет валидации размера/формата** загруженного изображения на стороне бэка — multer проверяет mimetype и размер, но не содержимое (можно загрузить текстовый файл с mimetype image/jpeg).

## Известные баги
**Не тестировалось живьём.** Возможные проблемы:
1. Endpoint'ы fal могут требовать дополнительные обязательные параметры — первый запрос покажет.
2. Формат ответа fal может не содержать `video.url` — код пробует 3 варианта, но если ни один не подойдёт — ошибка.
3. Публичный URL из нашего бакета может быть недоступен для fal (если фаерволл/регион).
4. `fal.config({ credentials })` вызывается при каждом запросе в `ensureConfig()` — не кешируется, потенциальный overhead (минимальный).

## Вопросы / на что обратить внимание
1. **Первый живой тест** — нужно прогнать Wan и Veo руками, посмотреть логи, убедиться что endpoint'ы верные и формат ответа совпадает.
2. **Аудио** — если fal генерирует аудио по умолчанию, добавить `enable_audio: false` (или аналог) в submitInput. Экономит ~50% стоимости по некоторым моделям.
3. **Лендинг** — тексты устарели, нужно обновить под «AI Creative Engine» перед публичным запуском.
4. **llm.js** — починить импорт перед Спринтом B (убрать импорт scenario.js, переписать под новый формат промптов для креативов).
5. **Пресеты движений** — промпты на английском, захардкожены. Возможно стоит добавить промпт-инженерию (тон, стиль товара) позже.
