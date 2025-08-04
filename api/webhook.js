import TelegramBot from "node-telegram-bot-api"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

// Инициализация OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Инициализация Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

// Хранилище разговоров (в памяти для быстрого доступа)
const conversations = new Map()
const userSettings = new Map()

// Системные промпты
const systemPrompts = {
  assistant: "Ты полезный ИИ-ассистент. Отвечай кратко и по делу на русском языке.",
  creative: "Ты креативный писатель. Используй яркие образы и метафоры. Отвечай на русском языке.",
  technical: "Ты технический эксперт. Давай точные и подробные объяснения на русском языке.",
  casual: "Ты дружелюбный собеседник. Общайся неформально и с юмором на русском языке.",
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

// Получение настроек пользователя из Supabase
async function getUserSettings(userId) {
  try {
    const { data, error } = await supabase.from("users").select("*").eq("user_id", userId).single()

    if (error && error.code !== "PGRST116") throw error

    return (
      data || {
        ai_provider: "openai",
        system_prompt: "assistant",
        temperature: 0.7,
      }
    )
  } catch (error) {
    console.error("Ошибка получения настроек:", error)
    return {
      ai_provider: "openai",
      system_prompt: "assistant",
      temperature: 0.7,
    }
  }
}

// Обновление настроек пользователя
async function updateUserSettings(userId, settings) {
  try {
    const { data, error } = await supabase
      .from("users")
      .update({
        ai_provider: settings.aiProvider,
        system_prompt: settings.systemPrompt,
        temperature: settings.temperature,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Ошибка обновления настроек:", error)
    return null
  }
}

// Сохранение сообщения в Supabase
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

// Получение истории сообщений из Supabase
async function getMessageHistory(userId, limit = 6) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("message, response")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    // Преобразуем в формат для AI
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

// Получение статистики пользователя
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

// Очистка истории пользователя
async function clearUserHistory(userId) {
  try {
    const { error } = await supabase.from("messages").delete().eq("user_id", userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error("Ошибка очистки истории:", error)
    return false
  }
}

// Инициализация пользователя
async function initUser(userId, userData = null) {
  if (!conversations.has(userId)) {
    conversations.set(userId, [])
  }

  if (!userSettings.has(userId)) {
    const settings = await getUserSettings(userId)
    userSettings.set(userId, {
      aiProvider: settings.ai_provider || "openai",
      systemPrompt: settings.system_prompt || "assistant",
      temperature: settings.temperature || 0.7,
    })

    // Сохраняем пользователя если данные переданы
    if (userData) {
      await saveUser(userId, userData)
    }
  }
}

// Функция для запроса к OpenAI с историей из Supabase
async function askOpenAI(userId, userMessage) {
  try {
    const conversation = conversations.get(userId) || []

    const messages = [
      { role: "system", content: systemPrompts[userSettings.get(userId)?.systemPrompt || "assistant"] },
      ...conversation.slice(-6),
      { role: "user", content: userMessage },
    ]

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: userSettings.get(userId)?.temperature || 0.7,
      max_tokens: 1000,
    })

    const content = response.choices[0].message.content

    conversation.push({ role: "user", content: userMessage })
    conversation.push({ role: "assistant", content: content })
    conversations.set(userId, conversation)

    return { success: true, content }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Функция для запроса к Perplexity с историей из Supabase
async function askPerplexity(userId, userMessage) {
  try {
    const settings = userSettings.get(userId)
    const history = await getMessageHistory(userId, 3)

    const messages = [
      { role: "system", content: systemPrompts[settings.systemPrompt] },
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
        temperature: settings.temperature,
        max_tokens: 1000,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || "Perplexity API error")
    }

    const content = data.choices[0].message.content

    // Сохраняем в Supabase
    await saveMessage(userId, userMessage, content, "perplexity")

    return { success: true, content, usage: data.usage }
  } catch (error) {
    console.error("Perplexity Error:", error)
    return { success: false, error: error.message }
  }
}

// Клавиатуры
function getMainKeyboard() {
  return {
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
  }
}

function getPromptKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🤖 Ассистент", callback_data: "prompt_assistant" },
        { text: "🎨 Креативный", callback_data: "prompt_creative" },
      ],
      [
        { text: "⚙️ Технический", callback_data: "prompt_technical" },
        { text: "😊 Дружелюбный", callback_data: "prompt_casual" },
      ],
      [{ text: "🔙 Назад", callback_data: "back_main" }],
    ],
  }
}

export default async function handler(req, res) {
  // Проверяем метод
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false })
    const upda
