ALTER TABLE customers ADD COLUMN rate_plan_enc TEXT;
ALTER TABLE customers ADD COLUMN service_type TEXT CHECK (service_type IN ('wireless','sim') OR service_type IS NULL);
ALTER TABLE customer_contracts ADD COLUMN rate_plan_enc TEXT;
