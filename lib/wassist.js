const WASSIST_API = process.env.WASSIST_API_BASE || 'https://backend.wassist.app/api/v1'

export function isWassistConfigured() {
  return Boolean(process.env.WASSIST_API_KEY)
}

export async function sendReply(replyCallback, content) {
  if (!replyCallback) return false
  try {
    const res = await fetch(replyCallback, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', content }),
    })
    if (!res.ok) {
      console.error('Wassist reply failed:', await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('Wassist reply error:', err.message)
    return false
  }
}

export async function registerByoaWebhook(webhookUrl) {
  const apiKey = process.env.WASSIST_API_KEY
  if (!apiKey) {
    console.error('WASSIST_API_KEY not set')
    return null
  }

  try {
    const res = await fetch(`${WASSIST_API}/agents/byoa/`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ webhookUrl }),
    })
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { data = text }
    if (!res.ok) {
      console.error('BYOA registration failed:', data)
      return null
    }
    return data
  } catch (err) {
    console.error('BYOA registration error:', err.message)
    return null
  }
}

export function wassistResponse(content) {
  return { type: 'message', content }
}
