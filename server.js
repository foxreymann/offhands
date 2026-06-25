import { loadEnv } from './libs/env.js'

loadEnv()

import { createServer } from 'node:http'
import {
  getSupabase, logAgent, getBusinessState, updateBusinessState,
  getPendingOrders, updateOrder, getRecentLogs, isSupabaseConfigured,
  reconcileRevenue, getWaSession, getPublishedProducts,
} from './lib/supabase.js'
import { isPayPalConfigured } from './lib/paypal.js'
import { orchestrateTick } from './lib/agents/orchestrator.js'
import { handleWhatsAppMessage, handlePayPalReturn } from './lib/whatsapp-bot.js'
import { sendReply } from './lib/wassist.js'
import { formatAgentTickSummary } from './libs/logs.js'

global.waSessions = global.waSessions ?? {}
global.pairs = global.pairs ?? {}

const PORT = process.env.PORT || 3000

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
    return products.length
  },
  async sendWhatsAppReply(phone, content) {
    const session = await getWaSession(phone)
    if (session?.reply_callback) await sendReply(session.reply_callback, content)
  },
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString()
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return raw }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function text(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

async function handleApi(req, res, pathname, url) {
  const method = req.method

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return
  }

  if (pathname === '/health' && method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'offhands',
      paypal: isPayPalConfigured(),
      supabase: isSupabaseConfigured(),
      hands_off: (await getBusinessState())?.hands_off ?? false,
    })
  }

  if (pathname === '/webhook/whatsapp' && method === 'POST') {
    const body = await readBody(req)
    const response = await handleWhatsAppMessage(body, db)
    return json(res, 200, response)
  }

  if (pathname === '/paypal/return' && method === 'GET') {
    const token = url.searchParams.get('token')
    const result = await handlePayPalReturn(token, db)
    return text(res, 200, result.success
      ? `✅ ${result.message}\n\nYou can close this tab and return to WhatsApp.`
      : `❌ ${result.message}`)
  }

  if (pathname === '/paypal/cancel' && method === 'GET') {
    return text(res, 200, 'Payment cancelled. Return to WhatsApp and try again with SHOP.')
  }

  if (pathname === '/api/state' && method === 'GET') {
    const state = await getBusinessState()
    return json(res, 200, {
      ...state,
      total_revenue: state?.total_revenue?.toString?.() ?? '0',
    })
  }

  if (pathname === '/api/state' && method === 'PATCH') {
    const body = await readBody(req)
    await updateBusinessState(body)
    if (body?.hands_off === true) {
      await logAgent('Prefrontal', 'prefrontal_cortex', 'hands_off_enabled',
        '🙌 Hands off! Agents running autonomously.')
    }
    const state = await getBusinessState()
    return json(res, 200, {
      ...state,
      total_revenue: state?.total_revenue?.toString?.() ?? '0',
    })
  }

  if (pathname === '/api/logs' && method === 'GET') {
    return json(res, 200, await getRecentLogs(100))
  }

  if (pathname === '/api/agents/tick' && (method === 'POST' || method === 'GET')) {
    const auth = req.headers.authorization
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && auth !== `Bearer ${cronSecret}`) {
      return json(res, 401, { error: 'Unauthorized' })
    }
    const result = await orchestrateTick(db)
    return json(res, 200, result)
  }

  json(res, 404, { error: 'Not found' })
}

const server = createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`
  const url = new URL(req.url, `http://${host}`)
  try {
    await handleApi(req, res, url.pathname, url)
  } catch (err) {
    console.error(err)
    json(res, 500, { error: err.message })
  }
})

async function backgroundTick() {
  try {
    const state = await getBusinessState()
    if (state?.hands_off) {
      const result = await orchestrateTick(db)
      console.log(`🧠 Agent tick: ${formatAgentTickSummary(result)}`)
    }
  } catch (err) {
    console.error('Background tick error:', err.message)
  }
}

async function bootstrap() {
  if (process.env.HANDS_OFF === 'true') {
    await updateBusinessState({ hands_off: true })
    await logAgent('Prefrontal', 'prefrontal_cortex', 'auto_hands_off',
      'HANDS_OFF=true — autonomous mode enabled on boot.')
  }

  server.listen(PORT, () => {
    console.log(`\n🧠 OffHands — autonomous neuroscience business`)
    console.log(`   WhatsApp webhook: POST /webhook/whatsapp`)
    console.log(`   PayPal: ${isPayPalConfigured() ? '✓ sandbox' : '✗ not configured'}`)
    console.log(`   Supabase: ${isSupabaseConfigured() ? '✓ connected' : '✗ in-memory demo'}`)
    console.log(`   Port: ${PORT}\n`)

    if (!process.env.VERCEL) {
      const interval = parseInt(process.env.AGENT_TICK_INTERVAL_MS || '60000', 10)
      setInterval(backgroundTick, interval)
    }
    backgroundTick()
  })
}

bootstrap()
