import { bigIntToPayPal } from '../libs/bigint.js'

const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

let cachedToken = null
let tokenExpiry = 0

export function isPayPalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`PayPal auth failed: ${err}`)
    return null
  }

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

export async function createPayPalOrder({ amount, productTitle, orderId }) {
  const token = await getAccessToken()
  if (!token) return null

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const priceStr = typeof amount === 'bigint' ? bigIntToPayPal(amount) : String(amount)

  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        description: productTitle,
        amount: {
          currency_code: 'USD',
          value: priceStr,
        },
      }],
      application_context: {
        brand_name: 'OffHands',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${baseUrl}/paypal/return`,
        cancel_url: `${baseUrl}/paypal/cancel`,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`PayPal create order failed: ${err}`)
    return null
  }

  return res.json()
}

export async function capturePayPalOrder(paypalOrderId) {
  const token = await getAccessToken()
  if (!token) return null

  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`PayPal capture failed: ${err}`)
    return null
  }

  return res.json()
}

export function getPayPalApproveUrl(paypalOrder) {
  const link = paypalOrder?.links?.find((l) => l.rel === 'approve')
  return link?.href ?? null
}

export function getPayPalClientId() {
  return process.env.PAYPAL_CLIENT_ID ?? ''
}
