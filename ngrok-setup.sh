#!/bin/bash

echo "🌐 Настройка с Ngrok"

# Установите ngrok
# https://ngrok.com/download

# Запустите локальный сервер
node webhook-bot.js &
SERVER_PID=$!

# Ждем запуска сервера
sleep 3

# Запускаем ngrok
ngrok http 3000 &
NGROK_PID=$!

echo "🔗 Ngrok запущен!"
echo "📋 Скопируйте HTTPS URL из ngrok и добавьте в .env как WEBHOOK_URL"

# Функция для остановки
cleanup() {
    echo "🛑 Останавливаем сервисы..."
    kill $SERVER_PID 2>/dev/null
    kill $NGROK_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

wait
