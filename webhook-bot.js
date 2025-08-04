import express from "express"
import TelegramBot from "node-telegram-bot-api"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(express.json())

// Инициализация
const token = process.env.TELEGRAM_BOT_TOKEN
const openaiApiKey = process.env.OPENAI_API_KEY
const perplexityApiKey = process.env.PERPLEXITY_API_KEY
const webhookUrl = process.env.WEBHOOK_URL

// Создаем бота БЕЗ polling (для webhook)
const bot = new TelegramBot(token, { polling: false })
const openai = new OpenAI({ apiKey: openaiApiKey })

// Supabase (если используете)
const supabase = process.env.SUPABASE_URL ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY) : null

// Хранилище данных (в памяти)
const conversations = new Map()
const userSettings = new Map()

console.log("🤖 Webhook AI Telegram Bot запускается...")

// Системные промпты
const systemPrompts = {
  assistant: "Ты полезный ИИ-ассистент. Отвечай кратко и по делу на русском языке.",
  creative: "Ты креативный писатель. Используй яркие образы и метафоры. Отвечай на русском языке.",
  technical: "Ты технический эксперт. Давай точные и подробные объяснения на русском языке.",
  casual: "Ты дружелюбный собеседник. Общайся неформально и с юмором на русском языке.",
  teacher: "Ты опытный преподаватель. Объясняй сложные вещи простыми словами на русском языке.",
}

// Инициализация пользователя
function initUser(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, [])
  }
  if (!userSettings.has(userId)) {
    userSettings.set(userId, {
      aiProvider: "openai",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: "assistant",
    })
  }
}

// Функция для запроса к OpenAI
async function askOpenAI(messages, settings) {
  try {
    const response = await openai.chat.completions.create({
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    })

    return {
      success: true,
      content: response.choices[0].message.content,
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

// Функция для запроса к Perplexity
async function askPerplexity(messages, settings) {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || "Perplexity API error")
    }

    return {
      success: true,
      content: data.choices[0].message.content,
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

// Функция для получения ответа от ИИ
async function getAIResponse(userId, userMessage, provider = null) {
  const conversation = conversations.get(userId) || []
  const settings = userSettings.get(userId)
  const aiProvider = provider || settings.aiProvider

  // Добавляем системный промпт
  const systemMessage = {
    role: "system",
    content: systemPrompts[settings.systemPrompt] || systemPrompts.assistant,
  }

  // Добавляем сообщение пользователя
  conversation.push({ role: "user", content: userMessage })

  // Формируем контекст (последние 8 сообщений + система)
  const messages = [systemMessage, ...conversation.slice(-8)]

  let result
  if (aiProvider === "openai") {
    result = await askOpenAI(messages, settings)
  } else if (aiProvider === "perplexity") {
    result = await askPerplexity(messages, settings)
  }

  if (result?.success) {
    conversation.push({ role: "assistant", content: result.content })
    conversations.set(userId, conversation)
  }

  return result
}

// Клавиатуры
function getMainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🧠 OpenAI GPT", callback_data: "ai_openai" },
          { text: "🔍 Perplexity", callback_data: "ai_perplexity" },
        ],
        [
          { text: "💭 Новый чат", callback_data: "new_chat" },
          { text: "📊 Статистика", callback_data: "stats" },
        ],
        [
          { text: "🎭 Режим общения", callback_data: "change_prompt" },
          { text: "ℹ️ Помощь", callback_data: "help" },
        ],
      ],
    },
  }
}

function getPromptKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🤖 Ассистент", callback_data: "prompt_assistant" },
          { text: "🎨 Креативный", callback_data: "prompt_creative" },
        ],
        [
          { text: "⚙️ Технический", callback_data: "prompt_technical" },
          { text: "😊 Дружелюбный", callback_data: "prompt_casual" },
        ],
        [
          { text: "👨‍🏫 Учитель", callback_data: "prompt_teacher" },
          { text: "🔙 Назад", callback_data: "back_main" },
        ],
      ],
    },
  }
}

