ALTER TABLE customers ADD COLUMN birth_date_enc TEXT;
ALTER TABLE customers ADD COLUMN installment_months INTEGER CHECK (installment_months IS NULL OR installment_months BETWEEN 0 AND 60);
CREATE INDEX IF NOT EXISTS idx_customers_installment_months ON customers(installment_months);
