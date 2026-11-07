-- Migration 007: Allow location messages to have body without requiring attachment_id

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_payload_check;
ALTER TABLE messages ADD CONSTRAINT messages_payload_check CHECK (
  deleted_at IS NOT NULL OR (
    (message_type IN ('text', 'system', 'location') AND body IS NOT NULL AND length(body) > 0)
    OR
    (message_type IN ('image', 'video', 'voice') AND attachment_id IS NOT NULL)
  )
);