// Webhook endpoint
app.post(`/webhook/${token}`, async (req, res) => {
  try {
    console.log("📨 Получен webhook запрос")

    // Обрабатываем обновление
    await bot.processUpdate(req.body)

    res.status(200).send("OK")
  } catch (error) {
    console.error("❌ Ошибка webhook:", error)
    res.status(500).send("Error")
  }
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    webhook_url: `${webhookUrl}/webhook/${token}`,
    users: conversations.size,
  })
})

// Статистика
app.get("/stats", (req, res) => {
  res.json({
    total_users: conversations.size,
    total_conversations: Array.from(conversations.values()).reduce((sum, conv) => sum + conv.length, 0),
    uptime: process.uptime(),
    memory_usage: process.memoryUsage(),
  })
})

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id

  initUser(userId)

  const welcomeMessage = `
🤖 **Добро пожаловать в AI Telegram Bot!**

Привет, ${msg.from.first_name}! Я работаю через **Webhook** для максимальной скорости!

🧠 **OpenAI GPT** - Для творческих задач, программирования, анализа
🔍 **Perplexity** - Для поиска актуальной информации в интернете

✨ **Преимущества Webhook:**
• ⚡ Мгновенные ответы
• 🔄 Надежная работа
• 📈 Масштабируемость
• 🚀 Профессиональный подход

Просто напишите мне любой вопрос!
`

  await bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "Markdown",
    ...getMainKeyboard(),
  })
})

// Обработчик callback запросов
bot.on("callback_query", async (callbackQuery) => {
  const message = callbackQuery.message
  const chatId = message.chat.id
  const messageId = message.message_id
  const data = callbackQuery.data
  const userId = callbackQuery.from.id

  initUser(userId)
  await bot.answerCallbackQuery(callbackQuery.id)

  const settings = userSettings.get(userId)

  switch (data) {
    case "ai_openai":
      settings.aiProvider = "openai"
      userSettings.set(userId, settings)

      await bot.editMessageText(
        "🧠 **OpenAI GPT активирован!**\n\nТеперь я буду отвечать используя GPT. Отлично подходит для:\n• Творческих задач\n• Программирования\n• Анализа и рассуждений\n\nЗадайте любой вопрос!",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Назад", callback_data: "back_main" }]],
          },
        },
      )
      break

    case "ai_perplexity":
      settings.aiProvider = "perplexity"
      userSettings.set(userId, settings)

      await bot.editMessageText(
        "🔍 **Perplexity активирован!**\n\nТеперь я буду отвечать используя Perplexity AI. Отлично подходит для:\n• Поиска актуальной информации\n• Новостей и событий\n• Фактических данных\n\nЗадайте любой вопрос!",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Назад", callback_data: "back_main" }]],
          },
        },
      )
      break

    case "new_chat":
      conversations.set(userId, [])
      await bot.editMessageText(
        "💭 **Новый чат начат!**\n\nИстория разговора очищена. Можете начать новую беседу с чистого листа.\n\nТекущий ИИ: " +
          (settings.aiProvider === "openai" ? "🧠 OpenAI GPT" : "🔍 Perplexity"),
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Назад", callback_data: "back_main" }]],
          },
        },
      )
      break

    case "stats":
      const conversation = conversations.get(userId) || []
      const currentAI = settings.aiProvider === "openai" ? "🧠 OpenAI GPT" : "🔍 Perplexity"

      const statsMessage = `
📊 **Ваша статистика**

👤 Пользователь: ${callbackQuery.from.first_name}
🤖 Текущий ИИ: ${currentAI}
🎭 Режим: ${settings.systemPrompt}
💬 Сообщений в чате: ${conversation.length}
🌡️ Температура: ${settings.temperature}
📝 Макс. токены: ${settings.maxTokens}
🧠 Модель: ${settings.model}

📈 Всего пользователей бота: ${conversations.size}
⚡ Работает через Webhook
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

    case "change_prompt":
      await bot.editMessageText(
        "🎭 **Выберите режим общения:**\n\nКаждый режим настраивает стиль ответов ИИ под разные задачи.",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          ...getPromptKeyboard(),
        },
      )
      break

    case "help":
      const helpMessage = `
