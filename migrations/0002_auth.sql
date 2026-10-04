CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES (
  'auth.password',
  '{"algorithm":"PBKDF2-SHA256","iterations":120000,"salt":"IOD0+oXcrSmAX6126ceNxQ==","hash":"1F95YxulX89X0w9b5NZ8QL7+L5k1LfG+BdbZTW4rfG0="}',
  CURRENT_TIMESTAMP
);