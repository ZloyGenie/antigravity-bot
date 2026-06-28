# ☁️ Инструкция по бесплатной публикации бота на Render.com (24/7 доступ)

С помощью этой инструкции ваш бот будет работать в облаке 24/7 совершенно бесплатно, и вы сможете пользоваться им с телефона даже когда ваш ПК выключен.

---

### Шаг 1: Загрузка кода на GitHub

1. Зарегистрируйтесь или войдите на [GitHub.com](https://github.com/).
2. Создайте новый репозиторий (назовите его, например, `antigravity-telegram-bot`). Выберите тип **Private** (Приватный) для безопасности.
3. В папке вашего бота на ПК вы можете загрузить код на GitHub командами:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/ВАШ_НИК/antigravity-telegram-bot.git
   git push -u origin main
   ```
   *(Файл `.env` с вашими паролями не попадет на GitHub благодаря созданному файлу `.gitignore`)*.

---

### Шаг 2: Деплой на Render.com

1. Зарегистрируйтесь на бесплатном сайте [Render.com](https://render.com/).
2. В панели управления нажмите кнопку **New +** в правом верхнем углу и выберите **Web Service**.
3. Подключите ваш GitHub аккаунт и выберите созданный репозиторий `antigravity-telegram-bot`.
4. Заполните настройки проекта:
   - **Name**: `antigravity-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Нажмите на раздел **Environment Variables** (Переменные окружения) и добавьте 3 ключа:
   - `BOT_TOKEN` = Ваш токен бота от `@BotFather`
   - `ALLOWED_USER_ID` = Ваш Telegram ID от `@userinfobot`
   - `GEMINI_API_KEY` = Ваш API ключ из Google AI Studio
6. Нажмите **Create Web Service**.

---

🎉 **Готово!** Render за пару минут развернет бота. В логах появится надпись `🤖 Telegram Bot успешно запущен!`. 
Теперь ваш бот доступен в Telegram 24/7 с вашего телефона из любой точки мира!
