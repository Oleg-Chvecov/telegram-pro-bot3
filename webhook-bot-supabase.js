import express from "express"
import TelegramBot from "node-telegram-bot-api"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

// Инициализация
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: false })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Supabase клиент
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

console.log("🤖 Webhook бот с Supabase запускается...")

// Создаем таблицы в Supabase при первом запуске
async function initDatabase() {
  try {
    // Создаем таблицу пользователей
    const { error: usersError } = await supabase.rpc("create_users_table")

    // Создаем таблицу сообщений
    const { error: messagesError } = await supabase.rpc("create_messages_table")

    console.log("✅ База данных инициализирована")
  } catch (error) {
    console.log("ℹ️ Таблицы уже существуют или ошибка:", error.message)
  }
}

// Сохранение пользователя в Supabase
async function saveUser(userId, userData) {
  try {
    const { data, error } = await supabase
      .from("users")
      .upsert({
        user_id: userId,
        username: userData.username,
        first_name: userData.first_name,
        last_name: userData.last_name,
        ai_provider: "openai",
        system_prompt: "assistant",
        updated_at: new Date().toISOString(),
      })
      .select()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Ошибка сохранения пользователя:", error)
    return null
  }
}

// Получение настроек пользователя
async function getUserSettings(userId) {
  try {
    const { data, error } = await supabase.from("users").select("*").eq("user_id", userId).single()

    if (error && error.code !== "PGRST116") throw error

    return (
      data || {
        ai_provider: "openai",
        system_prompt: "assistant",
        temperature: 0.7,
        max_tokens: 1000,
      }
    )
  } catch (error) {
    console.error("Ошибка получения настроек:", error)
    return {
      ai_provider: "openai",
      system_prompt: "assistant",
      temperature: 0.7,
      max_tokens: 1000,
    }
  }
}

// Сохранение сообщения
async function saveMessage(userId, message, response, aiProvider) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        user_id: userId,
        message: message,
        response: response,
        ai_provider: aiProvider,
        created_at: new Date().toISOString(),
      })
      .select()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Ошибка сохранения сообщения:", error)
    return null
  }
}

// Получение истории сообщений
async function getMessageHistory(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("message, response")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    // Преобразуем в формат для OpenAI
    const history = []
    if (data) {
      data.reverse().forEach((msg) => {
        history.push({ role: "user", content: msg.message })
        history.push({ role: "assistant", content: msg.response })
      })
    }

    return history
  } catch (error) {
    console.error("Ошибка получения истории:", error)
    return []
  }
}

// Статистика пользователя
async function getUserStats(userId) {
  try {
    const { data, error } = await supabase.from("messages").select("ai_provider, created_at").eq("user_id", userId)

    if (error) throw error

    const stats = {
      total_messages: data?.length || 0,
      openai_messages: data?.filter((m) => m.ai_provider === "openai").length || 0,
      perplexity_messages: data?.filter((m) => m.ai_provider === "perplexity").length || 0,
      first_message: data?.[0]?.created_at || null,
    }

    return stats
  } catch (error) {
    console.error("Ошибка получения статистики:", error)
    return { total_messages: 0, openai_messages: 0, perplexity_messages: 0 }
  }
}

// Системные промпты
const systemPrompts = {
  assistant: "Ты полезный ИИ-ассистент. Отвечай кратко и по делу на русском языке.",
  creative: "Ты креативный писатель. Используй яркие образы и метафоры. Отвечай на русском языке.",
  technical: "Ты технический эксперт. Давай точные и подробные объяснения на русском языке.",
  casual: "Ты дружелюбный собеседник. Общайся неформально и с юмором на русском языке.",
  teacher: "Ты опытный преподаватель. Объясняй сложные вещи простыми словами на русском языке.",
}

// Функция для запроса к OpenAI с историей
async function askOpenAI(userId, userMessage, settings) {
  try {
    // Получаем историю сообщений
    const history = await getMessageHistory(userId, 5)

    // Формируем сообщения
    const messages = [
      { role: "system", content: systemPrompts[settings.system_prompt] || systemPrompts.assistant },
      ...history,
      { role: "user", content: userMessage },
    ]

    const response = await openai.chat.completions.create({
      model: settings.model || "gpt-4",
      messages: messages,
      temperature: settings.temperature || 0.7,
      max_tokens: settings.max_tokens || 1000,
    })

    const content = response.choices[0].message.content

    // Сохраняем в базу
    await saveMessage(userId, userMessage, content, "openai")

    return {
      success: true,
      content: content,
      usage: response.usage,
    }
  } catch (error) {
    console.error("OpenAI Error:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Функция для запроса к Perplexity с историей
async function askPerplexity(userId, userMessage, settings) {
  try {
    // Получаем историю сообщений
    const history = await getMessageHistory(userId, 5)

    // Формируем сообщения
    const messages = [
      { role: "system", content: systemPrompts[settings.system_prompt] || systemPrompts.assistant },
      ...history,
      { role: "user", content: userMessage },
    ]

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: messages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.max_tokens || 1000,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || "Perplexity API error")
    }

    const content = data.choices[0].message.content

    // Сохраняем в базу
    await saveMessage(userId, userMessage, content, "perplexity")

    return {
      success: true,
      content: content,
      usage: data.usage,
    }
  } catch (error) {
    console.error("Perplexity Error:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Webhook endpoint
app.post(`/webhook/${token}`, async (req, res) => {
  try {
    await bot.processUpdate(req.body)
    res.status(200).send("OK")
  } catch (error) {
    console.error("❌ Ошибка webhook:", error)
    res.status(500).send("Error")
  }
})

// Health check с статистикой из Supabase
app.get("/health", async (req, res) => {
  try {
    // Получаем общую статистику
    const { data: usersCount } = await supabase.from("users").select("user_id", { count: "exact" })

    const { data: messagesCount } = await supabase.from("messages").select("id", { count: "exact" })

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      webhook_url: `${process.env.WEBHOOK_URL}/webhook/${token}`,
      database: {
        users: usersCount?.length || 0,
        messages: messagesCount?.length || 0,
      },
    })
  } catch (error) {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database_error: error.message,
    })
  }
})

