-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    ai_provider VARCHAR(50) DEFAULT 'openai',
    system_prompt VARCHAR(50) DEFAULT 'assistant',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы сообщений
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    ai_provider VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- RLS (Row Level Security) для безопасности
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Политики доступа (разрешаем все операции для сервиса)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Представление для статистики
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.user_id,
    u.first_name,
    u.ai_provider,
    u.system_prompt,
    COUNT(m.id) as total_messages,
    COUNT(CASE WHEN m.ai_provider = 'openai' THEN 1 END) as openai_messages,
    COUNT(CASE WHEN m.ai_provider = 'perplexity' THEN 1 END) as perplexity_messages,
    MIN(m.created_at) as first_message_at,
    MAX(m.created_at) as last_message_at
FROM users u
LEFT JOIN messages m ON u.user_id = m.user_id
GROUP BY u.user_id, u.first_name, u.ai_provider, u.system_prompt;
