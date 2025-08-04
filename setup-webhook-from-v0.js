// Этот код можно запустить прямо в v0 для настройки webhook

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = "https://your-vercel-app.vercel.app" // Замените на ваш URL

async function setupWebhook() {
  try {
    console.log("🔗 Настраиваем webhook из v0...")

    const webhookUrl = `${WEBHOOK_URL}/api/webhook/${TELEGRAM_BOT_TOKEN}`

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    })

    const result = await response.json()

    if (result.ok) {
      console.log("✅ Webhook установлен!")
      console.log(`🌐 URL: ${webhookUrl}`)
    } else {
      console.error("❌ Ошибка:", result.description)
    }

    return result
  } catch (error) {
    console.error("❌ Ошибка настройки:", error)
  }
}

// Запускаем настройку
setupWebhook()
