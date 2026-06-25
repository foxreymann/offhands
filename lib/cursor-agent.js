const CURSOR_API = 'https://api.cursor.com/v1'

export async function launchCloudAgentTick({ prompt, repoUrl, ref = 'main' }) {
  const apiKey = process.env.CURSOR_API_KEY
  if (!apiKey) return { skipped: true, reason: 'no_api_key' }

  const body = {
    prompt: { text: prompt },
    model: { id: 'composer-2.5' },
    repos: [{ url: repoUrl, startingRef: ref }],
    skipReviewerRequest: true,
  }

  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64')
    const res = await fetch(`${CURSOR_API}/agents`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { data = text }
    if (!res.ok) {
      console.error('Cursor cloud agent failed:', data)
      return { error: data }
    }
    return data
  } catch (err) {
    console.error('Cursor cloud agent error:', err.message)
    return { error: err.message }
  }
}

export async function getAgentStatus(agentId) {
  const apiKey = process.env.CURSOR_API_KEY
  if (!apiKey || !agentId) return null

  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64')
    const res = await fetch(`${CURSOR_API}/agents/${agentId}`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch (err) {
    console.error('Cursor agent status error:', err.message)
    return null
  }
}
