#!/bin/bash

echo "▲ Деплой Telegram бота на Vercel"

# 1. Установите Vercel CLI
echo "📦 Устанавливаем Vercel CLI..."
npm install -g vercel

# 2. Логин в Vercel
echo "🔐 Логин в Vercel..."
vercel login

# 3. Деплой проекта
echo "🚀 Деплой проекта..."
vercel

# 4. Добавьте переменные окружения
echo "🔑 Добавляем переменные окружения..."
echo "Выполните эти команды:"
echo "vercel env add TELEGRAM_BOT_TOKEN"
echo "vercel env add OPENAI_API_KEY"
echo "vercel env add PERPLEXITY_API_KEY"

# 5. Продакшн деплой
echo "🎯 Продакшн деплой..."
vercel --prod

echo ""
echo "✅ Деплой завершен!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Скопируйте URL вашего приложения"
echo "2. Откройте https://your-app.vercel.app/api/setup-webhook"
echo "3. Проверьте статус: https://your-app.vercel.app/api/status"
echo "4. Протестируйте бота в Telegram!"
