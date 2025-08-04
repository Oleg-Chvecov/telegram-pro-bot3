#!/bin/bash

echo "🪰 Деплой на Fly.io"

# Установите Fly CLI
# curl -L https://fly.io/install.sh | sh

# Логин
fly auth login

# Создайте приложение
fly launch --no-deploy

# Добавьте секреты
fly secrets set TELEGRAM_BOT_TOKEN=your_token
fly secrets set OPENAI_API_KEY=your_key
fly secrets set PERPLEXITY_API_KEY=your_key
fly secrets set SUPABASE_URL=your_supabase_url
fly secrets set SUPABASE_ANON_KEY=your_supabase_key

# Деплой
fly deploy

echo "🎉 Бот развернут на Fly.io!"
