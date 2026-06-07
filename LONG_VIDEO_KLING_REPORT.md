# Long Video Kling — Phase 1 Report

## Цель
Генерация видео Kling 2.5 длительностью 5 / 10 / 15 / 20 секунд.
- 5с и 10с — одиночный сегмент (5с через старый flow, 10с через группу из 1 сегмента)
- 15с = 10с + 5с, 20с = 10с + 10с — мультисегментная генерация с FFmpeg concat

**Дата:** 07.06.2026
**Статус:** код готов (билд, синтаксис — без ошибок)

---

## Архитектура

### Сегментная группа
- Каждая длинная генерация (10/15/20с) создаёт запись в `video_groups` + N записей в `generation_jobs` с `group_id`
- Каждый сегмент — полноценная задача через `createJob`-подобный flow с индивидуальным `cost_credits`
- Общая стоимость: `8 кр./сек` (5с=40, 10с=80, 15с=120, 20с=160)
- Списание: атомарно в одной транзакции при создании группы

### Money-leak защита
- Идемпотентный возврат через `refunded` flag (из существующего `failJob`)
- При сбое любого сегмента: `failGroup` → возврат кредитов за все done-сегменты
- При ошибке concat: группа переходит в `failed`, все кредиты возвращаются
- Двойная финализация предотвращена: атомарный `UPDATE ... SET status='finalizing' WHERE status='pending'`

### free_wan
- Бесплатная генерация — только для 5с (старый flow, без групп)
- Для 10/15/20с free_wan не применяется (решение обосновано: бесплатная проба — ознакомление, длинные видео — платная функция)

---

## Изменённые / созданные файлы

### 1. `server/db.js`
- Миграции: 3 новых колонки в `generation_jobs`: `group_id UUID`, `segment_index INTEGER`, `segment_duration TEXT`
- Новая таблица `video_groups`: id, project_id, user_id, target_duration, segments_count, status, created_at

### 2. `server/providers/falVideo.js`
- `submitToFal`: новый параметр `durationSec` (передаётся в fal API как `duration`)
- Убран хардкод `duration: '5'` → `duration: durationSec || '5'`

### 3. `server/concat.js` (НОВЫЙ)
- FFmpeg concat demuxer для склейки видеосегментов
- Нормализация сегментов через re-encode (libx264, yuv420p) для совместимости
- Паттерн spawn + timeout + cleanup из `audio.js`
- Timeout: 120 сек

### 4. `server/jobs.js` (528→781 строк)
- **Константы**: `DURATION_SEGMENTS`, `CREDITS_PER_SEC`
- **`createSegmentGroup()`**: атомарное создание группы + N сегментных задач в одной транзакции
  - Проверка активных задач для проекта (dedup)
  - Проверка баланса, списание total credits
  - Создание `video_groups` + N `generation_jobs` с group_id/segment_index/segment_duration
  - `setImmediate` запуск всех сегментов параллельно
- **`getGroup()`**: чтение группы + сегментов для API, средний прогресс
- **`tryFinalizeGroup()`**: проверка всех сегментов, concat если все done, fallback при ошибках
  - 1 сегмент → без concat
  - 2+ сегментов → FFmpeg concat → upload S3 → update project
  - Atomic lock через `UPDATE ... SET status='finalizing' WHERE status='pending'`
- **`failGroupInternal()`**: возврат кредитов за все done-сегменты, пометка project status='error'
- **`runJob()`**: group-aware финализация — сегменты не обновляют проект, вызывают `tryFinalizeGroup`
- **`runAnimate()`**: передача `durationSec` в `submitToFal`
- **`failJob()`**: после рефанда проверяет group_id → вызывает `tryFinalizeGroup`
- **Reconciler**: `group_id` в SELECT, group-aware COMPLETED handling, trigger `tryFinalizeGroup`