ℹ️ **Помощь по использованию**

**Основные команды:**
• /start - Главное меню
• /new - Новый чат
• /openai - Переключить на OpenAI
• /perplexity - Переключить на Perplexity

**Как использовать:**
1. Выберите ИИ (OpenAI или Perplexity)
2. Выберите режим общения
3. Задайте любой вопрос
4. Получите умный ответ!

**OpenAI лучше для:**
• Творческих задач
• Программирования
• Анализа и рассуждений

**Perplexity лучше для:**
• Актуальной информации
• Поиска в интернете
• Фактов и новостей

⚡ **Работает через Webhook для максимальной скорости!**
      `

      await bot.editMessageText(helpMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Назад", callback_data: "back_main" }]],
        },
      })
      break

    case "back_main":
      await bot.editMessageText("🏠 **Главное меню**\n\nВыберите действие:", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        ...getMainKeyboard(),
      })
      break

    default:
      if (data.startsWith("prompt_")) {
        const promptType = data.replace("prompt_", "")
        settings.systemPrompt = promptType
        userSettings.set(userId, settings)

        const promptNames = {
          assistant: "🤖 Ассистент",
          creative: "🎨 Креативный",
          technical: "⚙️ Технический",
          casual: "😊 Дружелюбный",
          teacher: "👨‍🏫 Учитель",
        }

        await bot.editMessageText(
          `✅ Выбран режим: **${promptNames[promptType]}**\n\n${systemPrompts[promptType]}\n\nТеперь ИИ будет отвечать в этом стиле!`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔄 Сменить режим", callback_data: "change_prompt" }],
                [{ text: "🔙 Назад", callback_data: "back_main" }],
              ],
            },
          },
        )
      }
      break
  }
})

// Быстрые команды
bot.onText(/\/new/, async (msg) => {
  const userId = msg.from.id
  conversations.set(userId, [])
  await bot.sendMessage(msg.chat.id, "💭 Новый чат начат! История очищена.")
})

bot.onText(/\/openai/, async (msg) => {
  const userId = msg.from.id
  initUser(userId)
  const settings = userSettings.get(userId)
  settings.aiProvider = "openai"
  userSettings.set(userId, settings)
  await bot.sendMessage(msg.chat.id, "🧠 Переключено на OpenAI GPT!")
})

bot.onText(/\/perplexity/, async (msg) => {
  const userId = msg.from.id
  initUser(userId)
  const settings = userSettings.get(userId)
  settings.aiProvider = "perplexity"
  userSettings.set(userId, settings)
  await bot.sendMessage(msg.chat.id, "🔍 Переключено на Perplexity!")
})

// Основной обработчик текстовых сообщений
bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  const text = msg.text

  // Игнорируем команды и не текстовые сообщения
  if (!text || text.startsWith("/") || msg.photo) return

  initUser(userId)

  const settings = userSettings.get(userId)
  const aiProvider = settings.aiProvider
  const aiName = aiProvider === "openai" ? "🧠 OpenAI" : "🔍 Perplexity"

  await bot.sendChatAction(chatId, "typing")

  try {
    const processingMsg = await bot.sendMessage(chatId, `${aiName} обрабатывает ваш запрос... ⏳`)

    const result = await getAIResponse(userId, text)

    await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {})

    if (result?.success) {
      const response = result.content
      const maxLength = 4000

      if (response.length <= maxLength) {
        await bot.sendMessage(chatId, response, {
          reply_to_message_id: msg.message_id,
        })
      } else {
        // Разбиваем длинные сообщения
        const parts = []
        for (let i = 0; i < response.length; i += maxLength) {
          parts.push(response.substring(i, i + maxLength))
        }

        for (let i = 0; i < parts.length; i++) {
          const partMessage = `**Часть ${i + 1}/${parts.length}:**\n\n${parts[i]}`
          await bot.sendMessage(chatId, partMessage, {
            parse_mode: "Markdown",
            reply_to_message_id: i === 0 ? msg.message_id : undefined,
          })

          if (i < parts.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }
      }

      // Показываем информацию об использовании
      if (result.usage) {
        const usageInfo = `📊 Использовано токенов: ${result.usage.total_tokens || "N/A"}`
        await bot.sendMessage(chatId, usageInfo, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "💭 Новый чат", callback_data: "new_chat" },
                { text: "🔄 Сменить ИИ", callback_data: aiProvider === "openai" ? "ai_perplexity" : "ai_openai" },
              ],
            ],
          },
        })
      }
    } else {
      await bot.sendMessage(
        chatId,
        `❌ Ошибка ${aiName}:\n\n${result?.error}\n\nПопробуйте:\n• Переформулировать вопрос\n• Сменить ИИ\n• Начать новый чат`,
        {
          reply_to_message_id: msg.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "💭 Новый чат", callback_data: "new_chat" },
                { text: "🔄 Сменить ИИ", callback_data: aiProvider === "openai" ? "ai_perplexity" : "ai_openai" },
              ],
            ],
          },
        },
      )
    }
  } catch (error) {
    console.error("Message processing error:", error)
    await bot.sendMessage(chatId, "❌ Произошла неожиданная ошибка. Попробуйте позже.", {
      reply_to_message_id: msg.message_id,
    })
  }
})

// Функция настройки webhook
async function setupWebhook() {
  try {
    const fullWebhookUrl = `${webhookUrl}/webhook/${token}`

    console.log(`🔗 Настраиваем webhook: ${fullWebhookUrl}`)

    // Удаляем старый webhook
    await bot.deleteWebHook()
    console.log("🗑️ Старый webhook удален")

    // Устанавливаем новый webhook
    const result = await bot.setWebHook(fullWebhookUrl, {
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    })

    if (result) {
      console.log("✅ Webhook успешно установлен!")

      // Проверяем статус webhook
      const webhookInfo = await bot.getWebHookInfo()
      console.log("📊 Информация о webhook:", {
        url: webhookInfo.url,
        pending_updates: webhookInfo.pending_update_count,
        last_error: webhookInfo.last_error_message,
      })
    } else {
      throw new Error("Не удалось установить webhook")
    }
  } catch (error) {
    console.error("❌ Ошибка настройки webhook:", error.message)
  }
}

// Обработка ошибок
bot.on("error", (error) => {
  console.error("Bot error:", error)
})

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🛑 Получен сигнал SIGINT, завершаем работу...")
  try {
    await bot.deleteWebHook()
    console.log("🗑️ Webhook удален")
  } catch (error) {
    console.error("Ошибка при удалении webhook:", error)
  }
  process.exit(0)
})

process.on("SIGTERM", async () => {
  console.log("🛑 Получен сигнал SIGTERM, завершаем работу...")
  try {
    await bot.deleteWebHook()
    console.log("🗑️ Webhook удален")
  } catch (error) {
    console.error("Ошибка при удалении webhook:", error)
  }
  process.exit(0)
})

// Запуск сервера
app.listen(port, async () => {
  console.log(`🚀 Сервер запущен на порту ${port}`)
  console.log(`🌐 Webhook URL: ${webhookUrl}/webhook/${token}`)
  console.log(`💚 Health check: ${webhookUrl}/health`)
  console.log(`📊 Stats: ${webhookUrl}/stats`)

  // Настраиваем webhook после запуска сервера
  if (webhookUrl) {
    await setupWebhook()
  } else {
    console.log("⚠️ WEBHOOK_URL не установлен, webhook не настроен")
  }

  console.log("✅ Бот готов к работе через webhook!")
})
