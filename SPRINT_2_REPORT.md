# Sprint 2 Report — GigaChat LLM, движок задач, генерация сценариев

## 1. Статус
**Завершён.** GigaChat интеграция работает на production. Генерация 3 сценариев с разными тонами через 3 последовательных запроса к GigaChat. Экономика: 3 кредита за генерацию, частичный возврат при сбое отдельных вариантов.

## 2. Что сделано

### Бэкенд
| Файл | Что реализовано |
|---|---|
| `server/providers/llm.js` | GigaChat API: OAuth с кешированием, 3 последовательных chat completion (по тонам), SSL через `undici`, таймаут 60с |
| `server/prompts/scenario.js` | `buildScenarioPrompt()` — промпт на ОДИН сценарий заданного тона. Экспорт `TONES[]` (cozy/energetic/premium) |
| `server/lib/scenarioParser.js` | `parseSingleScenario()` — парсер одиночного сценария: снятие markdown, JSON.parse, валидация |
| `server/jobs.js` | Диспетчер: `createJob()` (транзакция), `runJob()` (retry + частичный возврат кредитов), `runWatchdog()` |
| `server/db.js` | Таблицы `projects` и `generation_jobs` |
| `server.js` | 7 роутов: CRUD проекты + CRUD задачи + watchdog |

### Фронтенд
| Файл | Что реализовано |
|---|---|
| `src/pages/EditorPage.jsx` | Двухшаговый редактор: стоимость 3 кредита, бейджи тонов из `scenario.tone`, info-бар при частичном успехе |
| `src/pages/ProjectPage.jsx` | Просмотр проекта: brief, сценарий со сценами, кнопка «Создать видео» |
| `src/pages/DashboardPage.jsx` | Загрузка проектов из API, grid карточек, StatCards (кредиты, проекты, тариф) |
| `src/components/GenerationProgress.jsx` | Spinner «Придумываю 3 варианта... обычно 15-20 секунд» |
| `src/components/ProjectCard.jsx` | Glassmorphism-карточка с hover, badge статуса, дата, длительность |
| `src/lib/hooks.js` | `useJobPolling(jobId)`: polling 2с, авто-стоп при done/failed |
| `src/lib/api.js` | Метод `patch` |

### Закрытые баги (из предыдущей версии)
- ~~Количество сценариев < 3~~ → **Исправлено.** Каждый тон генерируется отдельным запросом. 3 из 3 приходят стабильно.
- ~~Тоновый бейдж не совпадает с содержимым~~ → **Исправлено.** Бейдж берётся из `scenario.tone`, не из индекса массива.
- ~~Тестовые проекты в БД~~ → **Очищено.** 12 jobs + 12 projects удалены через одноразовый эндпоинт.

## 3. Что НЕ сделано
Всё из плана Спринта 2 реализовано.

## 4. API-эндпоинты

| Метод | Путь | Auth | Назначение |
|---|---|---|---|
| POST | `/api/projects` | Да | Создать проект |
| GET | `/api/projects` | Да | Список проектов (LIMIT 50) |
| GET | `/api/projects/:id` | Да | Получить проект |
| PATCH | `/api/projects/:id` | Да | Обновить проект (title, brief, status) |
| POST | `/api/jobs` | Да | Создать задачу (списывает 3 кредита) |
| GET | `/api/jobs/:id` | Да | Получить задачу (polling) |
| GET | `/api/jobs?projectId=N` | Да | Список задач |

## 5. GigaChat: интеграция

### Параметры подключения
| Параметр | Значение |
|---|---|
| OAuth URL | `https://ngw.devices.sberbank.ru:9443/api/v2/oauth` |
| Chat URL | `https://gigachat.devices.sberbank.ru/api/v1/chat/completions` |
| Scope | `GIGACHAT_API_PERS` (дефолт) |
| Модель | `GigaChat` (в биллинге Сбера это тариф «Lite»; имени `GigaChat-Lite` в API нет, даёт 404) |
| HTTP-клиент | `undici` (не native `fetch`) |
| SSL | `rejectUnauthorized: false` через `undici.Agent` — российские CA не установлены |

### Архитектура генерации (3 тона)
Каждый сценарий генерируется **отдельным** запросом к GigaChat со своим тоном:
1. Уютный (тёплый, домашний, душевный)
2. Энергичный (динамичный, молодёжный, драйвовый)
3. Премиальный (минималистичный, дорогой, лаконичный)

Запросы выполняются **последовательно** (не параллельно) — GigaChat PERS блокирует одновременные запросы (2 из 3 возвращали ошибку при parallel). Общее время ~16 секунд.

### Кеширование токена
Токен OAuth кешируется в памяти модуля (`cachedToken`, `cachedExpiresAt`). Перезапрашивается за 60 секунд до истечения.

### Промпт
`server/prompts/scenario.js` → `buildScenarioPrompt({ topic, style, duration, tone })`:
- Системный: инструкция на ОДИН проработанный сценарий в заданном тоне, 4-6 сцен, строго JSON
- Пользовательский: тема + стиль + длительность + тон
- `temperature: 0.9`, `max_tokens: 2048` (на один сценарий хватает)

### Парсер
`server/lib/scenarioParser.js` → `parseSingleScenario(rawText)`:
- Снимает markdown code blocks
- Находит первый `{` и последний `}`
- `JSON.parse` → валидация: `title`, `description`, `scenes[]` (min 2), `duration_sec`
- Tone может отсутствовать — подставляется из контекста запроса