### 5. `server.js`
- Import: `createSegmentGroup`, `getGroup`
- **`POST /api/jobs` (animate branch)**: 
  - Валидация `targetDuration` (5/10/15/20)
  - `targetDuration > 5` → `createSegmentGroup()`
  - `targetDuration === 5` → старый flow (createJob + free_wan)
- **`GET /api/groups/:id`** (НОВЫЙ): возврат группы с сегментами и прогрессом

### 6. `src/lib/hooks.js`
- **`useGroupPolling()`** (НОВЫЙ): поллинг `GET /api/groups/:id` каждые 3с до финализации

### 7. `src/pages/EditorPage.jsx`
- Import: `useGroupPolling`
- State: `targetDuration` (default 5), `groupId`
- **Duration selector**: 4 кнопки (5/10/15/20с) под ModelCard Kling с ценами
- **Предупреждение о склейке**: для 15/20с — "на стыках возможна смена плана"
- **Credits**: пересчёт `modelCredits = targetDuration * 8`, `isFree` только для 5с
- **handleCreate**: отправляет `targetDuration`, обрабатывает `groupId` из ответа
- **Phase**: group-aware (pending/finalizing/ready/failed)
- **Running monitor**: сегментный прогресс, "N из M сцен готово", "Склеиваю ролик..."
- **Failed**: для групп — "Кредиты возвращены на баланс"
- **Done badge**: `Kling 2.5 · {targetDuration}s`
- **Кнопка**: "Сгенерировать за {N} кр." / "Сгенерировать бесплатно"
- **handleReset**: сброс `groupId`

---

## Что НЕ изменено

| Элемент | Статус |
|---|---|
| Veo 3.1 | Не тронут (Phase 2) |
| Платежи (payments.js) | Не тронуты |
| Логика входа / OTP | Не тронута |
| Существующие 5с генерации | Обратная совместимость, flow идентичен |
| free_veo, free_image | Не тронуты |
| Аудио-overlay (audio.js) | Не тронут |
| Watchdog | Не тронут |

---

## Тесты

| Тест | Результат |
|---|---|
| `npx vite build` | PASS (1803 модуля, 487 KB JS) |
| `node --check server.js` | PASS |
| `node --check server/jobs.js` | PASS |
| `node --check server/concat.js` | PASS |
| `node --check server/providers/falVideo.js` | PASS |
| `targetDuration` в бандле | PASS |
| `useGroupPolling` / `/groups/` в бандле | PASS |
| `groupId` в бандле | PASS |
| "склейка" в бандле | PASS |
| `durationSec` в falVideo.js | PASS (2 вхождения) |
| `group_id` в jobs.js | PASS (13 вхождений) |
| `video_groups` в db.js | PASS |
| concat.js существует | PASS |
| `/api/groups` в server.js | PASS |

---

## DoD Checklist

- [x] 5с/10с — одиночный ролик, 15с/20с — мультисегмент + concat
- [x] Каждый сегмент через индивидуальную задачу (job) с credit charge
- [x] Группа fails → все кредиты возвращаются
- [x] falVideo.js: duration параметризован (не hardcoded)
- [x] FFmpeg concat через отдельный модуль (concat.js)
- [x] Reconciler обрабатывает сегменты с group_id
- [x] Frontend: duration selector 5/10/15/20, цены, предупреждение о склейке
- [x] Frontend: group polling, сегментный прогресс, статус "Склеиваю ролик..."
- [x] free_wan — только для 5с (отчёт о решении включён)
- [x] Veo не тронут
- [x] `npx vite build` — без ошибок
- [x] Данный отчёт создан

---

## Деплой (владелец)

1. `git pull`
2. `npm run build`
3. `pm2 restart videoai`
4. Проверить: `/editor` → Kling → выбрать 10с → генерация → результат
5. Убедиться что FFmpeg установлен на сервере (`ffmpeg -version`)

## Требования к серверу

- FFmpeg должен быть установлен и доступен в PATH (для concat)
- PM2 fork mode (1 instance) — уже настроен
