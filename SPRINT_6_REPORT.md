# Sprint 6 Report — Биллинг через ЮMoney (кошелёк)

## Спринт 6: биллинг ЮMoney
**Дата:** 02.06.2026
**Статус:** ✅ завершён
**Одной строкой:** реализован и подтверждён деньгами полный цикл платежей через ЮMoney-кошелёк — пакет economy_1 (199 ₽) оплачен, кошелёк получил 193.03 ₽ (комиссия ~3%), кредиты начислены; по ходу устранены два постдеплойных бага (пустая страница и неверная ссылка кнопки), добавлен таб-переключатель Эконом/Премиум.

## Что сделано

- **`src/data/tariffs.js`** — полностью переписан: массив `PACKAGES` с 6 пакетами (economy_1/5/15/30, premium_1/5), функция `getPackageById(id)`. Источник истины по цене и кредитам — только бэкенд читает из этого файла, не доверяет запросу фронта. Отдельный массив `tariffs` для лендинга сохранён с маркетинговой структурой (name, features, limits, popular, kind).
- **`server/payments.js`** — новый модуль:
  - `verifyYooMoneySign(params, secret)` — HMAC-SHA256 по RFC 3986, timing-safe сравнение. **Не `sha1_hash`** — он отключился у ЮMoney с 18.05.2026.
  - `buildQuickpayUrl(...)` — формирует ссылку `https://yoomoney.ru/quickpay/confirm`.
  - `createPendingPayment(...)` — сохраняет `pending` запись в `payments`.
  - `processYooMoneyWebhook(...)` — проверка подписи → guard тестового уведомления → идемпотентность по `operation_id` → парсинг метки → сверка суммы (допуск 10%) → атомарный INSERT + UPDATE кредитов (`ON CONFLICT DO NOTHING`).
- **`server/db.js`** — `CREATE TABLE IF NOT EXISTS payments` + `ALTER ... ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX uniq_operation_id`.
- **`server.js`** — 4 роута: `POST /api/payments/create`, `GET /api/payments/history`, `POST /api/payments/yoomoney-webhook`, `GET /api/admin/payments`.
- **`src/pages/BillingPage.jsx`** — таб-переключатель Эконом (Kling) / Премиум (Veo) с фильтрацией пакетов; активный таб управляется через `?kind=` query param; кнопка «Купить» → Quickpay → редирект; баннер `?paid=1`; история платежей.

### Постдеплойные исправления
- **Пустая страница** — `tariffs = PACKAGES` сломало `HomePage.jsx`, который ожидал поля `features`/`limits`/`popular`. Восстановлен отдельный `tariffs` с правильной структурой.
- **«Выбрать тариф» вёл на `/login`** — авторизованные пользователи не могли попасть на `/billing`. Исправлено: платные тарифы → `/billing?kind=economy` / `/billing?kind=premium`.

## Что удалено / заменено

- Старый `tariffs` (Бесплатный/Старт/Pro, ценообразование старого пайплайна) заменён на `PACKAGES` (пакеты роликов) + отдельный `tariffs` для лендинга.

Остаточный legacy: —

## Изменения в коде

**Бэкенд:**
- `server/payments.js` — **новый файл** (~190 строк).
- `server/db.js` — `CREATE TABLE payments` + UNIQUE индекс.
- `server.js` — 4 роута платежей.

**Фронтенд:**
- `src/data/tariffs.js` — PACKAGES, getPackageById, tariffs (лендинг).
- `src/pages/BillingPage.jsx` — таб-переключатель, `?kind=` deep-link.
- `src/pages/HomePage.jsx` — «Выбрать тариф» → `/billing?kind=economy|premium`.

**Новые зависимости:** — (только встроенный `crypto`)

## Интеграция с fal (если затронута)

— (не затронута)

## Схема БД (если менялась)

Новая таблица `payments`:
```sql
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  package_id TEXT,
  label TEXT,
  expected_amount NUMERIC,
  paid_amount NUMERIC,
  operation_id TEXT,
  credits_granted INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_operation_id ON payments (operation_id)
  WHERE operation_id IS NOT NULL;
```
Миграция применяется автоматически при старте, проверена на проде.

## Переменные окружения (если менялись)

| Переменная | Назначение | В Railway |
|---|---|---|
| `YOOMONEY_WALLET` | Номер кошелька-получателя | ✅ |
| `YOOMONEY_NOTIFICATION_SECRET` | Секрет HTTP-уведомлений ЮMoney | ✅ |
| `APP_URL` | Базовый URL для `successURL` (дефолт `https://ddvideoai.ru`) | — опционально |

## Кредиты / экономика (если затронуто)

