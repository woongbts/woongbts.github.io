PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  phone_hmac TEXT NOT NULL UNIQUE,
  name_enc TEXT NOT NULL,
  phone_enc TEXT NOT NULL,
  carrier TEXT CHECK (carrier IN ('SKT','KT','LGU+','알뜰폰','기타') OR carrier IS NULL),
  device_model_enc TEXT,
  opened_on TEXT,
  contract_months INTEGER DEFAULT 24 CHECK (contract_months BETWEEN 0 AND 120),
  customer_status TEXT NOT NULL DEFAULT 'active' CHECK (customer_status IN ('active','inactive','blocked','deleted')),
  source_type TEXT NOT NULL DEFAULT 'excel',
  source_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_opened_on ON customers(opened_on);
CREATE INDEX IF NOT EXISTS idx_customers_carrier ON customers(carrier);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(customer_status);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('marketing_use','ad_sms')),
  status TEXT NOT NULL CHECK (status IN ('granted','revoked','unknown')),
  captured_at TEXT NOT NULL,
  capture_method TEXT NOT NULL CHECK (capture_method IN ('paper','qr','web','phone','imported_record','other')),
  evidence_enc TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_consents_customer ON consents(customer_id);
CREATE INDEX IF NOT EXISTS idx_consents_purpose_status ON consents(purpose,status);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  original_filename_enc TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_enc TEXT NOT NULL,
  filter_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','previewed','sending','completed','cancelled','failed')),
  eligible_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','blocked')),
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
