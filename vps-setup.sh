#!/bin/bash

echo "🖥️ Настройка на VPS"

# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Устанавливаем PM2
sudo npm install -g pm2

# Клонируем проект
git clone https://github.com/your-repo/telegram-bot.git
cd telegram-bot

# Устанавливаем зависимости
npm install

# Создаем .env файл
cat > .env << EOF
TELEGRAM_BOT_TOKEN=your_token
OPENAI_API_KEY=your_key
PERPLEXITY_API_KEY=your_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
WEBHOOK_URL=https://your-domain.com
PORT=3000
EOF

# Запускаем с PM2
pm2 start webhook-bot.js --name telegram-bot

# Автозапуск
pm2 startup
pm2 save

echo "✅ Бот запущен на VPS!"
