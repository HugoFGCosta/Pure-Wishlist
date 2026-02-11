CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  state TEXT,
  is_online BOOLEAN DEFAULT false,
  scope TEXT,
  expires TIMESTAMPTZ,
  access_token TEXT,
  user_id BIGINT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  account_owner BOOLEAN DEFAULT false,
  locale TEXT,
  collaborator BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sessions_shop ON sessions(shop);
