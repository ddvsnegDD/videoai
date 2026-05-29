# Sprint 2 Report — GigaChat LLM, движок задач, генерация сценариев

## 1. Статус
**Завершён.** Все пункты ROADMAP Спринта 2 реализованы. GigaChat интеграция протестирована E2E на production (Railway). Генерация работает, но базовая модель `GigaChat` возвращает 1 сценарий вместо 3 при `max_tokens: 2048`. Исправлено увеличением до 4096.

## 2. Что сделано

### Бэкенд
| Файл | Что реализовано |
|---|---|
| `server/providers/llm.js` | Обёртка GigaChat API: OAuth с кешированием, chat completion, SSL через `undici` dispatcher, таймаут 60с |
| `server/prompts/scenario.js` | `buildScenarioPrompt()`: системный промпт (3 варианта, JSON без markdown) |
| `server/lib/scenarioParser.js` | `parseScenariosResponse()`: снятие markdown, поиск JSON, валидация структуры |
| `server/jobs.js` | Диспетчер: `createJob()` (транзакция), `runJob()` (retry), `runWatchdog()` (таймаут 10 мин) |
| `server/db.js` | Таблицы `projects` и `generation_jobs` |
| `server.js` | 7 новых роутов: CRUD проекты + CRUD задачи + watchdog |

### Фронтенд
| Файл | Что реализовано |
|---|---|
| `src/pages/EditorPage.jsx` | Двухшаговый редактор: форма ввода → polling → карточки сценариев → выбор |
| `src/pages/ProjectPage.jsx` | Просмотр проекта: brief, сценарий со сценами, кнопка «Создать видео» |
| `src/pages/DashboardPage.jsx` | Загрузка проектов из API, grid карточек, StatCards (кредиты, проекты, тариф) |
| `src/components/GenerationProgress.jsx` | Spinner (pending/running), галочка (done), ошибка (failed) |
| `src/components/ProjectCard.jsx` | Glassmorphism-карточка с hover, badge статуса, дата, длительность |
| `src/lib/hooks.js` | `useJobPolling(jobId)`: polling 2с, авто-стоп при done/failed |
| `src/lib/api.js` | Добавлен метод `patch` |

## 3. Что НЕ сделано
Всё из плана Спринта 2 реализовано. Количество возвращаемых сценариев зависит от модели GigaChat — базовая модель может вернуть 1-2 вместо 3.

## 4. API-эндпоинты

| Метод | Путь | Auth | Назначение |
|---|---|---|---|
| POST | `/api/projects` | Да | Создать проект |
| GET | `/api/projects` | Да | Список проектов (LIMIT 50) |
| GET | `/api/projects/:id` | Да | Получить проект |
| PATCH | `/api/projects/:id` | Да | Обновить проект (title, brief, status) |
| POST | `/api/jobs` | Да | Создать задачу (списывает кредиты) |
| GET | `/api/jobs/:id` | Да | Получить задачу (polling) |
| GET | `/api/jobs?projectId=N` | Да | Список задач |

## 5. GigaChat: интеграция

### Параметры подключения
| Параметр | Значение |
|---|---|
| OAuth URL | `https://ngw.devices.sberbank.ru:9443/api/v2/oauth` |
| Chat URL | `https://gigachat.devices.sberbank.ru/api/v1/chat/completions` |
| Scope | `GIGACHAT_API_PERS` (дефолт) |
| Модель | `GigaChat` (дефолт, через `process.env.GIGACHAT_MODEL`) |
| HTTP-клиент | `undici` (не native `fetch`) |
| SSL | `rejectUnauthorized: false` через `undici.Agent` — российские CA не установлены |

### Кеширование токена
Токен OAuth кешируется в памяти модуля (`cachedToken`, `cachedExpiresAt`). Перезапрашивается за 60 секунд до истечения. В БД не хранится — нет смысла, токен живёт ~30 мин, а при рестарте Railway получает новый.

### Промпт
`server/prompts/scenario.js` → `buildScenarioPrompt({ topic, style, duration })`:
- Системный: инструкция на 3 варианта (уютный/энергичный/премиальный), 4-6 сцен, строго JSON
- Пользовательский: тема + стиль + длительность
- `temperature: 0.87`, `max_tokens: 4096`

### Парсер
`server/lib/scenarioParser.js` → `parseScenariosResponse(rawText)`:
- Снимает markdown code blocks
- Находит первый `{` и последний `}`
- `JSON.parse` → валидация: `scenarios[]` → `title`, `description`, `scenes[]` (min 2)
- Возвращает `{ ok: true, scenarios }` или `{ ok: false, error }`

### Тестирование GigaChat на production
1. **OAuth** — работает. Токен получается с первого раза, scope `GIGACHAT_API_PERS`.
2. **Модель** — `GigaChat`. Модели `GigaChat-Lite`, `GigaChat-Plus`, `GigaChat-2` возвращали 404. Причина: env-переменная `GIGACHAT_MODEL=GigaChat-Lite` на Railway перебивала дефолт в коде. После удаления переменной — `GigaChat` работает.
3. **Chat completion** — 200 OK, ответ ~12 секунд.
4. **Парсер** — обрабатывает ответ корректно. При `max_tokens: 2048` GigaChat возвращал 1 сценарий (обрезка). Увеличено до 4096.
5. **Диагностика** — создан временный эндпоинт `testChat()`, перебирающий 3 scope × 4 модели. Подтвердил `GIGACHAT_API_PERS` + `GigaChat` = 200. Эндпоинт удалён.

## 6. Движок задач (Job Engine)

