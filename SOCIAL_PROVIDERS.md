# SOCIAL_PROVIDERS.md — VideoAI

> ## ⏸ СТАТУС: ОТЛОЖЕНО (вне скоупа после пивота) — обновлено 31.05.2026
>
> После пивота продукт = **AI Creative Engine**: пользователь получает клип и **скачивает MP4**, публикует сам. Автопубликация в соцсети из текущего флоу убрана.
>
> Спека ниже **сохранена без изменений** как референс для возврата фичи на пост-MVP / B2B-этапе (см. «После MVP» в `ROADMAP.md`). В текущем коде эти провайдеры — отложенное легаси; в новом флоу не использовать.
>
> Если соцсети вернутся — реализовывать по этой спеке: единый `PublishProvider`, шифрование токенов, очередь публикаций.

---


Документ описывает интеграции с социальными сетями. Цель — единый интерфейс `PublishProvider`, чтобы добавление новой площадки сводилось к написанию одного файла.

---

## Единый интерфейс PublishProvider

Каждый провайдер экспортирует:

```javascript
// 1. Подключение аккаунта пользователя
export async function getAuthUrl(state) { /* → returns OAuth URL */ }
export async function handleCallback(code) { /* → returns { account_id, access_token, refresh_token, metadata } */ }

// 2. Публикация
export async function publish({ connection, video_url, caption }) {
  // connection — запись из social_connections
  // → returns { external_id, url }
}

// 3. Проверка соединения
export async function checkConnection(connection) {
  // → returns { ok, account_name, follower_count? }
}
```

---

## VK

**Файл:** `server/providers/vk.js`

### Подключение
- OAuth 2.0 implicit или authorization_code flow
- Scopes: `wall,video,groups,offline`
- App ID/Secret — в `.env`
- Callback: `https://ddvideoai.ru/api/social/vk/callback`

### Публикация видео
3-шаговый процесс через VK API:

1. `video.save` — получаем `upload_url` и `owner_id, video_id`
2. POST на `upload_url` с файлом → видео загружено
3. `wall.post` с `attachment=video{owner_id}_{video_id}` и текстом

### Особенности
- Публикуем **в группу пользователя**, не на личную стену (нужен `group_id` в metadata)
- Лимит размера видео: 5 ГБ (нам с запасом)
- Длительность обработки видео VK'ом: до 5 минут — публикуется отложенно
- Лимит постов: ~50 в день на группу

### Ошибки
- 5 (User authorization failed) — токен невалиден, нужно переподключение
- 9 (Flood control) — повторить через 60 сек
- 14 (Captcha) — не лечится автоматически, пользователю уведомление

---

## Telegram

**Файл:** `server/providers/telegram.js`

### Подключение
В отличие от VK, нет OAuth. Логика:

1. Создаём `@videoai_bot` через BotFather
2. Пользователь добавляет бота в свой канал админом
3. Пользователь жмёт "Подключить Telegram-канал" в нашем кабинете
4. Мы даём инструкцию: переслать в `@videoai_bot` любое сообщение из канала
5. Получаем `chat_id` через `getUpdates` или webhook
6. Сохраняем в `social_connections` с `metadata = { chat_id, channel_title }`

**Альтернатива:** пользователь сам узнаёт chat_id и вводит. Менее удобно.

### Публикация
- Метод: `sendVideo`
- Лимит размера через Bot API: 50 МБ
- Если > 50 МБ — нужен self-hosted Bot API сервер (на B2B-этапе)
- Для MVP режем итоговые видео до 50 МБ через FFmpeg

### Особенности
- Caption ограничен 1024 символами
- Поддерживает HTML/Markdown форматирование
- Может публиковать в каналы И в группы — одинаково через `chat_id`

---

## MAX (мессенджер от VK)

**Файл:** `server/providers/max.js`

### Статус
API для публикации в MAX от юрлиц находится в развитии. На момент старта MVP — заглушка.

### Реализация заглушки
```javascript
export async function publish({ connection, video_url, caption }) {
  return {
    ok: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Интеграция с MAX скоро будет доступна. Уведомим вас на email.',
    },
  };
}

export async function getAuthUrl() {
  return null; // в UI кнопка disabled с тултипом "Скоро"
}
```

### Подготовка к реальной интеграции
- Следим за публикациями VK для бизнеса
- Структура `social_connections` уже поддерживает `platform = 'max'`
- UI готов отображать MAX наравне с VK/TG
- Когда API стабилизируется — пишем настоящую реализацию, остальной код не трогаем

---

## Безопасность токенов

Все `access_token` и `refresh_token` в БД **зашифрованы** через AES-256-GCM.

```javascript
// server/crypto.js
import crypto from 'crypto';
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex'); // 32 байта

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decrypt(encrypted) {
  const buf = Buffer.from(encrypted, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
```

`TOKEN_ENCRYPTION_KEY` — отдельная переменная окружения, **не** в репозитории.

---

## Refresh токенов

VK выдаёт `offline`-токены — они не истекают (пока пользователь не отозвал доступ).

Telegram — токен бота вечен (если не пересоздан через BotFather).

MAX — пока неизвестно, будет ли refresh.

При получении `AUTH_ERROR` от провайдера — в `social_connections` ставим `is_valid = false`, в UI показываем "Переподключите аккаунт".

---

## Очередь публикаций

Публикация — тоже job (типа `publish`), но не списывает кредиты (она бесплатна).

При планировщике (после MVP) появится поле `scheduled_at` в `publications`. Воркер раз в минуту проверяет — публикует те, что подошли по времени.

Для MVP — публикация сразу при создании.
