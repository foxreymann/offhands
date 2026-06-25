import { dollarsToBigInt, bigIntToDisplay } from '../libs/bigint.js'
import {
  formatWelcome, formatProductList, formatBusinessStatus,
  formatPayPalLink, formatDeliverable,
} from '../libs/logs.js'
import {
  getPublishedProducts, getProduct, createOrder, updateOrder,
  getBusinessState, updateBusinessState, getWaSession, upsertWaSession,
  getOrder, logAgent,
} from './supabase.js'
import { createPayPalOrder, capturePayPalOrder, getPayPalApproveUrl, isPayPalConfigured } from './paypal.js'
import { sendReply } from './wassist.js'
import { orchestrateTick } from './agents/orchestrator.js'
import { personalizeDeliverable } from './agents/orchestrator.js'

const OWNER_PHONES = (process.env.OWNER_PHONE || '').split(',').map((p) => p.trim()).filter(Boolean)

function isOwner(phone) {
  return OWNER_PHONES.length === 0 || OWNER_PHONES.includes(phone)
}

function normalizeMessage(text) {
  return (text ?? '').trim()
}

function parseCommand(text) {
  const upper = text.toUpperCase()
  if (upper === 'HELP' || upper === 'HI' || upper === 'HELLO' || upper === 'START') return { cmd: 'help' }
  if (upper === 'SHOP' || upper === 'BROWSE' || upper === 'PRODUCTS') return { cmd: 'shop' }
  if (upper === 'STATUS' || upper === 'STATS') return { cmd: 'status' }
  if (upper === 'HANDS OFF' || upper === 'HANDSOFF' || upper === 'LET GO') return { cmd: 'hands_off' }
  if (upper.startsWith('BUY ')) return { cmd: 'buy', arg: text.slice(4).trim() }
  if (upper.startsWith('GOAL ')) return { cmd: 'goal', arg: text.slice(5).trim() }
  return { cmd: 'unknown', raw: text }
}

export async function handleWhatsAppMessage({ message, phone_number, reply_callback }, db) {
  const text = normalizeMessage(message)
  const session = await getWaSession(phone_number) ?? {
    phone_number,
    state: 'idle',
    reply_callback: null,
  }

  session.reply_callback = reply_callback || session.reply_callback
  await upsertWaSession(session)

  try {
    if (session.state === 'awaiting_goal') {
      return await handleGoalInput(text, session, db)
    }

    const { cmd, arg } = parseCommand(text)

    if (cmd === 'help') return { type: 'message', content: formatWelcome() }
    if (cmd === 'shop') return await handleShop(session)
    if (cmd === 'status') return await handleStatus(phone_number)
    if (cmd === 'hands_off') return await handleHandsOff(phone_number, db)
    if (cmd === 'buy') return await handleBuy(arg, session, phone_number)
    if (cmd === 'goal') return await handleGoalInput(arg, session, db)

    return {
      type: 'message',
      content: `I didn't catch that. ${formatWelcome()}`,
    }
  } catch (err) {
    console.error('WhatsApp handler error:', err.message)
    return { type: 'message', content: 'Something went wrong. Try *SHOP* or *HELP*.' }
  }
}

async function handleShop(session) {
  const products = await getPublishedProducts()
  session.last_products = products.map((p) => p.id)
  session.state = 'idle'
  await upsertWaSession(session)
  return { type: 'message', content: formatProductList(products) }
}

async function handleStatus(phone) {
  if (!isOwner(phone)) {
    return { type: 'message', content: 'Status is for business owners only. Try *SHOP* to browse briefings.' }
  }
  const state = await getBusinessState()
  return { type: 'message', content: formatBusinessStatus(state) }
}

async function handleHandsOff(phone, db) {
  if (!isOwner(phone)) {
    return { type: 'message', content: 'Only the business owner can enable hands-off mode.' }
  }
  await updateBusinessState({ hands_off: true })
  await logAgent('Prefrontal', 'prefrontal_cortex', 'hands_off_enabled',
    '🙌 Hands off! Agents are now running the business autonomously via WhatsApp.')

  const result = await orchestrateTick(db)
  const state = await getBusinessState()
  return {
    type: 'message',
    content: `${formatBusinessStatus(state)}\n\n_Agents just ran their first tick._`,
  }
}

