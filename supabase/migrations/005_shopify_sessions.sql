-- Table for Shopify session storage (camelCase columns to match Shopify SDK)
CREATE TABLE IF NOT EXISTS shopify_sessions (
  "id" VARCHAR(255) NOT NULL PRIMARY KEY,
  "shop" VARCHAR(255) NOT NULL,
  "state" VARCHAR(255) NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "scope" VARCHAR(255),
  "expires" INTEGER,
  "onlineAccessInfo" VARCHAR(255),
  "accessToken" VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop ON shopify_sessions("shop");
