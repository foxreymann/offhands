import { loadEnv } from '../libs/env.js'

loadEnv()

import {
  getSupabase, logAgent, getBusinessState,
  getPendingOrders, updateOrder, updateBusinessState, reconcileRevenue, getWaSession,
  getPublishedProducts,
} from '../lib/supabase.js'
import { orchestrateTick } from '../lib/agents/orchestrator.js'
import { launchCloudAgentTick } from '../lib/cursor-agent.js'
import { formatAgentTickSummary, formatBusinessStatus } from '../libs/logs.js'
import { bigIntToDisplay } from '../libs/bigint.js'
import { sendReply } from '../lib/wassist.js'

const db = {
  getSupabase,
  logAgent,
  getBusinessState,
  updateBusinessState,
  getPendingOrders,
  updateOrder,
  reconcileRevenue,
  async countPendingFulfillment() {
    return (await getPendingOrders()).length
  },
  async countPublishedProducts() {
    const products = await getPublishedProducts()
    return products.length || 1
  },
  async sendWhatsAppReply(phone, content) {
    const session = await getWaSession(phone)
    if (session?.reply_callback) await sendReply(session.reply_callback, content)
  },
}

async function runLocalTick() {
  console.log('🧠 OffHands agent tick starting...')
  const result = await orchestrateTick(db)
  console.log(`✅ ${formatAgentTickSummary(result)}`)
  return result
}

async function runCloudAgent() {
  const apiKey = process.env.CURSOR_API_KEY
  if (!apiKey) {
    console.log('No CURSOR_API_KEY — running local orchestrator.')
    return runLocalTick()
  }

  const state = await getBusinessState()
  const revenue = bigIntToDisplay(state?.total_revenue ?? 0n)

  await logAgent('Prefrontal', 'prefrontal_cortex', 'cloud_agent_start',
    'Launching Cursor Cloud Agent for autonomous business tick')

  const repoUrl = process.env.GITHUB_REPO_URL || 'https://github.com/foxreymann/offhands'
  const prompt = `You are the CEO agent for OffHands — an autonomous AI micro-business selling neuroscience briefings via WhatsApp.

Current state:
- Hands off: ${state?.hands_off}
- Revenue: $${revenue}
- Orders fulfilled: ${state?.orders_fulfilled ?? 0}
- Strategy: ${JSON.stringify(state?.strategy)}

The deterministic orchestrator in lib/agents/orchestrator.js handles:
1. Product creation (Brain Fuel briefings)
2. Order fulfillment via WhatsApp
3. Marketing content
4. PayPal revenue reconciliation

Review agent logs and business metrics. Suggest strategy improvements in your response.
Do NOT modify payment credentials, .env, or security settings.`

  const cloud = await launchCloudAgentTick({
    prompt,
    repoUrl,
    ref: process.env.GITHUB_REF || 'main',
  })

  if (cloud?.agent?.id) {
    await logAgent('Prefrontal', 'prefrontal_cortex', 'cloud_agent_launched',
      `Cloud agent ${cloud.agent.id} — ${cloud.agent.url ?? 'running'}`,
      { agent_id: cloud.agent.id })
  }

  return runLocalTick()
}

async function notifyOwner() {
  const ownerPhone = process.env.OWNER_PHONE
  if (!ownerPhone) return
  const session = await getWaSession(ownerPhone)
  if (!session?.reply_callback) return
  const state = await getBusinessState()
  await sendReply(session.reply_callback, `🤖 *Agent tick complete*\n\n${formatBusinessStatus(state)}`)
}

const mode = process.argv[2] || 'local'

async function main() {
  try {
    if (mode === 'cloud') {
      await runCloudAgent()
    } else {
      await runLocalTick()
    }
    await notifyOwner()
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

main()
