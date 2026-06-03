Реализуй Спринт 2 из ROADMAP.md — GigaChat (LLM), движок задач с polling-моделью и генерацию сценариев.

Следуй архитектуре и паттернам из CLAUDE.md и AI_PROVIDERS.md. Стек не меняй. Не переписывай код Спринта 0 и 1 — авторизация и кабинет уже работают. Минимализм, без лишних абстракций.

== БЭКЕНД: ИНТЕГРАЦИЯ С GIGACHAT ==

1. server/providers/llm.js — обёртка над GigaChat API.

ВАЖНО про SSL: GigaChat использует сертификат НУЦ Минцифры, которого нет в стандартных хранилищах Linux. На Railway будет ошибка "unable to verify the first certificate". Решение:
- Скачай сертификаты https://gu-st.ru/content/Other/doc/russian_trusted_root_ca.cer и https://gu-st.ru/content/Other/doc/russian_trusted_sub_ca.cer
- Положи их в server/certs/russian_trusted_root_ca.cer и server/certs/russian_trusted_sub_ca.cer
- Создай https.Agent с этими CA + системными корнями
- Если скачать не получается в процессе разработки — временный fallback rejectUnauthorized: false с TODO-комментарием. На проде должны быть нормальные сертификаты.

Контракты функций:

export async function generateScenarios({ topic, style, duration }) {
  // → { ok, data: { scenarios: [{ title, description, scenes: [{ description, duration_sec }, ...] }, ...] }, credits_used }
  // 3 варианта сценария
}

export async function generateIdeas({ niche, count = 5 }) {
  // → { ok, data: { ideas: [...] }, credits_used }
  // На Спринт 2 НЕ реализуем, только заглушка-сигнатура. Используется в будущих спринтах.
}

export const CREDITS_COST = 1; // 1 кредит за вызов LLM

Внутренняя реализация:
- OAuth-токен: POST на https://ngw.devices.sberbank.ru:9443/api/v2/oauth с заголовком Authorization: Basic ${GIGACHAT_AUTH_KEY} и body scope=${GIGACHAT_SCOPE}. Возвращает access_token и expires_at.
- Токен кешируется в памяти модуля (let cachedToken, cachedExpiresAt). Перезапрашивается за 60 сек до истечения. НЕ пишем в БД.
- Chat completion: POST на https://gigachat.devices.sberbank.ru/api/v1/chat/completions с Authorization: Bearer <token>. Модель из process.env.GIGACHAT_MODEL (по умолчанию 'GigaChat-Lite').
- RequestId (uuid) в заголовке для трейсинга.
- Тайм-аут 60 сек на запрос.
- Обработка ошибок:
  - 401 → AUTH_ERROR (не retryable)
  - 429 → RATE_LIMIT (retryable, ждём 30 сек)
  - 5xx → PROVIDER_ERROR (retryable)
  - сетевой/SSL → PROVIDER_ERROR (retryable)
  - timeout → TIMEOUT (retryable один раз)

2. server/prompts/scenario.js — промпт для генерации 3 вариантов сценария.

Экспортируй функцию buildScenarioPrompt({ topic, style, duration }) которая возвращает массив messages для GigaChat: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }].

Системный промпт (на русском):
- Роль: "Ты — креативный сценарист коротких видео для соцсетей (Reels, TikTok, VK Клипы)."
- Задача: придумать 3 РАЗНЫХ по тональности варианта сценария для видео.
- Каждый сценарий: title (короткое броское название), description (1-2 предложения общей идеи), scenes (4-6 сцен).
- Каждая сцена: description (что показываем, что говорим за кадром, 1-2 предложения), duration_sec (целое число секунд).
- Сумма duration_sec всех сцен должна быть близка к запрошенной длительности (±2 сек).
- ОБЯЗАТЕЛЬНО вернуть строго JSON в формате { "scenarios": [...] } БЕЗ markdown-блоков, БЕЗ вступления, БЕЗ комментариев. Только JSON.
- Используй русский язык, российские реалии.
- 3 варианта должны быть разными по тону: например "уютный/тёплый", "энергичный/динамичный", "минималистичный/премиальный". НЕ повторяйся.

В user-сообщении передавай: тему, желаемый стиль (если задан), длительность.

3. server/lib/scenarioParser.js — парсер ответа LLM.

