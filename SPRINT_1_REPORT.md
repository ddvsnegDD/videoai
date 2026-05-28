# Sprint 1 Report — Авторизация и кабинет

## Статус
Завершён полностью — все 10 пунктов из ТЗ реализованы, протестировано на проде.

## Что сделано

### Бэкенд
- `server/db.js` — PostgreSQL pool (`pg`), `initDB()` создаёт таблицы `users` и `auth_codes` через `CREATE TABLE IF NOT EXISTS`
- `server/email.js` — отправка OTP через Brevo Transactional Email API (`POST https://api.brevo.com/v3/smtp/email`), брендированный HTML-шаблон на русском
- `server/auth.js` — генерация 6-значного кода, проверка, rate limit, JWT, middleware `requireAuth`
- `server.js` — 4 роута: `POST /api/auth/send-code`, `POST /api/auth/verify`, `GET /api/auth/me`, `POST /api/auth/logout`

### Фронтенд
- `src/lib/api.js` — fetch-обёртка с `credentials: 'include'` и обработкой ошибок
- `src/lib/auth.jsx` — `AuthProvider` (React Context) + хук `useAuth()` с методами `login`, `logout`, `refresh`
- `src/pages/LoginPage.jsx` — двухшаговая форма: email → 6 отдельных `<input>` для цифр OTP (автофокус, paste, backspace-навигация)
- `src/components/ProtectedRoute.jsx` — обёртка: spinner пока `loading`, редирект на `/login` если нет `user`
- `src/pages/DashboardPage.jsx` — карточки статистики (кредиты, проекты, тариф) + empty state с CTA «Создать видео»
- `src/components/Layout.jsx` — Header: бейдж кредитов (Sparkles), email, кнопка выхода (LogOut). Разные состояния для landing/authed/not-authed
- `src/App.jsx` — обёрнут в `<AuthProvider>`, защищённые маршруты через `<ProtectedRoute>`

### Закрыто из ROADMAP Спринта 1
Все 10 пунктов: db.js, email.js, auth.js, 4 API-роута, LoginPage, AuthProvider+useAuth, защищённые маршруты, DashboardPage с empty state, 30 кредитов при регистрации, Header с email и балансом.

## Чего НЕ сделано из запланированного
Нет. Все пункты ТЗ реализованы.

## Технические решения

- **Сессия:** JWT в httpOnly cookie (`sameSite: 'lax'`, `secure` в production, `maxAge: 30d`). Не localStorage — защита от XSS.
- **Rate limit:** проверка по `created_at` в таблице `auth_codes` — 1 код на email в 60 секунд. Без Redis, запрос в PostgreSQL.
- **OTP-генерация:** `Math.floor(100000 + Math.random() * 900000)` — не crypto.randomInt, достаточно для 6-значного кода с 10-минутным TTL.
- **Email-шаблон:** inline HTML в `server/email.js`. Не шаблонизатор — один шаблон, незачем тащить Handlebars/EJS.
- **Fallback без Brevo:** если `BREVO_API_KEY` не задан, OTP логируется в console. Позволяет тестировать локально без Brevo.
- **AuthProvider:** `GET /api/auth/me` вызывается при маунте приложения. Пока ответ не пришёл — `loading: true`, UI показывает spinner.
- **Code input:** 6 отдельных `<input maxLength=1 inputMode="numeric">` вместо одного поля. Поддержка paste всего кода, backspace-навигация между ячейками, автоматический submit при вводе 6-й цифры.

## Отклонения от CLAUDE.md

- **React 19 + Vite 8 + React Router 7** вместо указанных в CLAUDE.md "React 18 + Vite 5 + React Router 6". Фактически в `package.json` стоят `react@^19.2.6`, `vite@^8.0.12`, `react-router-dom@^7.6.2` — установлены в Спринте 0, не менялось.
- **`cookie-parser`** добавлен как зависимость — не указан в CLAUDE.md, но необходим для чтения JWT из cookie.

## Технический долг

- **OTP brute-force:** нет ограничения на количество попыток ввода неверного кода. Можно перебирать коды для одного email. Решение: добавить счётчик попыток (max 5), блокировка на 15 мин.
- **Старые auth_codes не чистятся.** Таблица будет расти. Решение: cron-задача `DELETE FROM auth_codes WHERE expires_at < NOW() - INTERVAL '1 day'`.
- **`JWT_SECRET` fallback:** если переменная не задана, используется `'dev-secret-change-me'`. На проде переменная есть, но fallback небезопасен — лучше бросать ошибку при старте.
- **Email-валидация:** проверка только на наличие `@`. Нет проверки формата, MX-записей, disposable email.
- **Нет CSRF-защиты.** `sameSite: 'lax'` смягчает, но не закрывает все векторы.

## Известные баги
Не обнаружено. Полный флоу протестирован на проде: отправка кода → ввод → редирект в кабинет → отображение 30 кредитов.

## Изменения в схеме БД

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user',
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Изменения в переменных окружения

| Переменная | Назначение | Есть в Railway |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Да (авто) |
| `JWT_SECRET` | Подпись JWT-токенов | Да |
| `BREVO_API_KEY` | API-ключ Brevo для отправки email | Да |
| `EMAIL_FROM` | Адрес отправителя OTP-писем | Да |
| `EMAIL_FROM_NAME` | Имя отправителя | Да |

Новых переменных, отсутствующих в Railway, нет.

## Новые зависимости

- `jsonwebtoken` — генерация и верификация JWT-токенов
- `cookie-parser` — парсинг cookies из HTTP-запросов (добавлен в Спринте 0, но впервые используется здесь)
- `pg` — PostgreSQL-клиент (добавлен в Спринте 0, впервые используется здесь)

## Как проверить (чек-лист для ручного теста)

1. Открыть `https://videoai-production-ba24.up.railway.app/api/health` — ответ `{"status":"ok","db":true,...}`
2. Открыть `https://videoai-production-ba24.up.railway.app/login`
3. Ввести email, нажать «Получить код»
4. Проверить почту — должно прийти письмо от VideoAI с 6-значным кодом
5. Ввести код в 6 ячеек (или вставить из буфера) — автоматический submit после 6-й цифры
6. Редирект на `/dashboard` — видно email, 30 кредитов, тариф «Бесплатный», пустое состояние проектов
7. Нажать кнопку выхода (LogOut) в хедере — редирект на главную
8. Попробовать открыть `/dashboard` напрямую — редирект на `/login`
9. Повторно войти с тем же email — кредиты по-прежнему 30 (не начисляются повторно)
10. На странице `/login` нажать «Получить код» дважды подряд — второй раз ошибка «Подождите 60 сек»

## Вопросы / на что обратить внимание

1. **Brevo-домен:** письма уходят с `noreply@ddvideoai.ru`. Убедись, что домен верифицирован в Brevo — иначе письма будут в спаме.
2. **Перед Спринтом 2:** нужен аккаунт Сбер AI Studio с `GIGACHAT_CLIENT_ID` и `GIGACHAT_CLIENT_SECRET`.
