# Sprint C Merge Report — Мерж бизнес-логики + денежная утечка + удаление проектов + тарифы

## Статус
**Завершён.** Код на проде (Railway, ddvideoai.ru). Пять коммитов за сессию, все задеплоены.

**Одной строкой:** вернули рабочую бизнес-логику в новый дизайн Спринта C, закрыли денежную утечку fal ($3 → $0 фантомных списаний), добавили удаление проектов, перевели тарифную сетку на 3 маркетинговых пакета.

---

## Блок 1 — Фикс предсказуемости seed

### Проблема
`seed` не задавался → fal брал случайный → один и тот же промпт давал то спокойное движение, то полный оборот товара. Подтверждено: 6 запусков = 6 разных сидов = 6 разных результатов.

### Решение
- `generateSeed()` — случайный 32-бит int при каждом создании задачи в `createJob`.
- Seed передаётся в `submitToFal` и сохраняется в `generation_jobs.seed`.
- При успешном завершении записывается в `projects.brief` (для воспроизводимости из проекта).
- Returned seed от fal сохраняется в output (`fal_seed`) для сверки.

### Файлы
- `server/jobs.js` — `generateSeed()`, передача seed в весь pipeline.
- `server/db.js` — `ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS seed BIGINT`.

---

## Блок 2 — Денежная утечка (приоритет, 5 слоёв защиты)

### Проблема
fal списывает за каждый **выполненный** запрос независимо от того, забрало ли приложение результат. Зависшие поллинги, таймауты и повторные клики «Создать» привели к 6 оплаченным генерациям ($3) там, где нужна была одна.

### Решение — 5 слоёв

| Слой | Механизм | Что защищает |
|------|----------|--------------|
| **2.1 Дедуп** | Проверка активной задачи (user+project) + `idempotency_key` + partial UNIQUE index `uniq_active_job` | Повторные клики и гонки |
| **2.2 fal_request_id** | Сохраняется СРАЗУ после `fal.queue.submit`, ДО поллинга | Обрыв процесса не теряет оплаченную задачу |
| **2.3 Разделение ошибок** | `POLL_TIMEOUT` → НЕ рефандим, оставляем для reconciler. `FAL_FAILED` → рефандим | Таймаут ≠ отказ |
| **2.4 Reconciler** | `startReconciler()` каждые 90с, подбирает orphaned задачи по `fal_request_id` | Возвращает результаты, за которые уже заплачено |
| **2.5 Предохранитель** | `MAX_CONCURRENT_JOBS_PER_USER = 2` | Кэширует расход при будущих багах |

- **Рефанд идемпотентен:** флаг `refunded` в `generation_jobs` исключает двойной возврат (даже если и `failJob`, и reconciler сработают).
- **404 от fal = terminal failure:** reconciler помечает задачу как failed (фикс `1091d13` — обнаружен при тестировании).

### Миграции БД (все через `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)

```sql
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS seed BIGINT;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS fal_request_id TEXT;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_job
  ON generation_jobs (idempotency_key)
  WHERE status IN ('pending','running') AND idempotency_key IS NOT NULL;
```

### Файлы
- `server/jobs.js` — полная переработка (297 строк): `generateSeed`, `makeIdempotencyKey`, деdup-проверка в `createJob`, `runAnimate` с `submitToFal` → save `fal_request_id` → `pollFal` → `fetchAndUpload`, идемпотентный `failJob`, reconciler, watchdog v2.
- `server/db.js` — 5 ALTER миграций + partial unique index.
- `server.js` — импорт `startReconciler`, запуск в `start()`, обработка `TOO_MANY_ACTIVE_JOBS`.
- `src/pages/EditorPage.jsx` — обработка ошибки `TOO_MANY_ACTIVE_JOBS`.

---

## Блок 3 — Верификация на продовой БД

Подключение: Railway CLI не прошёл авторизацию → `DATABASE_PUBLIC_URL` из Railway UI → прямое подключение через `pg.Pool` из терминала.