### Экономика генерации
| Параметр | Значение |
|---|---|
| CREDITS_COST | 3 (по 1 за сценарий) |
| Полный успех (3/3) | Списано 3 кредита, возврата нет |
| Частичный успех (N/3) | Списано 3, возврат (3-N) кредитов |
| Полный провал (0/3) | Задача failed, все 3 кредита возвращены |

### Тестирование GigaChat на production
1. **OAuth** — работает. Scope `GIGACHAT_API_PERS`.
2. **Модель** — `GigaChat`. Имена `GigaChat-Lite`, `GigaChat-Plus`, `GigaChat-2` давали 404. Причина: env-переменная `GIGACHAT_MODEL=GigaChat-Lite` на Railway перебивала дефолт. После удаления — работает.
3. **3 последовательных запроса** — 3 из 3 сценариев, ~16 секунд, все тоны различаются.
4. **Partial refund** — протестирован: при 1 из 3 кредиты за 2 несозданных возвращались корректно.

## 6. Движок задач (Job Engine)

### Создание задачи (`createJob`)
```
BEGIN → SELECT credits FOR UPDATE → UPDATE credits - 3 → INSERT job → COMMIT → setImmediate(runJob)
```
- Транзакция с `FOR UPDATE` lock на строку пользователя
- Атомарность: кредиты не спишутся без создания задачи
- `setImmediate` запускает фоновое выполнение без блокировки ответа

### Выполнение (`runJob`)
- Устанавливает `status = 'running'`
- Вызывает `generateScenarios()` → 3 последовательных запроса GigaChat
- При retryable-ошибке: 1 повтор (30с для RATE_LIMIT, 5с для остальных)
- При полном успехе: `status = 'done'`, `output = { scenarios, succeeded: 3, failed: 0 }`
- При частичном успехе: `status = 'done'`, возврат кредитов за неудачные
- При полном провале: `status = 'failed'`, все кредиты возвращаются

### Watchdog (`runWatchdog`)
- `setInterval(runWatchdog, 60000)` при старте сервера
- Находит задачи в `running` дольше 10 минут → `failed` + возврат кредитов

### Polling (фронтенд)
`useJobPolling(jobId)` — `GET /api/jobs/:id` каждые 2 секунды. Авто-стоп при `done`/`failed`. Refresh кредитов при завершении.

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

## 10. E2E тест на production (чек-лист)

| # | Шаг | Результат |
|---|---|---|
| 1 | `/editor` — форма с полями тема, стиль, длительность | ✅ |
| 2 | Кнопка disabled если тема пустая или кредитов < 3 | ✅ |
| 3 | Показывает «Стоимость: 3 кредита (3 варианта). У вас: N» | ✅ |
| 4 | Ввести тему → «Придумать сценарии» | ✅ |
| 5 | Spinner «Придумываю 3 варианта... обычно 15-20 секунд», реально ~16 сек | ✅ |
| 6 | 3 карточки: Уютный / Энергичный / Премиальный, бейджи соответствуют содержанию | ✅ |
| 7 | «Выбрать этот сценарий» → redirect на `/project/:id` | ✅ |
| 8 | ProjectPage: сценарий со сценами, длительность, кнопка «Создать видео» | ✅ |
| 9 | Dashboard: карточки проектов в grid, пустое состояние | ✅ |
| 10 | Кредиты уменьшились на 3 | ✅ |
| 11 | Частичный успех (1/3) — info-бар, кредиты за остальные возвращены | ✅ |
| 12 | Полный провал — задача failed, все 3 кредита возвращены | ✅ |

## 11. Технические решения

- **3 отдельных запроса вместо 1** — каждый тон генерируется отдельным запросом к GigaChat. Промпт фокусирует модель на одном сценарии → глубокая проработка 4-6 сцен.
- **Последовательные запросы** — GigaChat PERS блокирует параллельные вызовы (2 из 3 возвращали ошибку). Последовательные запросы дают стабильные 3/3.
- **Частичный возврат кредитов** — честная экономика: юзер платит только за реально полученные сценарии.
- **`undici` вместо native `fetch`** — Node.js native fetch игнорирует custom Agent для SSL.
- **Транзакции с FOR UPDATE** — предотвращают race condition при списании кредитов.
- **`setImmediate` для фонового выполнения** — не блокирует HTTP-ответ.
- **Refresh кредитов при завершении job** — `useEffect` на `job.status`, корректно показывает баланс после partial refund.
- **Бейджи тонов из данных** — `scenario.tone` вместо индекса массива, корректное соответствие.

## 12. Отклонения от CLAUDE.md / ROADMAP

- **Модель `GigaChat`** — в API нет имени `GigaChat-Lite`. `GigaChat` = тариф Lite в биллинге Сбера.
- **`undici`** — добавлен как зависимость, не был в ROADMAP.
- **Последовательные вместо параллельных** — PERS scope не поддерживает параллельные запросы.
- **3 кредита вместо 1** — каждый тон = отдельный запрос = отдельный кредит.

## 13. Технический долг

1. **SSL-сертификаты GigaChat** — `rejectUnauthorized: false`. Для продакшна нужны CA-сертификаты НУЦ Минцифры.
2. **Нет лимита задач на пользователя** — можно спамить создание задач.
3. **Нет очистки старых jobs** — таблица растёт. Нужен cron на удаление >30 дней.
4. **EditorPage теряет state при навигации** — если уйти во время генерации, прогресс пропадёт.
5. **Нет retry UI при ошибке GigaChat** — только кнопка «Попробовать снова» (сбрасывает всё).

## 14. Известные баги

Нет критических. Все ранее известные баги (1 сценарий вместо 3, бейдж тона, тестовые данные) исправлены.
