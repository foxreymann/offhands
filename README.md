# OffHands 🧠

**Set it up. Let go. Get paid.**

An autonomous AI micro-business for the [Cursor Hands-Off Hackathon](https://cursor-hands-off-hackathon-06-2026.vercel.app/). Neuroscience-inspired agents sell *Brain Fuel* briefings on WhatsApp, take PayPal payments, and run the company while you don't.

No frontend. No npm dependencies. Pure Node.js.

## Architecture

```
WhatsApp Customer ──► Wassist BYOA ──► /webhook/whatsapp
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
              Shop & Checkout          PayPal Sandbox          Supabase
                    │                      │                      │
                    └──────────► Brain Agents ◄───────────────────┘
                                      │
                    Prefrontal (CEO) · Amygdala (Safety) · Motor Cortex (Fulfillment)
                    Dopamine (Marketing) · Cerebellum (Treasurer) · Hippocampus (Memory)
                                      │
                              Cursor Cloud Agent (optional)
```

## Quick Start

### 1. Supabase

Create a project at [supabase.com](https://supabase.com). Add keys to `.env`, then apply schema:

```bash
node scripts/apply-schema.js
```

Requires `SUPABASE_DB_PASSWORD` from Dashboard → Settings → Database.

### 2. Environment

```bash
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BASE_URL, OWNER_PHONE
```

PayPal sandbox credentials are in `.paypal.csv`.

### 3. Run

```bash
node server.js
```

### 4. WhatsApp (Wassist)

Deploy your server publicly, set `BASE_URL`, then:

```bash
node scripts/setup-wassist.js
```

Or create a **Bring Your Own Agent** at [wassist.app](https://wassist.app) pointing to:

```
https://YOUR_DOMAIN/webhook/whatsapp
```

### 5. Hands Off

Message your WhatsApp bot:

```
HANDS OFF
```

Or set `HANDS_OFF=true` in `.env`. Agents tick every 60s automatically.

## Customer Flow (WhatsApp)

| Command | Action |
|---------|--------|
| `SHOP` | Browse Brain Fuel briefings |
| `BUY 1` | Select product, enter goal, get PayPal link |
| `HELP` | Show commands |

After PayPal payment, the briefing is delivered back on WhatsApp.

## Owner Commands

| Command | Action |
|---------|--------|
| `STATUS` | Revenue, orders, agent focus |
| `HANDS OFF` | Enable autonomous agent loop |

## Cursor Cloud Agent

Schedule autonomous ticks via Cursor Cloud Agent:

```bash
# Local deterministic tick
node agents/run.js

# Launch Cursor Cloud Agent + local tick
node agents/run.js cloud
```

Set `CURSOR_API_KEY` from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations).

### Cron (production)

```bash
curl -X POST https://YOUR_DOMAIN/api/agents/tick \
  -H "Authorization: Bearer $CRON_SECRET"
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service status |
| `POST` | `/webhook/whatsapp` | Wassist BYOA webhook |
| `GET` | `/paypal/return?token=` | PayPal capture + fulfill |
| `POST` | `/api/agents/tick` | Manual agent tick (auth required) |

## Hackathon Pitch

- **Autonomous**: Six brain-region agents strategize, create products, market, fulfill, and reconcile revenue — zero human intervention after `HANDS OFF`.
- **Real money**: PayPal Sandbox checkout with capture webhook.
- **Real customers**: WhatsApp storefront via Wassist — no custom frontend.
- **Cloud-native**: Cursor Cloud Agent for CEO-level reasoning on top of deterministic orchestration.
- **Zero deps**: Entire backend is vanilla Node.js 22+ — fetch, http, fs.

## License

MIT
