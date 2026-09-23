CREATE TABLE IF NOT EXISTS consent_intake_actions (
 id TEXT PRIMARY KEY,
 intake_id TEXT NOT NULL REFERENCES consent_intakes(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('channel_withdrawal','notice')),
 target TEXT NOT NULL,
 created_at TEXT NOT NULL,
 actor_enc TEXT NOT NULL,
 method TEXT,
 UNIQUE(intake_id,kind,target)
);
CREATE INDEX IF NOT EXISTS idx_intake_actions_parent ON consent_intake_actions(intake_id);
