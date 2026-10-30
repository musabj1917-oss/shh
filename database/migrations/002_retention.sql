BEGIN;

-- Ordinary read endpoints must still filter expires_at > now(); cleanup is a
-- retryable backstop, never the authorization boundary for expired content.
CREATE OR REPLACE FUNCTION haiku_clear_expired_text_messages(batch_size integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE changed integer;
BEGIN
  WITH due AS (
    SELECT id FROM messages
    WHERE expires_at IS NOT NULL AND expires_at <= now() AND deleted_at IS NULL
      AND message_type = 'text'
    ORDER BY expires_at ASC
    LIMIT GREATEST(1, LEAST(batch_size, 5000))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE messages m
     SET body = NULL, deleted_at = COALESCE(m.deleted_at, now()), deletion_kind = 'expired'
    FROM due WHERE m.id = due.id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

-- This is an operational marker table so a scheduler can report retries and
-- failures without storing private message bodies or media bytes.
CREATE TABLE cleanup_runs (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  deleted_messages integer NOT NULL DEFAULT 0,
  deleted_objects integer NOT NULL DEFAULT 0,
  deleted_accounts integer NOT NULL DEFAULT 0,
  error_code varchar(80)
);
CREATE INDEX cleanup_runs_recent_idx ON cleanup_runs(started_at DESC);

COMMIT;