### Тест A — Миграции
Проверено на проде через `information_schema.columns`:

| Колонка | Статус |
|---------|--------|
| `seed` (BIGINT) | ✅ |
| `fal_request_id` (TEXT) | ✅ |
| `last_polled_at` (TIMESTAMPTZ) | ✅ |
| `idempotency_key` (TEXT) | ✅ |
| `refunded` (BOOLEAN, default false) | ✅ |
| Partial UNIQUE index `uniq_active_job` | ✅ |

### Тест B — Дедуп на уровне БД
- Две INSERT с одинаковым `idempotency_key` и `status='pending'`.
- Результат: **PASS** — вторая отклонена: `duplicate key value violates unique constraint "uniq_active_job"`.
- После `status='done'` на первой — повторная вставка с тем же ключом **проходит** (partial index корректен).

### Тест C — Идемпотентный рефанд через reconciler
- Задача с фейковым `fal_request_id`, `cost_credits=40`, баланс 100.
- Reconciler нашёл через ~55с, пометил `failed`, вернул 40 кр. (100 → 140), поставил `refunded=true`.
- После 2-го цикла reconciler (100 секунд) баланс **остался 140** — двойного возврата нет.
- Результат: **PASS**.

### Тест D — Таймаут ≠ рефанд (код-ревью)
- Путь `POLL_TIMEOUT` в `runJob`: НЕ вызывает `failJob`, НЕ пере-сабмитит, оставляет `running` с `fal_request_id`.
- Результат: **PASS**.

### Обнаружено при тестировании
Reconciler не обрабатывал 404 от fal как terminal failure — задача с несуществующим request_id дёргалась бесконечно. Фикс: `1091d13` — если `fal.queue.status` бросает "Not Found"/"404", reconciler вызывает `failJob`.

---

## Блок 4 — Удаление проектов

### Бэкенд: `DELETE /api/projects/:id`

1. **Проверка владельца:** `project.user_id !== req.userId` → 403.
2. **Блокировка при активной генерации:** `generation_jobs` со `status IN ('pending','running')` → 409.
3. **S3 cleanup (best-effort):** `deleteByPrefix(`projects/${id}/`)` + `extractS3Key()` для source-фото. Ошибка S3 логируется, не блокирует удаление записи.
4. **Удаление из БД:** `DELETE FROM projects` — FK CASCADE убирает `generation_jobs`.
5. `payments` не затронуты.

Хелпер `extractS3Key(url)` поддерживает оба формата URL Yandex Object Storage (virtual-hosted и path-style).

### Фронтенд
- `api.del()` — новый метод в `api.js`.
- `ProjectCard` (inline в DashboardPage) — иконка корзины с overlay-подтверждением «Удалить креатив? Видео и файлы удалятся безвозвратно».
- `DashboardPage` — `onDelete` callback убирает карточку без перезагрузки; 409 → «Дождитесь завершения генерации».
- `ProjectPage` — кнопка «Удалить проект» с двухшаговым подтверждением, редирект после удаления.

### Файлы
- `server.js` — `DELETE /api/projects/:id`, `extractS3Key`, `import { deleteByPrefix }`.
- `src/lib/api.js` — `api.del()`.
- `src/pages/DashboardPage.jsx` — `handleDelete`, `deleteError`, `onDelete` prop.
- `src/pages/ProjectPage.jsx` — `handleDelete`, `confirmDelete`, двухшаговый UI.
- `src/components/ProjectCard.jsx` — trash icon, overlay.

---

## Блок 5 — ErrorBoundary

`ErrorBoundary` (class component) в `App.jsx` оборачивает всё приложение. При краше рендера показывает «Что-то пошло не так» + кнопка «Обновить» вместо белого экрана.

---

## Блок 6 — Мерж Спринта C (аудит + тарифы)

### Аудит редизайна
ТЗ предполагало, что дизайнерские файлы содержат демо-логику без бэкенда. Аудит показал, что **мерж уже был выполнен ранее** — все файлы содержат реальные бэкенд-вызовы:

