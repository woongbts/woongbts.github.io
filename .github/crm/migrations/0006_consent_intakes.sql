CREATE TABLE IF NOT EXISTS consent_intakes (id TEXT PRIMARY KEY,payload_enc TEXT NOT NULL,phone_hmac TEXT NOT NULL,form_hash TEXT NOT NULL,form_json TEXT NOT NULL,captured_at TEXT NOT NULL,expires_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,reviewed_at TEXT,reviewed_by_enc TEXT);
CREATE INDEX IF NOT EXISTS idx_consent_intakes_expiry ON consent_intakes(expires_at);
CREATE INDEX IF NOT EXISTS idx_consent_intakes_phone ON consent_intakes(phone_hmac);
