#!/bin/bash

echo "🚀 Настройка Telegram бота через Webhook"

# Проверяем переменные окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не установлен"
    echo "Добавьте в .env: TELEGRAM_BOT_TOKEN=ваш_токен"
    exit 1
fi

if [ -z "$WEBHOOK_URL" ]; then
    echo "❌ WEBHOOK_URL не установлен"
    echo "Добавьте в .env: WEBHOOK_URL=https://ваш-домен.com"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY не установлен"
    echo "Добавьте в .env: OPENAI_API_KEY=ваш_ключ"
    exit 1
fi

echo "✅ Переменные окружения проверены"
echo "🔗 Webhook URL: $WEBHOOK_URL/webhook/$TELEGRAM_BOT_TOKEN"

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    npm install
fi

# Запускаем бота
echo "🤖 Запускаем бота через webhook..."
node webhook-bot.js