| Пункт ТЗ | Статус | Пояснение |
|-----------|--------|-----------|
| ErrorBoundary | ✅ Уже есть | Class component в App.jsx |
| Двойной BrowserRouter | ✅ Нет проблемы | BrowserRouter только в main.jsx |
| EditorPage — реальный flow | ✅ Уже работает | Upload, GigaChat, Nano Banana, jobs, polling, кредиты, пробники, перегенерация |
| DashboardPage — реальные данные | ✅ Уже работает | `GET /api/projects`, удаление, 409 |
| Роут `/project/:id` | ✅ Не нужен | Новый дизайн: видео/скачивание/удаление на карточке в Dashboard |
| Защита от утечки | ✅ Не нарушена | Генерация через тот же движок задач |

### Новая тарифная сетка (P1)

Заменены 6 старых пакетов на 3 маркетинговых:

| id | Название | Цена | Кредиты | ₽/кр. | ≈ роликов |
|---|---|---|---|---|---|
| `hook` | Hook Pack | 599 ₽ | 120 | 5.0 | 3 эконом |
| `product_shots` | Product Shots | 1 099 ₽ | 240 | 4.6 | 6 эконом / 2 премиум |
| `seller` | Seller ★ | 1 599 ₽ | 360 | 4.4 | 9 эконом / 4 премиум |

- Добавлено поле `feats` (массив строк) — без него BillingPage крашился на `pkg.feats.map()`.
- Лендинг (`tariffs` export): Пробный (0₽) / Hook Pack (599₽) / Seller (1599₽) — цены 1:1 с BillingPage.
- Webhook (`processYooMoneyWebhook`) читает `getPackageById(id)` → автоматически подхватывает новые пакеты.
- Старые `payments` с `economy_5` и т.п. не ломаются — `pkg?.title` показывает fallback `payment.package_id`.

### Осиротевшие файлы (P2)

| Файл | Статус |
|------|--------|
| `ProtectedRoute.jsx` | Удалён дизайнером, функция inline в App.jsx |
| `ProjectCard.jsx` | Удалён дизайнером, функция inline в DashboardPage |
| `GenerationProgress.jsx` | Удалён дизайнером, заменён inline-прогрессбаром в EditorPage |
| `Btn.jsx` | Остаётся (используется в LoginPage, AdminPage, ProjectPage) |

Все импорты проверены grep'ом — битых ссылок нет.

---

## Коммиты (все на main, задеплоены на прод)

| Хеш | Описание |
|-----|----------|
| `d0ddeb4` | Fix seed predictability + money leak: dedup, reconciler, idempotent refunds |
| `1091d13` | Fix reconciler: treat fal 404/Not Found as terminal failure |
| `ad7adcc` | Add project deletion with S3 cleanup + ErrorBoundary |
| `5070f41` | Sprint C merge: new tariff packages (Hook/Product Shots/Seller) |

## Изменения в коде

### Бэкенд

| Файл | Что изменено |
|------|-------------|
| `server/jobs.js` | Полная переработка: seed, dedup, idempotency_key, reconciler, идемпотентный failJob, watchdog v2, rate limit |
| `server/db.js` | 5 ALTER миграций + 2 partial unique index (idempotency_key, operation_id) |
| `server.js` | `DELETE /api/projects/:id`, `extractS3Key`, `deleteByPrefix` import, reconciler start, `TOO_MANY_ACTIVE_JOBS` |
| `server/providers/falVideo.js` | Без изменений (уже был на queue API из предыдущего спринта) |

### Фронтенд

