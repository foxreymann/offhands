import { loadEnv } from '../libs/env.js'

loadEnv()

import { registerByoaWebhook } from '../lib/wassist.js'

const baseUrl = process.env.BASE_URL
if (!baseUrl) {
  console.error('Set BASE_URL to your deployed server URL (e.g. https://your-app.vercel.app)')
  process.exit(1)
}

const webhookUrl = `${baseUrl.replace(/\/$/, '')}/webhook/whatsapp`
console.log(`Registering BYOA webhook: ${webhookUrl}`)

const agent = await registerByoaWebhook(webhookUrl)
if (agent) {
  console.log('✓ Wassist BYOA agent created')
  console.log(JSON.stringify(agent, null, 2))
  if (agent.connectUrl) console.log(`\nTest: ${agent.connectUrl}`)
} else {
  console.log('Registration failed — create BYOA agent manually at https://wassist.app')
  console.log(`Webhook URL: ${webhookUrl}`)
}
