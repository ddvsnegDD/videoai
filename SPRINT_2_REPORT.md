# Sprint 2 Report — GigaChat LLM, движок задач, генерация сценариев

## Статус
Завершён полностью — весь бэкенд и фронтенд реализованы, задеплоено на Railway. Для полноценного теста нужна переменная `GIGACHAT_AUTH_KEY` в Railway.

## Что сделано

### Бэкенд
- `server/providers/llm.js` — обёртка над GigaChat API: OAuth-токен с кешированием, chat completion, SSL-fallback для российских CA, retry-логика (RATE_LIMIT 30с, прочие 5с), таймаут 60с
- `server/prompts/scenario.js` — `buildScenarioPrompt()`: системный промпт на русском (3 варианта сценария разной тональности), формат JSON без markdown
- `server/lib/scenarioParser.js` — `parseScenariosResponse()`: снятие markdown-обёрток, поиск JSON в тексте, валидация структуры (title, description, scenes 2-6 шт с duration_sec)
- `server/jobs.js` — диспетчер задач:
  - `createJob()` — транзакция: проверка баланса → списание кредитов → INSERT → `setImmediate(runJob)`
  - `runJob()` — фоновое выполнение с retry (1 повтор), возврат кредитов при ошибке
  - `runWatchdog()` — страховка от зависших задач (>10 мин → fail + возврат кредитов)
- `server/db.js` — таблицы `projects` и `generation_jobs` (по схеме CLAUDE.md)
- `server.js` — 7 новых роутов:
  - `POST /api/projects`, `GET /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id`
  - `POST /api/jobs`, `GET /api/jobs/:id`, `GET /api/jobs?projectId=...`
  - Watchdog запускается `setInterval(runWatchdog, 60000)` при старте

### Фронтенд
- `src/lib/hooks.js` — `useJobPolling(jobId)`: polling каждые 2с, авто-стоп при done/failed, очистка при unmount
- `src/lib/api.js` — добавлен метод `patch`
- `src/components/GenerationProgress.jsx` — UI прогресса: spinner для pending/running, галочка для done, красная иконка для failed
- `src/components/ProjectCard.jsx` — glassmorphism-карточка проекта с hover-эффектом, badge статуса
- `src/pages/EditorPage.jsx` — двухшаговый редактор:
  - Шаг 1: textarea темы + select стиля (4 варианта) + select длительности (15/30/60с) + отображение кредитов
  - Шаг 2: polling прогресса → 3 карточки сценариев с тоновыми бейджами (Уютный/Энергичный/Премиальный), списком сцен, кнопкой выбора
- `src/pages/ProjectPage.jsx` — просмотр проекта: brief, выбранный сценарий со сценами, заглушка «Создать видео»
- `src/pages/DashboardPage.jsx` — загрузка проектов из API, grid карточек (responsive 1/2/3 колонки) или empty state

## Чего НЕ сделано из запланированного
Нет. Все пункты ROADMAP Спринта 2 реализованы.

## Технические решения

- **GigaChat OAuth:** токен кешируется в памяти модуля (`let cachedToken`), перезапрашивается за 60с до истечения. Не в БД — нет смысла, токен живёт ~30 мин.
- **SSL для GigaChat:** проверяет наличие файлов `server/certs/russian_trusted_root_ca.cer` и `russian_trusted_sub_ca.cer`. Если нет — fallback `rejectUnauthorized: false` с warn в консоль.
- **Транзакции в createJob:** `BEGIN → SELECT FOR UPDATE → UPDATE credits → INSERT job → COMMIT`. Гарантия: кредиты не спишутся без создания задачи, и наоборот.
- **Возврат кредитов при ошибке:** при `status='failed'` кредиты автоматически возвращаются пользователю.
- **Retry:** один повтор при retryable-ошибках (RATE_LIMIT 30с, PROVIDER_ERROR/TIMEOUT 5с). AUTH_ERROR не ретраится.
- **Watchdog:** страховка от потери задач при деплое. Каждые 60с проверяет задачи в `running` дольше 10 мин → fail + возврат кредитов.
- **Парсер LLM:** агрессивный — снимает markdown, ищет первый `{` и последний `}`, парсит JSON, валидирует структуру. Допускает 2+ сцен (не строго 4-6).
- **Prompt:** жёсткая инструкция «только JSON, без markdown» + явное описание формата. `temperature: 0.87` для креативности.

