-- Stage 3 Schema Expansion for Haiku Messenger (Admin, Moderation, & Lifecycle)

ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS admin_audit_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(64) NOT NULL,
  metric_value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reviewer ON reports(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
