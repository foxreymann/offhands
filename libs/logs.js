import { bigIntToDisplay } from './bigint.js'

export function formatProductList(products) {
  if (!products?.length) {
    return '🧠 *OffHands Brain Fuel*\n\nNo briefings in stock yet. Our agents are cooking — check back soon!'
  }
  const lines = products.map((p, i) => {
    const price = bigIntToDisplay(typeof p.price === 'bigint' ? p.price : BigInt(p.price_amount ?? 0))
    return `*${i + 1}.* ${p.title}\n   _${p.description}_\n   💵 $${price}`
  })
  return `🧠 *OffHands Brain Fuel Shop*\n\nNeuroscience briefings that actually change behavior.\n\n${lines.join('\n\n')}\n\nReply *BUY <number>* to purchase.`
}

export function formatBusinessStatus(state) {
  const revenue = bigIntToDisplay(state?.total_revenue ?? 0n)
  const handsOff = state?.hands_off ? '🙌 HANDS OFF — agents running' : '✋ Manual mode'
  return `📊 *OffHands Status*\n\n${handsOff}\n💰 Revenue: $${revenue}\n📦 Products: ${state?.products_listed ?? 0}\n✅ Fulfilled: ${state?.orders_fulfilled ?? 0}\n🎯 Focus: ${state?.strategy?.focus ?? 'growth'}`
}

export function formatDeliverable(order, product) {
  const title = product?.title ?? 'Brain Fuel Briefing'
  return `✅ *Delivered: ${title}*\n\n${order.deliverable ?? product?.content ?? 'Your briefing is ready.'}\n\n_— OffHands Motor Cortex Agent_`
}

export function formatPayPalLink(approveUrl, productTitle, priceDisplay) {
  return `💳 *Checkout: ${productTitle}*\n\nAmount: *$${priceDisplay}*\n\nPay securely with PayPal:\n${approveUrl}\n\nAfter payment you'll receive your briefing here on WhatsApp.`
}

export function formatWelcome() {
  return `🧠 *Welcome to OffHands*\n\nWe sell neuroscience briefings while AI agents run the business.\n\n*Commands:*\n• *SHOP* — browse Brain Fuel briefings\n• *BUY <number>* — purchase from the shop\n• *STATUS* — business stats (owners)\n• *HANDS OFF* — let agents take over (owners)\n• *HELP* — this message\n\n_Set it up. Let go. Get paid._`
}

export function formatAgentTickSummary(results) {
  if (results?.skipped) return 'Agents on standby — hands-off is OFF.'
  const parts = []
  if (results?.strategy?.focus) parts.push(`Focus: ${results.strategy.focus}`)
  if (results?.product?.title) parts.push(`Created: ${results.product.title}`)
  if (results?.fulfilled) parts.push(`Fulfilled: ${results.fulfilled} orders`)
  if (results?.marketing) parts.push('Marketing post scheduled')
  return parts.length ? parts.join(' · ') : 'Tick complete'
}
