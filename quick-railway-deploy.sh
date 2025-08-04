#!/bin/bash

echo "🚂 Быстрый деплой на Railway"

# Установите Railway CLI
npm install -g @railway/cli

# Логин в Railway
railway login

# Создайте новый проект
railway new telegram-ai-bot

# Добавьте ваши ключи (которые уже есть в v0)
railway variables set TELEGRAM_BOT_TOKEN=your_telegram_token
railway variables set OPENAI_API_KEY=your_openai_key  # Тот же что в v0
railway variables set PERPLEXITY_API_KEY=your_perplexity_key  # Тот же что в v0

# Railway автоматически создаст WEBHOOK_URL
echo "✅ Railway создаст автоматический HTTPS URL"

# Загрузите код из v0
# Скачайте проект из v0 и распакуйте в папку

# Деплой
railway up

echo "🎉 Бот развернут! URL будет показан в консоли"
