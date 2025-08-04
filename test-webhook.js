import dotenv from "dotenv"

dotenv.config()

const token = process.env.TELEGRAM_BOT_TOKEN
const webhookUrl = process.env.WEBHOOK_URL

console.log("🧪 Тестируем webhook настройки...")

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN не найден в .env")
  process.exit(1)
}

if (!webhookUrl) {
  console.error("❌ WEBHOOK_URL не найден в .env")
  process.exit(1)
}

async function testWebhook() {
  try {
    // Проверяем информацию о боте
    console.log("🤖 Проверяем бота...")
    const botResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const botData = await botResponse.json()

    if (botData.ok) {
      console.log(`✅ Бот: @${botData.result.username} (${botData.result.first_name})`)
    } else {
      console.error("❌ Неверный токен бота:", botData.description)
      return
    }

    // Проверяем текущий webhook
    console.log("🔗 Проверяем текущий webhook...")
    const webhookResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const webhookData = await webhookResponse.json()

    if (webhookData.ok) {
      const info = webhookData.result
      console.log("📊 Информация о webhook:")
      console.log(`   URL: ${info.url || "Не установлен"}`)
      console.log(`   Ожидающие обновления: ${info.pending_update_count}`)
      console.log(`   Последняя ошибка: ${info.last_error_message || "Нет"}`)
    }

    // Устанавливаем webhook
    const fullWebhookUrl = `${webhookUrl}/webhook/${token}`
    console.log(`🔧 Устанавливаем webhook: ${fullWebhookUrl}`)

    const setWebhookResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: fullWebhookUrl,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      }),
    })

    const setWebhookData = await setWebhookResponse.json()

    if (setWebhookData.ok) {
      console.log("✅ Webhook установлен успешно!")
    } else {
      console.error("❌ Ошибка установки webhook:", setWebhookData.description)
    }

    // Проверяем webhook еще раз
    console.log("🔍 Финальная проверка...")
    const finalCheck = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const finalData = await finalCheck.json()

    if (finalData.ok) {
      const info = finalData.result
      console.log("📊 Финальная информация:")
      console.log(`   URL: ${info.url}`)
      console.log(`   Ожидающие обновления: ${info.pending_update_count}`)
      console.log(`   Последняя ошибка: ${info.last_error_message || "Нет"}`)

      if (info.url === fullWebhookUrl) {
        console.log("🎉 Webhook настроен правильно!")
      } else {
        console.log("⚠️ URL webhook не совпадает")
      }
    }
  } catch (error) {
    console.error("❌ Ошибка тестирования:", error.message)
  }
}

testWebhook()