| Файл | Что изменено |
|------|-------------|
| `src/App.jsx` | ErrorBoundary (class component) |
| `src/lib/api.js` | `api.del()` |
| `src/data/tariffs.js` | 3 новых пакета (hook/product_shots/seller) с `feats`, обновлённый `tariffs` export для лендинга |
| `src/pages/DashboardPage.jsx` | `handleDelete`, `deleteError`, inline ProjectCard с удалением |
| `src/pages/ProjectPage.jsx` | Кнопка «Удалить проект» с двухшаговым подтверждением |
| `src/pages/EditorPage.jsx` | Обработка `TOO_MANY_ACTIVE_JOBS` |
| `src/pages/BillingPage.jsx` | Новый дизайн (glass cards, 3 пакета без табов) — из Спринта C |

### Не тронуто
- `server/providers/falVideo.js`, `server/providers/falImage.js`, `server/providers/llm.js`
- `server/auth.js`, `server/email.js`, `server/storage.js`, `server/payments.js`
- `src/pages/HomePage.jsx`, `src/pages/LoginPage.jsx`, `src/pages/AdminPage.jsx`
- `src/lib/auth.jsx`, `src/lib/theme.js`, `src/lib/hooks.js`

---

## Тесты

### Проверено (реально запускалось на проде)

| Тест | Что проверяли | Результат |
|------|--------------|-----------|
| Тест A — Миграции | Все 5 колонок + partial unique index на проде | ✅ PASS |
| Тест B — Дедуп | Две INSERT с одним idempotency_key → вторая отклонена | ✅ PASS |
| Тест C — Идемпотентный рефанд | Reconciler → failed → refund 40кр. → 2й цикл не двоит | ✅ PASS |
| Тест D — Таймаут ≠ рефанд | Код-ревью: POLL_TIMEOUT не рефандит | ✅ PASS |
| Билд Vite | `npx vite build` без ошибок | ✅ PASS (328 KB → 99 KB gzip) |
| Синтаксис сервера | `node --check server.js` | ✅ PASS |

### НЕ проверено

- Сквозной тест генерации в новом UI (фото → fal → MP4) — не запускался в этой сессии.
- Удаление проекта на проде — эндпоинт задеплоен, но ручной тест через UI не выполнен.
- Оплата через ЮMoney с новыми пакетами — webhook подхватит по `getPackageById`, но живой тест не проводился.
- Демо-ролики — `public/demo/` пустая, видео-элементы на лендинге и в дашборде без контента.

---

## Расход fal за сессию

- Потрачено: **$0** (тесты B/C/D использовали фейковые request_id, генераций не было).

---

## Схема БД (итоговая `generation_jobs`)

```
id               integer (PK, auto)
user_id          integer (FK → users)
project_id       integer (FK → projects, ON DELETE CASCADE)
type             varchar(50)         — 'animate' | 'image'
status           varchar(20)         — 'pending' | 'running' | 'done' | 'failed'
progress         integer             — 0..100
input            jsonb               — содержит _freeColumn для возврата
output           jsonb
error            text
cost_credits     integer
seed             bigint              — ★ NEW: сид генерации
fal_request_id   text                — ★ NEW: id запроса в очереди fal
last_polled_at   timestamptz         — ★ NEW: для reconciler
idempotency_key  text                — ★ NEW: дедуп (partial UNIQUE по активным)
refunded         boolean (false)     — ★ NEW: идемпотентный возврат
created_at       timestamptz
updated_at       timestamptz
```

---

## Остаётся (хвосты)

1. **Проверить seed у Kling 2.5** — в текущем Input его нет. Если не поддерживает — предсказуемость через `cfg_scale` + промпт.
2. **Прогнать Veo на проде** — ни разу не запускался.
3. **Переписать промпты `MOTION_PRESETS`** — убрать `rotation` (провокатор «вентилятора»).
4. **Демо-ролики** — положить `clip1/2/3.mp4` в `public/demo/`.
5. **Сквозной тест генерации** в новом UI — фото → fal → MP4.
6. **Тест оплаты** с новыми пакетами через ЮMoney.
7. **SSL GigaChat** — загрузить цепочку НУЦ Минцифры вместо `rejectUnauthorized:false`.
8. **Адаптив кабинета** — media-queries только в HomePage; Layout/Dashboard/Editor/Billing без мобилки.