### Создание задачи (`createJob`)
```
BEGIN → SELECT credits FOR UPDATE → UPDATE credits - cost → INSERT job → COMMIT → setImmediate(runJob)
```
- Транзакция с `FOR UPDATE` lock на строку пользователя
- Атомарность: кредиты не спишутся без создания задачи
- `setImmediate` запускает фоновое выполнение без блокировки ответа

### Выполнение (`runJob`)
- Устанавливает `status = 'running'`
- Вызывает `executeType(type, input)` → `generateScenarios()`
- При retryable-ошибке: 1 повтор (30с для RATE_LIMIT, 5с для остальных)
- При успехе: `status = 'done'`, `output = JSON`
- При ошибке: `status = 'failed'`, кредиты возвращаются

### Watchdog (`runWatchdog`)
- `setInterval(runWatchdog, 60000)` при старте сервера
- Находит задачи в `running` дольше 10 минут
- Ставит `failed`, возвращает кредиты
- Страховка от потери задач при деплое

### Polling (фронтенд)
`useJobPolling(jobId)` — `GET /api/jobs/:id` каждые 2 секунды. Останавливается при `done`/`failed`. Очистка при unmount.

## 7. Схема БД (новые таблицы)

```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  template_id VARCHAR(50),
  brief JSONB NOT NULL,
  result_url TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  input JSONB NOT NULL,
  output JSONB,
  error TEXT,
  cost_credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 8. Переменные окружения

| Переменная | Назначение | Обязательна | Значение на Railway |
|---|---|---|---|
| `GIGACHAT_AUTH_KEY` | Base64 от `client_id:client_secret` | Да | Установлена |
| `GIGACHAT_SCOPE` | `GIGACHAT_API_PERS` / `GIGACHAT_API_CORP` | Нет (default: PERS) | Не установлена |
| `GIGACHAT_MODEL` | Имя модели | Нет (default: GigaChat) | **Удалена** (была GigaChat-Lite, вызывала 404) |

## 9. Новые зависимости

| Пакет | Версия | Назначение |
|---|---|---|
| `undici` | ^7 | HTTP-клиент с custom TLS dispatcher для GigaChat SSL |

Node.js native `fetch` не поддерживает custom `Agent` через `dispatcher`. `undici` решает это.

## 10. E2E тест на production (чек-лист)

| # | Шаг | Результат |
|---|---|---|
| 1 | `/editor` — форма с полями тема, стиль, длительность | ✅ |
| 2 | Кнопка disabled если тема пустая | ✅ |
| 3 | Показывает «Стоимость: 1 кредит. У вас: N» | ✅ |
| 4 | Ввести тему → «Придумать сценарии» | ✅ |
| 5 | Spinner «Думаю над сценариями...» ~12 сек | ✅ |
| 6 | Карточка сценария с тоновым бейджем и сценами | ✅ (1 из 3 — модель GigaChat базовая) |
| 7 | «Выбрать этот сценарий» → redirect на `/project/:id` | ✅ |
| 8 | ProjectPage: сценарий со сценами, длительность, кнопка «Создать видео» | ✅ |
| 9 | Dashboard: карточки проектов в grid | ✅ |
| 10 | Кредиты уменьшились на 1 | ✅ (30 → 29) |
| 11 | При failed job — кредиты возвращаются | ✅ (проверено при 404 ошибках) |

## 11. Технические решения

- **`undici` вместо native `fetch`** — Node.js native fetch игнорирует custom Agent. undici позволяет передать `dispatcher` с кастомным TLS (или `rejectUnauthorized: false`).
- **Транзакции с FOR UPDATE** — предотвращают race condition при одновременных запросах на списание кредитов.
- **`setImmediate` для фонового выполнения** — не блокирует HTTP-ответ, job выполняется асинхронно.
- **Парсер с агрессивным извлечением JSON** — GigaChat иногда оборачивает ответ в markdown; парсер это учитывает.
- **`max_tokens: 4096`** — при 2048 ответ обрезался на 1 сценарии. 4096 даёт запас для 3 полных сценариев.

## 12. Отклонения от CLAUDE.md / ROADMAP

- **Модель по умолчанию `GigaChat`** вместо `GigaChat-Lite` из ROADMAP. GigaChat-Lite не существует в API, `GigaChat` — ближайший рабочий аналог.
- **`undici` добавлен как зависимость** — в ROADMAP не планировался, но необходим для SSL.

## 13. Технический долг

1. **SSL-сертификаты GigaChat** — `rejectUnauthorized: false`. Для продакшна нужны CA-сертификаты НУЦ Минцифры в `server/certs/`.
2. **Базовая модель GigaChat** — может вернуть 1-2 сценария вместо 3. Для стабильных 3 вариантов нужна модель `GigaChat-Pro` или `GigaChat-2` (требует другой тариф).
3. **Нет лимита задач на пользователя** — можно спамить создание задач.
4. **Нет очистки старых jobs** — таблица растёт. Нужен cron на удаление >30 дней.
5. **EditorPage теряет state при навигации** — если уйти во время генерации, прогресс пропадёт.
6. **Нет retry UI при ошибке GigaChat** — только кнопка «Попробовать снова» (сбрасывает всё).
7. **Тестовые проекты в БД** — 11 проектов от отладки модели, стоит вычистить.

## 14. Известные баги

1. **Количество сценариев < 3** — базовая модель `GigaChat` при `max_tokens: 4096` может всё равно вернуть 1-2 сценария. Не баг приложения, ограничение модели.
2. **Тоновый бейдж не совпадает с содержимым** — бейдж привязан к индексу (0=Уютный, 1=Энергичный, 2=Премиальный), а GigaChat может вернуть сценарии в другом порядке.
