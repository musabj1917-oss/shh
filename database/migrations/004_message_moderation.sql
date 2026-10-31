BEGIN;

-- Moderators may remove inappropriate messages. The removal is a tombstone:
-- text and attachment references are cleared immediately and the event is
-- written to the administrative audit trail. Expired/deleted content remains
-- unrecoverable through the console.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_deletion_kind_check;
ALTER TABLE messages ADD CONSTRAINT messages_deletion_kind_check
  CHECK (deletion_kind IN ('sender','expired','account','moderator'));

UPDATE admin_roles
   SET permissions = permissions || '{"messages.moderate":true}'::jsonb
 WHERE role_name IN ('owner','moderator');

COMMIT;
