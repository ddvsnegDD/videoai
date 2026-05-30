# Sprint A Report — Пивот: AI Creative Engine (фото → видео через fal.ai)

## Статус
**Код написан, задеплоен.** Ожидает добавления FAL_KEY на Railway для живого теста.

## Что изменилось (пивот)
Продукт перестроен: из «генератор слайдшоу-роликов по сценарию» в «AI Creative Engine — загрузи фото товара, получи короткий видеокреатив».

Старый пайплайн: тема → GigaChat (сценарий) → Yandex ART (картинки) → SpeechKit (озвучка) → слайдшоу.

Новый пайплайн (Путь A): фото товара → выбор движения + модели → fal.ai (image-to-video) → MP4.

## Что удалено
| Файл | Что было |
|---|---|
| `server/providers/image.js` | Yandex ART генерация картинок |
| `server/providers/tts.js` | SpeechKit озвучка |
| `server/prompts/scenario.js` | Промпт генерации сценариев |
| `server/prompts/imagePrompt.js` | Промпт для ART |
| `src/components/Storyboard.jsx` | Компонент раскадровки |
| `src/data/voices.js` | Список голосов SpeechKit |

Типы задач `storyboard`, `regenerate_scene`, `script` — убраны из jobs.js.

**Сохранено:** `server/providers/llm.js` (GigaChat) — для Спринта B. Auth, админка, storage, движок задач — переиспользованы.

## Что добавлено

### Бэкенд
| Файл | Что реализовано |
|---|---|
| `server/providers/falVideo.js` | fal.ai клиент: 2 модели (Wan эконом, Veo премиум), 4 пресета движений, async queue (submit → poll → download → S3) |
| `server/jobs.js` | Тип `animate`, free-tries логика (free_wan/free_veo), возврат кредитов и free-попыток при сбое |
| `server.js` | POST /api/upload (multer → S3), GET /api/config, роут animate в POST /api/jobs |
| `server/db.js` | Колонки users.free_wan, users.free_veo |
| `server/auth.js` | free_wan/free_veo в sanitizeUser |

### Фронтенд
| Файл | Что реализовано |
|---|---|
| `src/pages/EditorPage.jsx` | Полная переработка: drag&drop фото → выбор движения (4 пресета + свой) → выбор модели (Wan/Veo) → генерация → результат с видео |
| `src/pages/ProjectPage.jsx` | Упрощён: видео-плеер + скачать + создать ещё |
| `src/components/ProjectCard.jsx` | Thumbnail из image_url, бейдж «Готово» с MP4 |
| `src/components/GenerationProgress.jsx` | Текст «Оживляю товар...», прогресс-бар |
| `src/components/Layout.jsx` | Бейдж кредитов + бесплатные попытки |
| `src/pages/DashboardPage.jsx` | Текст «Создать креатив» |

## Модели fal.ai
| Ключ | Endpoint | Кредиты | Описание |
|---|---|---|---|
| `wan` | `fal-ai/wan/v2.1/image-to-video` | 40 (CREDITS_WAN) | Эконом, быстрый |
| `veo` | `fal-ai/veo3/image-to-video` | 90 (CREDITS_VEO) | Премиум, кинематографичное |

**ВАЖНО:** Точные endpoint fal.ai нужно сверить с актуальной документацией. Если endpoint изменился — поправить строку `id` в `VIDEO_MODELS` в falVideo.js.

## Пресеты движений
| Ключ | Название | Промпт (англ.) |
|---|---|---|
| push_in | Наезд камеры | slow cinematic camera push-in... |
| rotate | Поворот товара | slow elegant rotation... |
| orbit | Облёт вокруг | camera slowly orbits around... |
| float | Парение | product gently floating... |

Пользователь может ввести свой промпт вместо пресета.

## Экономика
- **Wan (эконом):** 40 кр. (~80₽ при цене кредита 2₽). Себестоимость ~$0.50.
- **Veo (премиум):** 90 кр. (~180₽). Себестоимость ~$1.20.
- **Бесплатные пробные:** free_wan=1, free_veo=1 при регистрации.
- **Welcome credits:** 50 (WELCOME_CREDITS env).
- При сбое: полный возврат кредитов ИЛИ free-попытки.

## Загрузка фото
- POST /api/upload — принимает multipart (поле `image`), JPG/PNG/WEBP, до 10 МБ.
- Сохраняет в S3: `uploads/{userId}/{timestamp}.{ext}`.
- Возвращает публичный URL — этот URL передаётся в fal.ai как `image_url`.

## Новые переменные окружения
| Переменная | Назначение | Дефолт |
|---|---|---|
| `FAL_KEY` | API-ключ fal.ai | — (обязательна) |
| `CREDITS_WAN` | Стоимость Wan-генерации | 40 |
| `CREDITS_VEO` | Стоимость Veo-генерации | 90 |

Существующие: WELCOME_CREDITS (50), ADMIN_EMAIL, S3_*, JWT_SECRET, DATABASE_URL — без изменений.

## Новые зависимости
| Пакет | Версия | Назначение |
|---|---|---|
| `@fal-ai/client` | ^1.x | Клиент fal.ai (queue submit/poll/result) |
| `multer` | ^1.x | Multipart upload middleware для Express |

## Как проверить
1. Добавить на Railway: `FAL_KEY=<ключ fal.ai>`, `CREDITS_WAN=40`, `CREDITS_VEO=90`
2. Деплой
3. Войти → «Новый креатив»
4. Загрузить фото товара (drag&drop или выбор файла)
5. Выбрать движение (наезд/поворот/облёт/парение)
6. Выбрать модель: Wan (эконом, бесплатно первый раз) или Veo (премиум)
7. «Создать креатив» → прогресс → готовое видео
8. Скачать MP4
9. Проверить файлы в бакете: `uploads/` (фото) + `projects/` (видео)
10. Кредиты: первая генерация бесплатна (free_wan/free_veo), вторая — за кредиты
11. Админка: начислить кредиты через /admin

## Вероятные затыки при первом запуске
1. **Endpoint fal.ai** — если `fal-ai/wan/v2.1/image-to-video` или `fal-ai/veo3/image-to-video` не существует, нужно найти актуальный endpoint на fal.ai/models и обновить `VIDEO_MODELS.*.id` в falVideo.js.
2. **Формат ответа fal** — код пробует `data.video.url`, `data.output.url`, `data.url`. Если fal вернёт другую структуру — нужно поправить (первый запрос логируется полностью).
3. **Публичность URL из бакета** — fal принимает только публичный URL для image_url. Бакет должен быть настроен на публичное чтение.
4. **Параметры моделей** — resolution, duration, enable_audio могут различаться у Wan и Veo. Сейчас передаём минимальный набор (image_url + prompt). Если модель требует обязательные параметры — добавить.

## Осталась ли legacy-логика
- `server/providers/llm.js` — GigaChat. НЕ вызывается, сохранён для Спринта B.
- Промпт-файл `server/prompts/scenario.js` — УДАЛЁН. Если понадобится GigaChat для генерации промптов креативов — писать новый.
- Фронт: EditorPage полностью переписан, старой логики нет. AdminPage — без изменений (показывает задачи всех типов).
