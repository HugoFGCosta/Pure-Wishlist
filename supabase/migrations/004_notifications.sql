CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('price_drop', 'back_in_stock')),
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_shop ON notification_log(shop_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON notification_log(shop_id, customer_id, product_id, type, sent_at);