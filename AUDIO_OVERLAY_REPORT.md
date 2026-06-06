# Audio Overlay Report — наложение звуковой дорожки

## Фича
Пользователь загружает свой аудиофайл (MP3/AAC/WAV/OGG) на странице готового проекта и получает версию ролика с этой музыкой. FFmpeg на сервере (8.0.1).

**Дата:** 04.06.2026
**Статус:** завершён (код, фронт, билд — готовы; живой тест требует ffmpeg на сервере)

---

## Изменённые файлы

### 1. `server/audio.js` — НОВЫЙ (69 строк)

Модуль FFmpeg-микширования. Экспорт: `mixAudioIntoVideo({ videoUrl, audioBuffer, audioExt })`.

**Команда ffmpeg:**
```
ffmpeg -y -i video.mp4 -i audio.<ext> \
  -filter_complex "[1:a]afade=t=out:st=<D-1>:d=1[a]" \
  -map 0:v:0 -map "[a]" \
  -c:v copy -c:a aac -b:a 192k -shortest \
  out.mp4
```

- `-c:v copy` — видео НЕ перекодируется (быстро, мало RAM)
- `-shortest` — обрезает аудио по длине видео
- `afade=t=out:st=<D-1>:d=1` — fade-out 1 сек в конце
- Длительность D определяется через `ffprobe`
- `child_process.spawn` (не блокирует event loop), таймаут 60 сек
- Все tmp-файлы удаляются в `finally`

### 2. `server.js` — добавлен audioUpload и эндпоинт

**audioUpload** (multer, рядом с `upload`):
- 20 МБ лимит
- MIME-типы: `audio/mpeg`, `audio/mp3`, `audio/aac`, `audio/mp4`, `audio/x-m4a`, `audio/wav`, `audio/x-wav`, `audio/ogg`

**`POST /api/projects/:id/audio`** (requireAuth):
1. Загружает проект, проверяет владельца
2. Берёт `brief.video_url || result_url` — если нет → 400 `no_video`
3. Защита от параллельного спама: `mixingProjects` Set в памяти → 429 `mix_in_progress`
4. Заливает исходный аудио в S3: `projects/{id}/audio-source.{ext}`
5. FFmpeg-микс → `projects/{id}/video-audio-{ts}.mp4`
6. Обновляет `brief`: добавляет `audio_video_url` и `audio_source_url`; `video_url` и `result_url` **не трогает**
7. Кредиты **не списывает**; `generation_jobs`/`payments` **не затрагивает**

### 3. `src/App.jsx` — возвращён роут `/project/:id`

Роут был убран в Sprint C (упоминание в SPRINT_C_REPORT: «убраны из маршрутизации»). Добавлен обратно:
```jsx
<Route path="/project/:id" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
```

### 4. `src/pages/ProjectPage.jsx` — UI наложения звука

Добавлено под видеоплеером (показывается только при наличии `videoUrl`):

- **Блок «Добавить музыку»**: `<input type="file" accept="audio/*">` + кнопка «Наложить»
- **Подпись**: «MP3, AAC, WAV или OGG, до 20 МБ. Музыка обрежется по длине ролика»
- **Состояния**: idle → «Накладываю звук…» (спиннер) → ошибка (красный текст) / успех
- **Переключатель «Со звуком / Оригинал»**: появляется после успешного наложения; переключает `<video src>` между `audio_video_url` и оригинальным `video_url`
- **Скачать MP4**: скачивает текущую активную версию
- При загрузке страницы: если `brief.audio_video_url` уже есть — сразу показывает версию со звуком
- Стиль: glass-карточка, иконки Lucide (Music, Upload, Volume2, VolumeX), объект `C` из `theme.js`

---

## Что НЕ изменено

| Элемент | Файл | Статус |
|---|---|---|
| Движок задач (idempotency, reconciler, refunded) | jobs.js | ✅ Не тронут |
| Existing `/api/upload` для фото | server.js | ✅ Не тронут |
| Multer `upload` (image-only) | server.js | ✅ Не тронут |
| Платежи (payments.js) | server/payments.js | ✅ Не тронуты |
| Авторизация (auth.js) | server/auth.js | ✅ Не тронута |
| Генерация (falVideo, falImage) | providers/* | ✅ Не тронуты |
| `result_url` / `brief.video_url` | — | ✅ Оригинал сохранён |

---

## S3-ключи (хранение)

| Ключ | Содержимое |
|---|---|
| `projects/{id}/audio-source.{ext}` | Исходный аудиофайл (MP3/WAV/OGG/AAC) |
| `projects/{id}/video-audio-{timestamp}.mp4` | Результат микса (видео + звук) |

При удалении проекта: `DELETE /api/projects/:id` → `deleteByPrefix('projects/{id}/')` — автоматически удалит и аудиофайлы.

---

## Edge-cases

| Ситуация | Поведение |
|---|---|
| Аудио короче видео | `-shortest` оставит хвост видео без звука (тишина) |
| Файл не аудио / >20 МБ | multer отклоняет → 400 с понятным сообщением |
| Параллельный спам миксом | `mixingProjects` Set → 429 `mix_in_progress` |
| Ошибка ffmpeg | Tmp-файлы удалены, 500 `mix_failed`, сообщение в логах |
| Повторное наложение | Новый `video-audio-{ts}.mp4` перезаписывает URL в brief; старый файл остаётся в S3 (cleanup при удалении проекта) |

---

## Тесты

### Проверено

| Тест | Результат |
|---|---|
| `node --check server.js` | PASS |
| `node --check server/audio.js` | PASS |
| `npm run build` (Vite) | PASS (1639 модулей, 337 KB JS) |
| «Добавить музыку» в бандле | PASS (grep: 1 совпадение) |
| `audio_video_url` в бандле | PASS (grep: 1 совпадение) |
| S3 cleanup prefix совпадает | PASS (`projects/{id}/`) |
| Роут `/project/:id` в App.jsx | PASS |

### НЕ проверено (требуется сервер с ffmpeg)

- Живой upload MP3 → ffmpeg mix → скачивание результата
- Fade-out 1 сек в конце
- Переключатель «Со звуком / Оригинал» на реальном видео
- Multer rejection для >20 МБ и неподдерживаемых типов

---

## DoD

- [x] `node --check server.js`, `node --check server/audio.js` — без ошибок
- [x] `npx vite build` — без ошибок (1639 модулей)
- [x] Видео НЕ перекодируется (`-c:v copy`), звук обрезан по длине, fade-out 1 сек
- [x] Кредиты не списываются; `generation_jobs`/`payments` не затронуты; money-leak не изменён
- [x] Оригинальный ролик сохранён (`result_url`/`brief.video_url` не перезаписаны)
- [x] Временные файлы в `/tmp` удаляются всегда (finally)
- [x] Данный отчёт `AUDIO_OVERLAY_REPORT.md` создан

---

## Деплой

На сервере: `git pull` → `npm ci` → `npm run build` → `pm2 restart videoai`. Новых npm-зависимостей нет. FFmpeg уже 8.0.1.
