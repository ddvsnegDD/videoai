# Sprint C Deploy Report — Деплой нового лендинга + SEO/OG

## Спринт C Deploy: выкатка на прод
**Дата:** 04.06.2026
**Статус:** завершён — прод ddvideoai.ru обновлён, новый лендинг live
**Коммит:** `99938af` — `Sprint C: новый лендинг + SEO/OG`
**Одной строкой:** обновлён корневой `index.html` с полным набором SEO/OG-тегов, создана OG-обложка, проверена сборка и preview, закоммичено и запушено в `main`, Railway автодеплой прошёл успешно.

## Что сделано

### 1. index.html — SEO/OG-теги (17 → 42 строки)

Старая версия:
- Только `<title>VideoAI — AI-генерация видео для соцсетей</title>`.
- Без мета-описания, без OG, без Twitter Card, без canonical.

Новая версия:
- **Title:** `VideoAI — фото товара в рекламный клип за 1 минуту | ddvideoai.ru` — отражает B2B-пивот.
- **meta description:** B2B-платформа для селлеров Wildberries и Ozon... (149 символов, оптимально для SERP).
- **meta keywords:** видео для маркетплейсов, AI видео, видеокреатив, Wildberries видео и др.
- **canonical:** `https://ddvideoai.ru/`.
- **Open Graph** (7 тегов): og:type, og:url, og:title, og:description, og:image (1200×630), og:locale, og:site_name.
- **Twitter Card** (4 тега): summary_large_image, title, description, image.
- Шрифты: `<link rel="preconnect">` сохранены, веса Inter и Manrope без изменений (уже расширены в Sprint C).

### 2. og-cover.jpg — OG-обложка (НОВЫЙ файл, 115 KB)

- Размер: 1200×630 px (стандарт Open Graph).
- Дизайн: тёмный фон (`#0D2B1E` → `#0A1F16`), градиентные акценты `#10B981`.
- Контент: логотип VideoAI, заголовок «Фото товара → рекламный клип за 1 минуту», бейджи Wildberries / OZON / Я Маркет, URL ddvideoai.ru.
- Генерация: SVG → JPG через macOS qlmanage + sips (без внешних зависимостей).
- Путь: `public/og-cover.jpg` → при билде копируется в `dist/og-cover.jpg`.

### 3. .gitignore — добавлена папка Референсы/

- Причина: папка содержит справочные файлы (WAN-видео, скриншоты дизайна, CSV-логи) — ~33 MB бинарников, не относящихся к коду.
- Файлы были unstage'ены из коммита через `git reset HEAD`.

### 4. Полный коммит Sprint C (38 файлов)

В один коммит вошли все накопленные изменения Sprint C, которые ранее были только локально:

**Фронтенд (заменено):**
- `src/App.jsx` — AdminRoute, ProtectedRoute inline, убраны lazy/Suspense
- `src/components/Layout.jsx` — минималистичная шапка кабинета, пункт «Админ»
- `src/pages/HomePage.jsx` — полностью новый B2B-лендинг (7 секций, 429 строк)
- `src/pages/DashboardPage.jsx` — мок-проекты с видео-превью
- `src/pages/EditorPage.jsx` — 3-шаговый демо-редактор
- `src/pages/BillingPage.jsx` — обновлённые тарифы

**Фронтенд (новое):**
- `src/lib/adminConfig.js` — ADMIN_EMAILS + isAdmin()
- `public/og-cover.jpg` — OG-обложка
- `public/demo/clip1.mp4`, `clip2.mp4`, `clip3.mp4` — демо-ролики

**Удалено из импортов:**
- `src/components/GenerationProgress.jsx` — удалён
- `src/components/ProjectCard.jsx` — удалён
- `src/components/ProtectedRoute.jsx` — удалён (логика перенесена в App.jsx)

**Документация (новая):**
- `SPRINT_2_PROMPT.md`, `SPRINT_6_REPORT.md`, `SPRINT_A_REPORT.md`
- `SPRINT_B_REPORT.md`, `SPRINT_B2_REPORT.md`
- `SPRINT_C_REPORT.md`, `SPRINT_C_MERGE_REPORT.md`
- `VIDEOAI_PIVOT_STRATEGY.md`, `VIDEOAI_STRATEGY_V2.md`

