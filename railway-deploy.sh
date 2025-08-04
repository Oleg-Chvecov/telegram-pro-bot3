#!/bin/bash

echo "🚂 Деплой на Railway"

# Установите Railway CLI
# npm install -g @railway/cli

# Логин
railway login

# Создайте проект
railway new

# Добавьте переменные окружения
railway variables set TELEGRAM_BOT_TOKEN=your_token
railway variables set OPENAI_API_KEY=your_key
railway variables set PERPLEXITY_API_KEY=your_key
railway variables set SUPABASE_URL=your_supabase_url
railway variables set SUPABASE_ANON_KEY=your_supabase_key

# Railway автоматически установит WEBHOOK_URL
echo "✅ Railway автоматически создаст WEBHOOK_URL"

# Деплой
railway up

echo "🎉 Бот развернут на Railway!"