Функция parseScenariosResponse(rawText) → { ok, scenarios } или { ok: false, error }:
- Убрать ```json и ``` обёртки если есть
- Найти первый { и последний } — вытащить подстроку
- JSON.parse в try/catch
- Валидация структуры: scenarios массив из 3 элементов, каждый имеет title, description, scenes (массив 4-6 элементов), каждая сцена имеет description и duration_sec.
- При невалидной структуре или JSON-ошибке — { ok: false, error: 'PARSE_ERROR' }

== БЭКЕНД: ДВИЖОК ЗАДАЧ ==

4. server/db.js — добавь в initDB() создание таблиц projects и generation_jobs (точно по схеме из CLAUDE.md, через CREATE TABLE IF NOT EXISTS).

5. server/jobs.js — диспетчер задач.

Экспорты:
- createJob({ userId, projectId, type, input, costCredits }) → { jobId }
  Транзакция: проверка баланса кредитов → списание → INSERT в generation_jobs со status='pending'.
  Если кредитов недостаточно — throw new Error('INSUFFICIENT_CREDITS').
  После INSERT — запускает фоновое выполнение через setImmediate(() => runJob(jobId)).
- getJob(jobId, userId) → { id, type, status, progress, output, error, created_at }
  Возвращает задачу пользователя. Если задача не его — 404.
- listJobs({ userId, projectId }) → массив задач.

Функция runJob(jobId) — фоновое выполнение:
- UPDATE status='running', updated_at=NOW()
- В зависимости от типа задачи вызывает соответствующего провайдера
  - 'script' → llm.generateScenarios(input)
  - другие типы → throw 'NOT_IMPLEMENTED' (заделы под Спринт 3+)
- При успехе: UPDATE status='done', output=<результат>, progress=100
- При ошибке retryable: ждём (30 сек для RATE_LIMIT, 5 сек для остальных) и повторяем ОДИН раз
- При финальной ошибке: UPDATE status='failed', error=<message>, ВЕРНУТЬ кредиты пользователю (UPDATE users SET credits = credits + costCredits)
- Всё в try/catch — никаких unhandled rejections, иначе процесс упадёт

Watchdog (запускать раз в минуту через setInterval в server.js при старте):
- SELECT id FROM generation_jobs WHERE status='running' AND updated_at < NOW() - INTERVAL '10 minutes'
- Для каждой: UPDATE status='failed', error='TIMEOUT (watchdog)', вернуть кредиты
- Это страховка от деплоев во время задачи.

6. server.js — добавь роуты (до статики и SPA fallback, защищены requireAuth):

- POST /api/projects { title, brief } → создать проект (status='draft', result_url=null), вернуть { project }
- GET /api/projects → список проектов пользователя (последние 50, сорт по created_at DESC)
- GET /api/projects/:id → проект пользователя или 404
- PATCH /api/projects/:id { title?, brief?, status? } → обновить проект пользователя

- POST /api/jobs { projectId, type, input } → createJob с costCredits = LLM_COST (1), вернуть { jobId }
- GET /api/jobs/:id → getJob, вернуть статус и output
- GET /api/jobs?projectId=... → listJobs

Запусти watchdog при старте сервера.

== ФРОНТЕНД ==

7. src/lib/hooks.js — добавь useJobPolling(jobId).

Реализация как в CLAUDE.md, но:
- Интервал 2 секунды
- Останавливается при status === 'done' | 'failed'
- Возвращает { job, loading, error }
- Корректная очистка при размонтировании (active = false, clearTimeout)
- Если /api/jobs/:id вернул 404 — { job: null, error: 'NOT_FOUND' }

8. src/components/GenerationProgress.jsx — UI прогресса задачи.

Принимает props: { job } (результат useJobPolling).
- Если status='pending' или 'running': показывать индикатор прогресса (анимированный gradient-bar или spinner с текстом). Если progress > 0 — показывать процент.
- Если status='done': галочка + "Готово".
- Если status='failed': красная иконка + текст ошибки.
- Дизайн по theme.js, изумрудный акцент, glassmorphism.

9. src/pages/EditorPage.jsx — главный экран создания видео.

Двухшаговый сценарий:

Шаг 1: форма ввода
- Поле "О чём видео?" (textarea, 3 строки, плейсхолдер "Например: новый осенний латте в кофейне")
- Поле "Стиль" (select: "Уютный", "Энергичный", "Премиальный", "Без предпочтений" — default)
- Поле "Длительность" (select: "15 сек", "30 сек", "60 сек" — default 30)
- Кнопка "Придумать сценарии" (Btn primary). Disabled если topic пустой.
- Подпись "Стоимость: 1 кредит. У вас: N кредитов." (берём из useAuth)