**Справочные файлы (react-handoff/):**
- `react-handoff/App.jsx`, `README.md`, `components/Layout.jsx`, `lib/adminConfig.js`
- `react-handoff/pages/HomePage.jsx`, `DashboardPage.jsx`, `EditorPage.jsx`, `BillingPage.jsx`

**Итого:** 38 файлов, +4 359 / −2 757 строк.

## Тесты

### Проверено (реально запускалось)

| Тест | Что проверяли | Как наблюдали | Результат |
|---|---|---|---|
| `npm run build` | Сборка Vite без ошибок | 1638 модулей, 329ms, 0 ошибок | PASS |
| Размер бандла | JS + CSS в пределах нормы | 328.37 KB JS (98.58 KB gzip), 5.98 KB CSS | PASS |
| `npm run preview` | HTML отдаётся корректно | curl localhost:4173 — все OG-теги на месте | PASS |
| Новый лендинг в бандле | Ключевые фразы B2B-лендинга присутствуют | grep: «фото товара» (2), «рекламный клип» (2), «селлеров WB и Ozon» (1), «Kling vs Veo» (1) | PASS |
| Старый лендинг в бандле | Старые фразы отсутствуют | grep: «Идея → AI-видео → публикация» — 0 совпадений | PASS |
| og-cover.jpg в dist/ | Картинка копируется при билде | `ls dist/og-cover.jpg` — 114 963 байт | PASS |
| OG-теги в dist/index.html | Мета-теги вставлены корректно | grep: og:title, og:image, og:description — всё на месте | PASS |
| git push | Пуш в origin/main | `5070f41..99938af main -> main` — без ошибок | PASS |
| Прод ddvideoai.ru | Новый title и OG-теги на проде | curl: `<title>VideoAI — фото товара в рекламный клип за 1 минуту \| ddvideoai.ru</title>` | PASS |
| Railway автодеплой | Новый билд запустился автоматически после push | Прод обновился в течение нескольких минут | PASS |

### НЕ проверено (и почему)

- **Визуальная проверка в браузере** — Chrome extension (Claude in Chrome) была отключена; проверка только через curl + grep по бандлу.
- **OG-превью в соцсетях** — Telegram/VK/Facebook парсеры не тестировались. Рекомендация: вставить ссылку ddvideoai.ru в Telegram — должна показаться карточка с обложкой.
- **Мобильная версия** — media-queries есть в HomePage, но не проверялись визуально.
- **Демо-ролики на проде** — clip1-3.mp4 закоммичены, но не проверялось воспроизведение в слайдере До→После.

## Деплой

| Параметр | Значение |
|---|---|
| Платформа | Railway (Nixpacks, автодеплой с GitHub) |
| Ветка деплоя | `main` |
| Коммит | `99938af` |
| Билд-команда | `npm run build` (Nixpacks определяет автоматически) |
| Старт-команда | `npm start` → `node server.js` |
| Сервер | Express, раздаёт `dist/` как static + SPA fallback |
| URL | https://ddvideoai.ru |

## Расход fal за спринт

- Потрачено: **$0** (только фронтенд + деплой, без генераций)

## Остаётся (хвосты из Sprint C)

1. **OG-обложка** — сейчас сгенерирована программно (SVG→JPG). Рекомендуется заменить на дизайнерскую с реальным скриншотом/рендером продукта.
2. **Мерж бизнес-логики EditorPage** — UI красивый, но демо. Нужно вернуть: upload фото, `POST /api/jobs`, polling статуса, учёт кредитов/пробников.
3. **Мерж бизнес-логики DashboardPage** — вернуть `GET /api/projects`, реальные статусы, удаление проектов.
4. **Проверка OG-превью** — протестировать карточку при шеринге в Telegram, VK, Facebook.
5. **Визуальный QA в браузере** — пройти все страницы (лендинг, логин, дашборд, редактор, биллинг, админка).
6. **Адаптив кабинета** — Layout, Dashboard, Editor, Billing — без мобильной адаптации.
