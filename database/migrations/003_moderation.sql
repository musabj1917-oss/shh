BEGIN;
ALTER TABLE haiku_groups ADD COLUMN suspended_at timestamptz;
ALTER TABLE haiku_groups ADD COLUMN suspension_reason varchar(500);
CREATE INDEX haiku_groups_active_idx ON haiku_groups(updated_at DESC) WHERE suspended_at IS NULL;

-- A group suspended by moderation remains inspectable by its members but cannot
-- accept new invitations or publish messages until restored.
ALTER TABLE reports ADD COLUMN admin_notes varchar(2000);
CREATE UNIQUE INDEX admin_one_active_owner_idx ON admin_members(role_name) WHERE role_name='owner' AND revoked_at IS NULL;

COMMIT;