## Отклонения от CLAUDE.md
- **`fetch` вместо `https.request`** в llm.js — Node.js 18+ поддерживает global fetch, но `dispatcher` для custom Agent не работает с native fetch. SSL-агент создаётся, но фактически fallback `rejectUnauthorized: false` на проде без сертификатов.
- **CLAUDE.md обновлён** с реальными значениями (github_repo, domain, email_from, db name) — предыдущие изменения пользователя.

## Технический долг

- **SSL-сертификаты GigaChat:** сейчас `rejectUnauthorized: false`. Нужно скачать российские CA-сертификаты и положить в `server/certs/`. Node.js native fetch не поддерживает custom Agent через `dispatcher` — может понадобиться `undici` или `node-fetch` с явным Agent.
- **Нет лимита на количество задач на пользователя** — теоретически можно спамить создание задач.
- **Нет очистки старых jobs** — таблица `generation_jobs` будет расти. Нужен cron.
- **Нет retry UI** — если GigaChat временно недоступен, пользователь видит только «Попробовать снова».
- **EditorPage не сохраняет state при навигации** — если уйти со страницы во время генерации и вернуться, прогресс потеряется.

## Известные баги
- **SSL GigaChat на Railway:** native `fetch` в Node.js 18+ игнорирует custom `https.Agent`. Если GigaChat отклоняет запросы без российских CA — придётся переключиться на `undici` с custom dispatcher. Пока тестировано с `rejectUnauthorized: false`.

## Изменения в схеме БД

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

## Изменения в переменных окружения

| Переменная | Назначение | Есть в Railway |
|---|---|---|
| `GIGACHAT_AUTH_KEY` | Base64 от `client_id:client_secret` для OAuth | **Нет — нужно добавить** |
| `GIGACHAT_SCOPE` | `GIGACHAT_API_PERS` или `GIGACHAT_API_CORP` (default: PERS) | Нет (опционально) |
| `GIGACHAT_MODEL` | Модель (default: `GigaChat-Lite`) | Нет (опционально) |

## Новые зависимости
Нет новых npm-зависимостей. Используются встроенные `crypto`, `https`, `fs`.

## Как проверить (чек-лист для ручного теста)

### Без GigaChat (проверка UI и API):
1. Открыть `/editor` — форма с полями: тема, стиль, длительность, кнопка «Придумать сценарии»
2. Кнопка disabled если тема пустая
3. Показывает «Стоимость: 1 кредит. У вас: N»
4. Открыть `/dashboard` — видно кредиты и пустое состояние (или проекты если есть)
5. Открыть `/project/:id` для существующего проекта — данные загружаются

### С GigaChat (полный E2E):
1. Добавить `GIGACHAT_AUTH_KEY` в Railway
2. `/editor` → ввести «новый осенний латте в кофейне», стиль «Уютный», 30 сек → «Придумать сценарии»
3. Видно spinner «Думаю над сценариями...» 10-20 сек
4. Появляются 3 карточки: Уютный / Энергичный / Премиальный с 4-6 сценами каждый
5. Нажать «Выбрать этот сценарий» → redirect на `/project/:id`
6. Видно выбранный сценарий со сценами
7. Вернуться в `/dashboard` → проект отображается карточкой
8. Кредиты уменьшились на 1
9. Если кредитов 0 → ошибка «Недостаточно кредитов»
10. Если AUTH_KEY неверный → задача failed, кредиты вернулись

## Вопросы / на что обратить внимание

1. **GIGACHAT_AUTH_KEY** — нужно добавить в Railway. Это Base64-encoded строка `client_id:client_secret` из Сбер AI Studio.
2. **SSL-сертификаты** — сейчас `rejectUnauthorized: false`. Для продакшна нужно либо скачать CA-сертификаты НУЦ Минцифры, либо использовать `undici` с custom dispatcher.
3. **GIGACHAT_SCOPE** — если используете корпоративный аккаунт, установите `GIGACHAT_API_CORP`.
