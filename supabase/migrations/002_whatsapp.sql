-- OffHands migration 002: WhatsApp sessions + customer phone

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_display TEXT;

CREATE TABLE IF NOT EXISTS wa_sessions (
  phone_number TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'idle',
  pending_product_id UUID,
  pending_order_id UUID,
  customer_goal TEXT,
  customer_phone TEXT,
  reply_callback TEXT,
  last_products JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read wa_sessions" ON wa_sessions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
