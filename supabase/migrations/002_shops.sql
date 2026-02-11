CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain TEXT UNIQUE NOT NULL,
  access_token TEXT,
  plan TEXT DEFAULT 'free',
  settings JSONB DEFAULT '{"button_color":"#ff0000","button_style":"icon","notify_price_drop":true,"notify_back_in_stock":true}',
  installed_at TIMESTAMPTZ DEFAULT now(),
  uninstalled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
