#!/bin/bash

echo "▲ Деплой на Vercel"

# Установите Vercel CLI
npm install -g vercel

# Логин в Vercel
vercel login

# Деплой проекта
vercel

# Добавьте переменные окружения
vercel env add TELEGRAM_BOT_TOKEN
vercel env add OPENAI_API_KEY      # Тот же что в v0
vercel env add PERPLEXITY_API_KEY  # Тот же что в v0

# Продакшн деплой
vercel --prod

echo "✅ Получите URL и настройте webhook"
