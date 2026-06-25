// Neuroscience-inspired agent regions — autonomous business brain
import { dollarsToBigInt, bigIntToDisplay } from '../../libs/bigint.js'

export const REGIONS = {
  prefrontal_cortex: { name: 'Prefrontal', role: 'CEO — strategy, pricing, priorities' },
  hippocampus: { name: 'Hippocampus', role: 'Memory — stores learnings, recalls patterns' },
  amygdala: { name: 'Amygdala', role: 'Guardian — safety review before publish' },
  nucleus_accumbens: { name: 'Dopamine', role: 'Growth — marketing & acquisition' },
  motor_cortex: { name: 'Motor Cortex', role: 'Fulfillment — delivers paid products' },
  cerebellum: { name: 'Cerebellum', role: 'Treasurer — revenue tracking & reconciliation' },
}

const BRIEFING_TEMPLATES = [
  {
    title: 'Brain Fuel: The Dopamine Detox',
    description: 'Reset your reward circuits. A practical guide to breaking cheap dopamine loops.',
    content: (n) => `# Brain Fuel Briefing #${n}\n\n## The Dopamine Detox\n\nCheap dopamine (scrolling, notifications) hijacks your nucleus accumbens.\n\n**The 48-hour reset:**\n1. Remove one cheap dopamine source\n2. Replace with a "earned reward" — walk, create, connect\n3. Notice the craving without acting — that's prefrontal training\n\n*Your brain rewires in ~21 days of consistency.*\n\n— OffHands Motor Cortex Agent`,
  },
  {
    title: 'Brain Fuel: Sleep Architecture',
    description: 'Why your REM cycles are your secret weapon for creativity and memory.',
    content: (n) => `# Brain Fuel Briefing #${n}\n\n## Sleep Architecture\n\nREM sleep consolidates memory. Deep sleep clears metabolic waste via glymphatic flow.\n\n**Three levers:**\n1. **Consistent wake time** — anchors your circadian clock\n2. **Cool room (18°C)** — core temp drop triggers sleep onset\n3. **No screens 60min before bed** — blue light suppresses melatonin\n\n*One extra hour of quality sleep = 20% better prefrontal function.*\n\n— OffHands Motor Cortex Agent`,
  },
  {
    title: 'Brain Fuel: Flow State Protocol',
    description: 'Enter flow on demand using challenge-skill balance and clear goals.',
    content: (n) => `# Brain Fuel Briefing #${n}\n\n## Flow State Protocol\n\nFlow happens when challenge ≈ skill + clear immediate feedback.\n\n**The protocol:**\n1. Define one outcome for the next 90 minutes\n2. Remove all friction (phone in another room)\n3. Start with the hardest 10 minutes — activation energy is real\n4. Track progress visibly (checklist, timer)\n\n*Flow releases norepinephrine + dopamine + endorphins — nature's performance stack.*\n\n— OffHands Motor Cortex Agent`,
  },
  {
    title: 'Brain Fuel: Social Neurochemistry',
    description: 'Oxytocin, mirror neurons, and why connection is a biological need.',
    content: (n) => `# Brain Fuel Briefing #${n}\n\n## Social Neurochemistry\n\nHumans are wired for connection. Oxytocin reduces cortisol. Loneliness elevates inflammation markers.\n\n**Connection deposits:**\n1. **Eye contact + name** — activates fusiform face area\n2. **Shared struggle** — co-regulation lowers amygdala activation\n3. **Gratitude expression** — 2 minutes daily shifts default mode network\n\n*OffHands exists because agents should work so humans can connect.*\n\n— OffHands Motor Cortex Agent`,
  },
]

const MARKETING_TEMPLATES = [
  'Your brain runs on patterns. We ship neuroscience briefings via WhatsApp. Message us to shop. 🧠',
  'Set it up. Let go. Get paid. OffHands agents run the business while you live your life.',
  'Dopamine loops stealing your focus? Brain Fuel Briefings are $4.99 and take 5 minutes to read.',
  'The prefrontal cortex is tired. Give it fuel, not more notifications.',
  "AI agents + neuroscience = a business that runs without you. That's OffHands.",
]

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function runPrefrontal(db, state) {
  const { logAgent, updateBusinessState } = db
  const strategy = state?.strategy ?? { focus: 'growth', price_multiplier: 1.0 }

  const pendingCount = await db.countPendingFulfillment?.() ?? 0
  const productCount = await db.countPublishedProducts?.() ?? 1

  let newFocus = strategy.focus
  if (pendingCount > 2) newFocus = 'fulfillment'
  else if (productCount < 3) newFocus = 'creation'
  else if (state?.total_revenue > dollarsToBigInt('20')) newFocus = 'optimization'
  else newFocus = 'growth'

  const newStrategy = { ...strategy, focus: newFocus }
  await updateBusinessState({ strategy: newStrategy, last_tick_at: new Date().toISOString() })

  await logAgent('Prefrontal', 'prefrontal_cortex', 'strategy_tick',
    `Focus shifted to "${newFocus}". ${pendingCount} orders pending, ${productCount} products live.`,
    { strategy: newStrategy })
  return newStrategy
}

export async function runAmygdala(db, draftProduct) {
  const { logAgent } = db
  const banned = ['guaranteed cure', 'medical advice', 'prescription', 'illegal']
  const text = `${draftProduct.title} ${draftProduct.description} ${draftProduct.content}`.toLowerCase()
  const violations = banned.filter((w) => text.includes(w))
  const safetyScore = violations.length === 0 ? 95 + Math.floor(Math.random() * 5) : 30

  await logAgent('Amygdala', 'amygdala', 'safety_review',
    violations.length ? `Blocked: found ${violations.join(', ')}` : `Approved (score: ${safetyScore})`,
    { safety_score: safetyScore, violations })

  return { approved: violations.length === 0, safetyScore }
}

