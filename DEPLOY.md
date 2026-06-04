# Деплой VideoAI на VPS

1. `cp .env.example .env` — заполнить все ключи (DATABASE_URL, JWT_SECRET, FAL_KEY, S3, ЮMoney, Brevo, GigaChat).
2. `npm ci && npm run build` — установить зависимости и собрать фронтенд.
3. `pm2 start ecosystem.config.js` — запустить сервер (1 инстанс, fork mode).
4. Скопировать `nginx/videoai.conf` в `/etc/nginx/sites-enabled/`, затем `sudo nginx -t && sudo systemctl reload nginx`.
5. `sudo certbot --nginx -d ddvideoai.ru -d www.ddvideoai.ru` — SSL-сертификат.

Подробный порядок (SSH, PostgreSQL, Node, PM2, DNS) — в отдельном runbook.
