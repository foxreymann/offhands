import { dollarsToBigInt, addAmounts } from '../libs/bigint.js'

let supabaseUrl = null
let supabaseKey = null

function getConfig() {
  if (!supabaseUrl) {
    supabaseUrl = process.env.SUPABASE_URL
    supabaseKey = process.env.SUPABASE_SECRET_KEY
      || process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
  }
  return { url: supabaseUrl, key: supabaseKey }
}

function isNewApiKey(key) {
  return key?.startsWith('sb_publishable_') || key?.startsWith('sb_secret_')
}

export function isSupabaseConfigured() {
  const { url, key } = getConfig()
  return Boolean(url && (key || process.env.SUPABASE_PUBLISHABLE_KEY))
}

async function request(table, { method = 'GET', query = {}, body = null, prefer = 'return=representation' } = {}) {
  const { url, key } = getConfig()
  if (!url || !key) return { data: null, error: 'not_configured' }

  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, v)
  }

  const endpoint = `${url}/rest/v1/${table}${params.size ? `?${params}` : ''}`
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: prefer,
  }
  // New sb_secret / sb_publishable keys must not be sent as Bearer JWTs
  if (!isNewApiKey(key)) {
    headers.Authorization = `Bearer ${key}`
  }

  try {
    const res = await fetch(endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data = null
    if (text) {
      try { data = JSON.parse(text) } catch { data = text }
    }
    if (!res.ok) {
      console.error(`Supabase ${method} ${table}:`, data)
      return { data: null, error: data }
    }
    return { data, error: null }
  } catch (err) {
    console.error(`Supabase request failed:`, err.message)
    return { data: null, error: err.message }
  }
}

function productFromRow(row) {
  if (!row) return null
  return {
    ...row,
    price: dollarsToBigInt(row.price ?? '4.99'),
  }
}

function orderFromRow(row) {
  if (!row) return null
  return {
    ...row,
    amount: dollarsToBigInt(row.amount ?? row.amount_display ?? '0'),
    products: row.products ? productFromRow(row.products) : undefined,
  }
}

export function getSupabase() {
  return isSupabaseConfigured() ? { request } : null
}

export async function logAgent(agent, region, action, detail = null, metadata = {}) {
  const entry = { agent, region, action, detail, metadata, created_at: new Date().toISOString() }
  if (!isSupabaseConfigured()) {
    console.log(`[${agent}] ${action}: ${detail}`)
    return entry
  }
  await request('agent_logs', { method: 'POST', body: entry, prefer: 'return=minimal' })
  return entry
}

export async function getBusinessState() {
  if (!isSupabaseConfigured()) {
    return {
      id: 1,
      hands_off: process.env.HANDS_OFF === 'true',
      total_revenue: 0n,
      orders_fulfilled: 0,
      products_listed: 1,
      strategy: { focus: 'growth', price_multiplier: 1.0 },
    }
  }
  const { data } = await request('business_state', { query: { id: 'eq.1', select: '*' } })
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    ...row,
    total_revenue: dollarsToBigInt(row.total_revenue ?? '0'),
  }
}

export async function updateBusinessState(patch) {
  if (!isSupabaseConfigured()) return
  const dbPatch = { ...patch, updated_at: new Date().toISOString() }
  if (patch.total_revenue !== undefined) {
    const { bigIntToDisplay } = await import('../libs/bigint.js')
    dbPatch.total_revenue = bigIntToDisplay(patch.total_revenue)
  }
  await request('business_state', {
    method: 'PATCH',
    query: { id: 'eq.1' },
    body: dbPatch,
    prefer: 'return=minimal',
  })
}

export async function getPublishedProducts() {
  if (!isSupabaseConfigured()) return getDemoProducts()
  const { data } = await request('products', {
    query: {
      status: 'eq.published',
      select: '*',
      order: 'created_at.desc',
    },
  })
  const rows = data?.length ? data : []
  return rows.length ? rows.map(productFromRow) : getDemoProducts()
}

export async function getProduct(id) {
  if (!isSupabaseConfigured()) {
    return getDemoProducts().find((p) => p.id === id) ?? null
  }
  const { data } = await request('products', { query: { id: `eq.${id}`, select: '*' } })
  const row = Array.isArray(data) ? data[0] : data
  return productFromRow(row)
}

