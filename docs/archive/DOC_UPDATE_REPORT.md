# DOC_UPDATE_REPORT — синхронизация документации 05.06.2026

## Что изменено

### `CLAUDE.md`
- **Шапка:** дата обновлена на 05.06.2026, отражён Sprint C и миграция.
- **PROJECT_CONFIG:** `hosting` → `reg.cloud VPS (РФ)`, `db` → `PostgreSQL 18 (локальный)`, `payment_provider` уточнён.
- **Статус спринтов:** добавлены Sprint C (задеплоен), миграция на VPS (завершена), Sprint 7 разбит на Блок 1 + Блок 2. Тарифы Sprint 6 обновлены на 3 пакета (599/1099/1599).
- **Раздел «Деплой на Railway»** → полностью заменён на **«Инфраструктура — reg.cloud VPS (РФ)»**: VPS, Ubuntu 26.04, Node 22, PostgreSQL 18 локально, Nginx+certbot, PM2 (ecosystem.config.cjs, --env-file), пользователь deploy, IP 194.226.20.185, Cloudflare A DNS only, .env на сервере. Env-переменные актуализированы (перевыпущенные ключи, убраны легаси-комментарии).
- **Новый раздел «Юридический статус / 152-ФЗ»:** самозанятый НПД, оферта/политика готовятся, локализация закрыта, уведомление в РКН в плане, запрет ПДн на fal.ai.
- **Структура проекта:** добавлены `ecosystem.config.cjs`, `DEPLOY.md`, `.env.example`, `nginx/videoai.conf`, `adminConfig.js`. Удалены `ProjectCard.jsx`, `GenerationProgress.jsx`. Описания страниц обновлены под Sprint C.
- **Кредитная модель:** тарифы заменены на 3 пакета (hook/product_shots/seller), указан `tariffs.js` как источник.
- **Схема БД:** `payments.package_id` — комментарий обновлён с `economy_1...premium_5` на `hook/product_shots/seller`.
- **server.js:** добавлен `trust proxy` в скелет.

### `PROJECT.md`
- **MVP-скоуп / Биллинг:** старые 6 пакетов (199/890/2390/3990, 590/2490) → 3 пакета (599/1099/1599). Добавлен хостинг (reg.cloud VPS РФ, БД локально), юр-основа (самозанятый), план ЮKassa.

### `ROADMAP.md`
- **Карта статусов:** добавлены Sprint C ✅ и миграция VPS ✅.
- **Sprint 6:** тарифы обновлены на 3 пакета.
- **Новые разделы:** Sprint C (детали), миграция VPS (детали).
- **Sprint 7:** разбит на Блок 1 (админка) и Блок 2 (юр-страницы), с привязкой к файлам ТЗ.
- **После MVP:** добавлены: уведомление в РКН, заявка в ЮKassa, ресайз VPS, EMAIL_FROM.
- **Оценка:** обновлена — ядро работает, до запуска Sprint 7 (два блока).
- Sprint 4 (FFmpeg): «на Railway» → «на VPS».

### `AI_PROVIDERS.md`
- **Шапка:** дата 05.06.2026, уточнение (Kling/Veo + Nano Banana), заметка про перевыпуск ключей S3.
- **Учёт стоимости:** факт Wan $0.50 → Kling $0.21. Добавлена актуальная тарифная сетка (3 пакета).

### `VIDEOAI_STRATEGY_V2.md`
- **§6 Тарифы:** черновик (490-790/1990/4990) → актуальная сетка 3 пакетов с таблицей ₽/кредит. Упоминание самозанятого.
- **§8 Операционный риск:** «ИП/самозанятость к этапу запуска» → «зарегистрирован как самозанятый (НПД)».

### `ecosystem.config.js` → `ecosystem.config.cjs`
- Переименован (ESM-проект, `.js` с `module.exports` падает).
- Добавлен `node_args: '--env-file=.env'`.

## Не тронуто (исторические отчёты)
- `SPRINT_1_REPORT.md`, `SPRINT_2_REPORT.md`, `SPRINT_2_PROMPT.md`, `SPRINT_3_REPORT.md`, `SPRINT_6_REPORT.md`, `SPRINT_A_REPORT.md`, `SPRINT_B_REPORT.md`, `SPRINT_B2_REPORT.md`, `SPRINT_C_REPORT.md`, `SPRINT_C_MERGE_REPORT.md`, `SPRINT_C_DEPLOY_REPORT.md`, `VIDEOAI_PIVOT_STRATEGY.md`, `VPS_PREP_REPORT.md`.

## Чеклист DoD
- [x] Нет старой тарифной сетки (199/890/2390/3990, 590/2490) в живых доках — проверено grep
- [x] Railway не описан как текущий прод — текущий прод reg.cloud VPS
- [x] `CLAUDE.md` — актуальный раздел инфраструктуры + юр-статус/152-ФЗ
- [x] Sprint C отмечен задеплоенным; Sprint 7 разбит на Блок 1/2
- [x] `ecosystem.config` — `.cjs` (проверено `ls`)
- [x] Исторические `SPRINT_*` не изменены
- [x] Билд проходит (0 ошибок)