- **Механика:** покупка пакета → Quickpay ссылка → пользователь платит → ЮMoney шлёт webhook → начисление.
- **Идемпотентность:** `ON CONFLICT (operation_id) DO NOTHING` — ЮMoney шлёт до 3 уведомлений, начислится ровно один раз.
- **Сверка суммы:** `paidAmount >= pkg.price * 0.90` — допуск 10%. Реальная комиссия ЮMoney ~3% (199 ₽ → 193.03 ₽) — укладывается с запасом.
- **Атомарность:** `BEGIN → INSERT payments → UPDATE users SET credits → COMMIT`.
- **Пакеты и кредиты:**

| Пакет | Цена | Кредиты | Роликов Kling | Роликов Veo |
|---|---|---|---|---|
| economy_1 | 199 ₽ | 40 | 1 | — |
| economy_5 | 890 ₽ | 200 | 5 | — |
| economy_15 | 2 390 ₽ | 600 | 15 | — |
| economy_30 | 3 990 ₽ | 1 200 | 30 | — |
| premium_1 | 590 ₽ | 90 | — | 1 |
| premium_5 | 2 490 ₽ | 450 | — | 5 |

## Тесты

### Проверено (реально запускалось)

| Тест | Что проверяли | Как наблюдали | Результат |
|---|---|---|---|
| Билд фронтенда | `npm run build` без ошибок | Vite: 0 ошибок | PASS |
| Алгоритм `sign` — верная подпись | HMAC-SHA256 c RFC 3986 | `verifyYooMoneySign` → `true` | PASS |
| Алгоритм `sign` — неверная подпись | Timing-safe compare | `verifyYooMoneySign` → `false` | PASS |
| Кнопка «Протестировать» ЮMoney | Реальный webhook с подписью | Railway logs: `Test notification received and verified` | **PASS** ✓ |
| Guard тестового уведомления | Кредиты не начисляются при test | Баланс не изменился | **PASS** ✓ |
| **Реальный платёж economy_1 (199 ₽)** | Полный цикл: Quickpay → webhook → кредиты | ЮMoney: `+193.03 ₽` (комиссия ~3%); кредиты начислены | **PASS** ✓ |
| **Комиссия ЮMoney** | Поле `amount` = что получил кошелёк | 199 ₽ → 193.03 ₽ (~3%); допуск 10% сработал корректно | **Подтверждено** ✓ |

### НЕ проверено

- **Идемпотентность с дублями** — сценарий двойного уведомления с одним `operation_id` живьём не гонялся (логика верна по коду, UNIQUE индекс защищает).
- **`?paid=1` баннер** — пользователь возвращается по successURL; не проверялось, успевают ли кредиты появиться до рефреша.
- **Пакеты дороже 199 ₽** — реальный тест только на economy_1; остальные не проверены, но механика идентична.

## Расход fal за спринт

— ($0, платёжный спринт без AI-вызовов)

## Ключевые факты из живого теста

> - **Поле суммы в webhook = `amount`** (не `withdraw_amount`). Это то, что получил кошелёк ПОСЛЕ комиссии ЮMoney.
> - **Комиссия ЮMoney ≈ 3%**: 199 ₽ → 193.03 ₽ (δ = 5.97 ₽).
> - Допуск 10% в `processYooMoneyWebhook` корректен — перекрывает реальную комиссию с запасом.
> - При желании можно ужесточить до 5% (или 95% от price).

## Остаётся (хвосты)

1. **Email-уведомление** об успешной оплате — низкий приоритет для MVP.
2. **Polling баланса** при `?paid=1` — если webhook опаздывает, пользователь видит «обновите страницу». Опционально: polling `/api/auth/me` пока баланс не вырос.
3. **DashboardPage** — «Тариф: Бесплатный» захардкожено; можно добавить ссылку «Купить кредиты» при нулевом балансе.
4. **Все предыдущие хвосты** (Veo на проде, сквозной тест картинка→видео, лендинг-редизайн) — без изменений.

## Технический долг

1. `paymentType` всегда `AC` (карта) — выбор кошелёк/карта в UI отсутствует.
2. Нет `<ErrorBoundary>` в `App.jsx` — любой рендер-краш обнуляет весь UI. Стоит добавить.

## Что обновить в документах

- **CLAUDE.md** — `server/payments.js` в структуру; `YOOMONEY_WALLET`, `YOOMONEY_NOTIFICATION_SECRET` в env; комиссия ЮMoney ~3%.
- **ROADMAP.md** — Спринт 6: завершён, реальный платёж подтверждён.
- **PROJECT.md** — биллинг реализован и протестирован.
