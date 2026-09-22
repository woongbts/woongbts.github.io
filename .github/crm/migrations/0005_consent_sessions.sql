CREATE TABLE IF NOT EXISTS consent_forms (
  form_hash TEXT PRIMARY KEY, version TEXT NOT NULL, text_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consent_sessions (
  token_hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  form_hash TEXT NOT NULL REFERENCES consent_forms(form_hash), issued_by_enc TEXT NOT NULL,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_event TEXT, cancelled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_consent_sessions_customer ON consent_sessions(customer_id);
CREATE TABLE IF NOT EXISTS consent_events (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  form_hash TEXT REFERENCES consent_forms(form_hash), token_hash TEXT UNIQUE,
  choices_json TEXT NOT NULL, captured_at TEXT NOT NULL, capture_method TEXT NOT NULL,
  actor_enc TEXT, valid_until TEXT, receipt_id TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_consent_events_customer ON consent_events(customer_id,captured_at);