// Обработчик /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id

  // Сохраняем пользователя в Supabase
  await saveUser(userId, msg.from)

  const welcomeMessage = `
🤖 **Добро пожаловать в AI Bot с Supabase!**

Привет, ${msg.from.first_name}! 

🧠 **OpenAI GPT** - Для творческих задач
🔍 **Perplexity** - Для актуальной информации

📊 **Все ваши разговоры сохраняются в Supabase**
⚡ **Работает через Webhook для максимальной скорости**

Задайте любой вопрос!
`

  await bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🧠 OpenAI", callback_data: "ai_openai" },
          { text: "🔍 Perplexity", callback_data: "ai_perplexity" },
        ],
        [
          { text: "📊 Статистика", callback_data: "stats" },
          { text: "🗑️ Очистить историю", callback_data: "clear_history" },
        ],
      ],
    },
  })
})

// Обработчик callback запросов
bot.on("callback_query", async (callbackQuery) => {
  const message = callbackQuery.message
  const chatId = message.chat.id
  const messageId = message.message_id
  const data = callbackQuery.data
  const userId = callbackQuery.from.id

  await bot.answerCallbackQuery(callbackQuery.id)

  switch (data) {
    case "stats":
      const stats = await getUserStats(userId)
      const statsMessage = `
📊 **Ваша статистика**

👤 Пользователь: ${callbackQuery.from.first_name}
💬 Всего сообщений: ${stats.total_messages}
🧠 OpenAI: ${stats.openai_messages}
🔍 Perplexity: ${stats.perplexity_messages}
📅 Первое сообщение: ${stats.first_message ? new Date(stats.first_message).toLocaleDateString("ru-RU") : "Нет данных"}

💾 Данные хранятся в Supabase
      `

      await bot.editMessageText(statsMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Назад", callback_data: "back_main" }]],
        },
      })
      break

    case "clear_history":
      try {
        const { error } = await supabase.from("messages").delete().eq("user_id", userId)

        if (error) throw error

        await bot.editMessageText("🗑️ **История очищена!**\n\nВсе ваши сообщения удалены из базы данных.", {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Назад", callback_data: "back_main" }]],
          },
        })
      } catch (error) {
        await bot.editMessageText("❌ **Ошибка очистки истории**\n\nПопробуйте позже.", {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Назад", callback_data: "back_main" }]],
          },
        })
      }
      break

    // Остальные обработчики...
  }
})

// Основной обработчик сообщений
bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  const text = msg.text

  if (!text || text.startsWith("/")) return

  await bot.sendChatAction(chatId, "typing")

  try {
    const settings = await getUserSettings(userId)
    const aiProvider = settings.ai_provider || "openai"

    let result
    if (aiProvider === "openai") {
      result = await askOpenAI(userId, text, settings)
    } else {
      result = await askPerplexity(userId, text, settings)
    }

    if (result?.success) {
      await bot.sendMessage(chatId, result.content, {
        reply_to_message_id: msg.message_id,
      })
    } else {
      await bot.sendMessage(chatId, `❌ Ошибка: ${result?.error}`, {
        reply_to_message_id: msg.message_id,
      })
    }
  } catch (error) {
    console.error("Message processing error:", error)
    await bot.sendMessage(chatId, "❌ Произошла ошибка. Попробуйте позже.")
  }
})

// Настройка webhook
async function setupWebhook() {
  try {
    const fullWebhookUrl = `${process.env.WEBHOOK_URL}/webhook/${token}`
    console.log(`🔗 Настраиваем webhook: ${fullWebhookUrl}`)

    await bot.deleteWebHook()
    const result = await bot.setWebHook(fullWebhookUrl, {
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    })

    if (result) {
      console.log("✅ Webhook установлен!")
      const info = await bot.getWebHookInfo()
      console.log("📊 Webhook info:", info.url)
    }
  } catch (error) {
    console.error("❌ Ошибка webhook:", error)
  }
}

// Запуск
app.listen(port, async () => {
  console.log(`🚀 Сервер запущен на порту ${port}`)

  // Инициализируем базу данных
  await initDatabase()

  // Настраиваем webhook
  if (process.env.WEBHOOK_URL) {
    await setupWebhook()
  }

  console.log("✅ Бот готов с Supabase!")
})
