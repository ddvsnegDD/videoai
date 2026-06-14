# Dashboard Card Link Report — кликабельные карточки проектов

## Фича
Карточки проектов на DashboardPage стали кликабельными: клик по карточке ведёт на `/project/:id`, где доступна страница проекта с наложением звука.

**Дата:** 06.06.2026
**Статус:** завершён (код, билд — готовы)

---

## Изменённый файл

### `src/pages/DashboardPage.jsx`

**1. Навигация внутри ProjectCard:**
- Добавлен `const navigate = useNavigate()` в компонент `ProjectCard`
- Добавлен `onClick={() => navigate(`/project/${p.id}`)}` на корневой `<div>` карточки
- Карточки со статусом «В процессе…» — переход разрешён

**2. Защита кнопок от всплытия (`stopPropagation`):**
- Ссылка скачивания `<a>` — `onClick={e => e.stopPropagation()}`
- Кнопка удаления — `onClick={e => { e.stopPropagation(); setConfirming(true); }}`
- Overlay подтверждения удаления — `onClick={e => { e.stopPropagation(); setConfirming(false); }}`
- Кнопки внутри overlay («Удалить» / «Отмена») — уже имели `e.stopPropagation()`

**3. Визуальная подсказка кликабельности:**
- `cursor: 'pointer'` на карточке
- Hover-состояние через React state `hovered`:
  - Тень: `0 4px 12px` → `0 8px 24px rgba(10,46,31,0.10)`
  - Подъём: `translateY(-2px)`
  - `transition: box-shadow 0.2s ease, transform 0.2s ease`

---

## Что НЕ изменено

| Элемент | Статус |
|---|---|
| ProjectPage.jsx | ✅ Не тронут |
| App.jsx (роут `/project/:id`) | ✅ Уже был, не тронут |
| server.js | ✅ Не тронут |
| Авторизация / платежи / задачи | ✅ Не тронуты |

---

## Тесты

| Тест | Результат |
|---|---|
| `npx vite build` | PASS (1639 модулей, 337 KB JS) |
| `navigate('/project/')` в бандле | PASS (1 совпадение) |
| `stopPropagation` в бандле | PASS (3 совпадения) |
| `translateY` hover в бандле | PASS (2 совпадения) |

---

## DoD

- [x] Клик по карточке → навигация на `/project/:id`
- [x] Кнопки «Скачать MP4», «Удалить» — НЕ навигируют (stopPropagation)
- [x] Hover-эффект: тень + подъём + cursor:pointer
- [x] Карточки «В процессе…» — переход разрешён
- [x] `npx vite build` — без ошибок
- [x] Данный отчёт `DASHBOARD_CARD_LINK_REPORT.md` создан

---

## Деплой

На сервере: `git pull` → `npm ci` → `npm run build` → `pm2 restart videoai`.
