CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wl_shop_customer ON wishlists(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_wl_shop_product ON wishlists(shop_id, product_id);

CREATE TABLE IF NOT EXISTS wishlist_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('added', 'removed', 'purchased')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_shop ON wishlist_events(shop_id, created_at);

CREATE TABLE IF NOT EXISTS product_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  inventory_quantity INT DEFAULT 0,
  captured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_shop_product ON product_snapshots(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_shop_product_date ON product_snapshots(shop_id, product_id, captured_at);