PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customer_contracts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  opened_on TEXT,
  carrier TEXT CHECK (carrier IN ('SKT','KT','LGU+','알뜰폰','기타') OR carrier IS NULL),
  device_model_enc TEXT,
  installment_months INTEGER CHECK (installment_months IS NULL OR installment_months BETWEEN 0 AND 60),
  contract_hmac TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'excel',
  source_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_contracts_customer ON customer_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_opened_on ON customer_contracts(opened_on);