При сабмите:
1. POST /api/projects { title: topic.slice(0,50), brief: { topic, style, duration } } → projectId
2. POST /api/jobs { projectId, type: 'script', input: { topic, style, duration } } → jobId
3. Переход к шагу 2 с jobId и projectId
4. Если API вернул ошибку INSUFFICIENT_CREDITS — toast "Недостаточно кредитов" и предложение пополнить (пока заглушка-ссылка на /billing).

Шаг 2: ожидание + результат
- useJobPolling(jobId)
- Пока job.status === 'pending' || 'running' → <GenerationProgress job={job} /> + текст "Думаю над сценариями... обычно занимает 10-20 секунд"
- При status='done': показать 3 карточки сценариев (job.output.scenarios). Каждая карточка:
  - Заголовок (title)
  - Описание (description)
  - Список сцен с длительностями
  - Кнопка "Выбрать этот сценарий" (Btn primary)
- При выборе: PATCH /api/projects/:projectId { brief: { ...текущий brief, selectedScenario: scenario, scenarios: job.output.scenarios } } → redirect на /project/:id
- При status='failed': показать ошибку + кнопку "Попробовать снова" (возврат на шаг 1 с сохранёнными данными)

10. src/pages/ProjectPage.jsx — просмотр проекта.

GET /api/projects/:id. Показать:
- Заголовок проекта
- Brief (тема, стиль, длительность)
- Выбранный сценарий (если есть в brief.selectedScenario): title, description, список сцен
- Кнопка "Создать видео из этого сценария" — заглушка с тостом "Будет в следующих спринтах" (это Спринт 3+)
- Кнопка "Назад в кабинет"

11. src/components/ProjectCard.jsx — карточка проекта.

Принимает project. Показывает: title, дату, краткое описание из brief.topic, статус (draft / готов).
По клику → /project/:id.
Дизайн: glassmorphism, hover-эффект.

12. src/pages/DashboardPage.jsx — обнови.

Если проектов нет → текущий empty state.
Если есть → сетка ProjectCard (responsive: 1 колонка на мобиле, 2 на планшете, 3 на десктопе). Кнопка "Создать видео" → /editor.

13. src/App.jsx — добавь маршруты /editor и /project/:id (защищённые).

== КРИТЕРИИ ГОТОВНОСТИ ==

Полный цикл от пользователя:
1. Вход → /dashboard → "Создать видео" → /editor
2. Ввод темы "новый осенний латте в кофейне", стиль "Уютный", 30 сек → "Придумать сценарии"
3. Видно прогресс 10-20 сек → появляются 3 карточки сценариев
4. Выбор сценария → редирект на /project/:id → видно выбранный сценарий
5. Возврат в /dashboard → проект виден карточкой
6. Баланс кредитов уменьшился на 1
7. Если попробовать с 0 кредитов → ошибка "Недостаточно"
8. Если симулировать ошибку GigaChat (например, неверный AUTH_KEY временно) → задача failed, кредиты вернулись

== ЧЕГО НЕ ДЕЛАЕМ В ЭТОМ СПРИНТЕ ==

- Картинки, озвучку, монтаж — Спринт 3-4
- Регенерацию отдельных сценариев
- Кэширование результатов LLM
- Редактирование сценариев пользователем
- Шеринг проектов

== ПОСЛЕ РЕАЛИЗАЦИИ ==

1. npm run build — без ошибок и warnings
2. Локальный smoke-test с моком GigaChat (если SSL-сертификаты не получилось подгрузить — поставь временно rejectUnauthorized: false с TODO)
3. Закоммить понятным сообщением, запушь
4. Дождись деплоя на Railway, проверь весь флоу на проде на ddvideoai.ru
5. Создай SPRINT_2_REPORT.md по структуре из SPRINT_1_REPORT.md

Если упрётся в SSL-проблему с GigaChat на Railway — НЕ ТРАТЬ кучу времени на сертификаты, поставь временный rejectUnauthorized: false с явным console.warn("⚠️ SSL verification disabled for GigaChat — fix before production") и опиши проблему в SPRINT_2_REPORT.md в разделе "Технический долг". Я подключусь к решению.