export async function createOrder(order) {
  const { bigIntToDisplay } = await import('../libs/bigint.js')
  const row = {
    ...order,
    amount: bigIntToDisplay(order.amount),
    amount_display: bigIntToDisplay(order.amount),
  }
  if (!isSupabaseConfigured()) return { ...row, id: crypto.randomUUID() }
  const { data } = await request('orders', { method: 'POST', body: row })
  const created = Array.isArray(data) ? data[0] : data
  return orderFromRow(created)
}

export async function updateOrder(id, patch) {
  if (!isSupabaseConfigured()) return
  const dbPatch = { ...patch }
  if (patch.amount !== undefined) {
    const { bigIntToDisplay } = await import('../libs/bigint.js')
    dbPatch.amount = bigIntToDisplay(patch.amount)
    dbPatch.amount_display = dbPatch.amount
  }
  await request('orders', {
    method: 'PATCH',
    query: { id: `eq.${id}` },
    body: dbPatch,
    prefer: 'return=minimal',
  })
}

export async function getOrderByPaypalId(paypalOrderId) {
  if (!isSupabaseConfigured()) return null
  const { data } = await request('orders', { query: { paypal_order_id: `eq.${paypalOrderId}`, select: '*,products(*)' } })
  const row = Array.isArray(data) ? data[0] : data
  return orderFromRow(row)
}

export async function getOrder(id) {
  if (!isSupabaseConfigured()) return null
  const { data } = await request('orders', { query: { id: `eq.${id}`, select: '*,products(*)' } })
  const row = Array.isArray(data) ? data[0] : data
  return orderFromRow(row)
}

export async function getPendingOrders() {
  if (!isSupabaseConfigured()) return []
  const { data } = await request('orders', {
    query: { status: 'eq.paid', select: '*,products(*)', order: 'created_at.asc' },
  })
  return (data ?? []).map(orderFromRow)
}

export async function getRecentLogs(limit = 50) {
  if (!isSupabaseConfigured()) return getDemoLogs()
  const { data } = await request('agent_logs', {
    query: { select: '*', order: 'created_at.desc', limit: String(limit) },
  })
  return data?.length ? data : getDemoLogs()
}

export async function getWaSession(phone) {
  if (!isSupabaseConfigured()) return global.waSessions?.[phone] ?? null
  const { data } = await request('wa_sessions', { query: { phone_number: `eq.${phone}`, select: '*' } })
  return Array.isArray(data) ? data[0] : data
}

export async function upsertWaSession(session) {
  if (!isSupabaseConfigured()) {
    global.waSessions = global.waSessions ?? {}
    global.waSessions[session.phone_number] = session
    return session
  }
  const { data } = await request('wa_sessions', {
    method: 'POST',
    body: { ...session, updated_at: new Date().toISOString() },
    prefer: 'resolution=merge-duplicates,return=representation',
  })
  return Array.isArray(data) ? data[0] : data
}

export async function reconcileRevenue() {
  if (!isSupabaseConfigured()) return 0n
  const { data } = await request('orders', {
    query: { status: 'in.(paid,fulfilled)', select: 'amount' },
  })
  const total = (data ?? []).reduce((sum, o) => addAmounts(sum, dollarsToBigInt(o.amount ?? '0')), 0n)
  return total
}

function getDemoProducts() {
  const price = dollarsToBigInt('4.99')
  return [{
    id: 'demo-brain-fuel-1',
    title: 'Brain Fuel Briefing #1',
    description: 'A neuroscience-backed 5-minute read on focus, dopamine, and sustainable productivity.',
    price,
    category: 'brain-fuel',
    status: 'published',
    content: '# Brain Fuel Briefing #1\n\nYour prefrontal cortex is the CEO of your brain.',
  }]
}

function getDemoLogs() {
  return [{
    id: 'demo-1',
    agent: 'Prefrontal',
    region: 'prefrontal_cortex',
    action: 'system_init',
    detail: 'OffHands online via WhatsApp. Awaiting hands-off activation.',
    created_at: new Date().toISOString(),
  }]
}