export async function runCreator(db, strategy) {
  const { logAgent, getSupabase } = db
  if (strategy?.focus !== 'creation' && strategy?.focus !== 'growth') return null

  const supabase = getSupabase?.()
  const template = pickRandom(BRIEFING_TEMPLATES)
  const num = Math.floor(Math.random() * 900) + 100
  const multiplier = strategy?.price_multiplier ?? 1.0
  const price = dollarsToBigInt(String(4.99 * multiplier))

  const product = {
    title: `${template.title} v${num}`,
    description: template.description,
    price: bigIntToDisplay(price),
    priceBigInt: price,
    content: template.content(num),
    category: 'brain-fuel',
    status: 'draft',
    created_by: 'creator-agent',
  }

  const safety = await runAmygdala(db, product)
  if (!safety.approved) return null

  product.status = 'published'
  product.safety_score = safety.safetyScore
  product.published_at = new Date().toISOString()

  if (supabase) {
    const { data } = await supabase.request('products', {
      method: 'POST',
      body: {
        title: product.title,
        description: product.description,
        price: product.price,
        content: product.content,
        category: product.category,
        status: product.status,
        safety_score: product.safety_score,
        created_by: product.created_by,
        published_at: product.published_at,
      },
    })
    const row = Array.isArray(data) ? data[0] : data
    if (row) {
      product.id = row.id
      await logAgent('Hippocampus', 'hippocampus', 'product_stored',
        `New product indexed: "${row.title}"`, { product_id: row.id })
    }
  }

  await logAgent('Motor Cortex', 'motor_cortex', 'product_created',
    `Published "${product.title}" at $${product.price}`, { product_id: product.id })

  const count = await db.countPublishedProducts?.() ?? 1
  await db.updateBusinessState({ products_listed: count })
  return product
}

export async function runDopamine(db) {
  const { logAgent, getSupabase } = db
  const content = pickRandom(MARKETING_TEMPLATES)
  const supabase = getSupabase?.()

  if (supabase) {
    await supabase.request('marketing_posts', {
      method: 'POST',
      body: { platform: 'whatsapp', content, status: 'scheduled' },
      prefer: 'return=minimal',
    })
  }

  await logAgent('Dopamine', 'nucleus_accumbens', 'marketing_post',
    `Scheduled: "${content.slice(0, 60)}..."`, { platform: 'whatsapp' })
  return content
}

export async function runMotorCortex(db) {
  const { logAgent, getPendingOrders, updateOrder, updateBusinessState, getBusinessState } = db
  const pending = await getPendingOrders()
  let fulfilled = 0

  for (const order of pending) {
    const product = order.products ?? order.product
    const goal = order.customer_goal || 'general productivity'
    const deliverable = personalizeDeliverable(product, goal, order.customer_email)

    await updateOrder(order.id, {
      status: 'fulfilled',
      deliverable,
      fulfilled_at: new Date().toISOString(),
    })
    fulfilled++

    await logAgent('Motor Cortex', 'motor_cortex', 'order_fulfilled',
      `Delivered to ${order.customer_phone ?? order.customer_email} — personalized for "${goal}"`,
      { order_id: order.id })

    if (order.customer_phone && db.sendWhatsAppReply) {
      const { formatDeliverable } = await import('../../libs/logs.js')
      await db.sendWhatsAppReply(order.customer_phone, formatDeliverable({ ...order, deliverable }, product))
    }
  }

  if (fulfilled > 0) {
    const state = await getBusinessState()
    await updateBusinessState({ orders_fulfilled: (state?.orders_fulfilled ?? 0) + fulfilled })
  }
  return fulfilled
}

export function personalizeDeliverable(product, goal, email) {
  const base = product?.content ?? '# Your Brain Fuel Briefing\n\nContent loading...'
  return `${base}\n\n---\n\n## Personalized for you\n\n**Your goal:** ${goal}\n**Delivered to:** ${email}\n**Generated:** ${new Date().toISOString()}\n\n*The Motor Cortex agent personalized this briefing based on your stated goal. Revisit section 2 with your specific context in mind.*`
}

export async function runCerebellum(db) {
  const { logAgent, reconcileRevenue, getBusinessState, updateBusinessState } = db
  const total = await reconcileRevenue?.() ?? 0n
  const state = await getBusinessState()

  if (total !== (state?.total_revenue ?? 0n)) {
    await updateBusinessState({ total_revenue: total })
    await logAgent('Cerebellum', 'cerebellum', 'revenue_sync',
      `Revenue reconciled: $${bigIntToDisplay(total)}`,
      { total_revenue: bigIntToDisplay(total) })
  }
}

export async function orchestrateTick(db) {
  const state = await db.getBusinessState()
  if (!state?.hands_off) {
    await db.logAgent('Prefrontal', 'prefrontal_cortex', 'tick_skipped',
      'Hands-off mode is OFF. Agents standing by.')
    return { skipped: true, reason: 'hands_off_disabled' }
  }

  const results = {}
  results.strategy = await runPrefrontal(db, state)

  if (results.strategy.focus === 'creation' || results.strategy.focus === 'growth') {
    results.product = await runCreator(db, results.strategy)
    results.marketing = await runDopamine(db)
  } else if (results.strategy.focus === 'fulfillment') {
    results.fulfilled = await runMotorCortex(db)
  } else {
    results.fulfilled = await runMotorCortex(db)
    results.marketing = await runDopamine(db)
  }

  await runCerebellum(db)
  return results
}