async function handleBuy(arg, session, phone) {
  const products = await getPublishedProducts()
  const index = parseInt(arg, 10) - 1
  if (Number.isNaN(index) || index < 0 || index >= products.length) {
    return { type: 'message', content: `Invalid selection. ${formatProductList(products)}` }
  }

  const product = products[index]
  session.state = 'awaiting_goal'
  session.pending_product_id = product.id
  session.customer_phone = phone
  await upsertWaSession(session)

  return {
    type: 'message',
    content: `Great choice: *${product.title}* ($${bigIntToDisplay(product.price)})\n\nWhat's your goal? (e.g. _better sleep_, _deep focus_, _less stress_)\n\nReply with your goal or *GOAL <your goal>*`,
  }
}

async function handleGoalInput(goalText, session, db) {
  const goal = normalizeMessage(goalText)
  if (!goal) {
    return { type: 'message', content: 'Please tell me your goal so we can personalize your briefing.' }
  }

  const product = await getProduct(session.pending_product_id)
  if (!product) {
    session.state = 'idle'
    await upsertWaSession(session)
    return { type: 'message', content: 'That product is no longer available. Try *SHOP* again.' }
  }

  const order = await createOrder({
    product_id: product.id === 'demo-brain-fuel-1' ? null : product.id,
    customer_email: `${session.customer_phone}@whatsapp.offhands`,
    customer_phone: session.customer_phone,
    customer_goal: goal,
    amount: product.price,
    status: 'pending',
  })

  session.pending_order_id = order.id
  session.customer_goal = goal
  session.state = 'idle'
  await upsertWaSession(session)

  if (!isPayPalConfigured()) {
    await updateOrder(order.id, { status: 'paid' })
    await fulfillAndNotify(order.id, session, db)
    return { type: 'message', content: '🧪 Demo mode — payment skipped. Your briefing is on the way!' }
  }

  const paypalOrder = await createPayPalOrder({
    amount: product.price,
    productTitle: product.title,
    orderId: order.id,
  })

  if (!paypalOrder) {
    return { type: 'message', content: 'Payment system unavailable. Try again shortly.' }
  }

  await updateOrder(order.id, { paypal_order_id: paypalOrder.id })
  const approveUrl = getPayPalApproveUrl(paypalOrder)

  await logAgent('Cerebellum', 'cerebellum', 'checkout_created',
    `PayPal order ${paypalOrder.id} for ${product.title}`, { order_id: order.id })

  return {
    type: 'message',
    content: formatPayPalLink(approveUrl, product.title, bigIntToDisplay(product.price)),
  }
}

export async function fulfillAndNotify(orderId, session, db) {
  const order = await getOrder(orderId)
  if (!order) return

  const product = order.products ?? await getProduct(order.product_id)
  const deliverable = personalizeDeliverable(product, order.customer_goal, order.customer_email)
  await updateOrder(orderId, {
    status: 'fulfilled',
    deliverable,
    fulfilled_at: new Date().toISOString(),
  })

  const state = await getBusinessState()
  await updateBusinessState({ orders_fulfilled: (state?.orders_fulfilled ?? 0) + 1 })

  await logAgent('Motor Cortex', 'motor_cortex', 'order_fulfilled',
    `Delivered to ${order.customer_phone ?? order.customer_email}`, { order_id: orderId })

  const msg = formatDeliverable({ ...order, deliverable }, product)
  const callback = session?.reply_callback
  if (callback) await sendReply(callback, msg)

  if (db) await orchestrateTick(db)
}

export async function handlePayPalReturn(token, db) {
  if (!token) return { success: false, message: 'Missing payment token' }

  const capture = await capturePayPalOrder(token)
  if (!capture) return { success: false, message: 'Payment capture failed' }

  const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id
  const { getOrderByPaypalId } = await import('./supabase.js')
  const paidOrder = await getOrderByPaypalId(token)
  if (!paidOrder) return { success: false, message: 'Order not found' }

  await updateOrder(paidOrder.id, { status: 'paid', paypal_capture_id: captureId })

  await logAgent('Cerebellum', 'cerebellum', 'payment_received',
    `PayPal capture ${captureId}`, { paypal_order_id: token })

  const session = await getWaSession(paidOrder.customer_phone)
  if (session) {
    await fulfillAndNotify(paidOrder.id, session, db)
  } else if (db) {
    await orchestrateTick(db)
  }

  return { success: true, message: 'Payment received! Check WhatsApp for your Brain Fuel briefing.' }
}
