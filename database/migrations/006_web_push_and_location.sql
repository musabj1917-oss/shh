-- Migration 006: Support Web Push in device_push_tokens, live user location tracking, and location messages.

-- 1. Extend device_push_tokens platform check constraint to support 'web'
ALTER TABLE device_push_tokens DROP CONSTRAINT IF EXISTS device_push_tokens_platform_check;
ALTER TABLE device_push_tokens ADD CONSTRAINT device_push_tokens_platform_check CHECK (platform IN ('android', 'ios', 'web'));

-- 2. User live location tracking (ephemeral, opt-in with expiration)
CREATE TABLE IF NOT EXISTS user_locations (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  speed double precision,
  sharing_mode text NOT NULL DEFAULT 'off' CHECK (sharing_mode IN ('off', 'friends', 'live_chat')),
  active_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_locations_sharing_idx ON user_locations(sharing_mode, expires_at);

-- 3. Extend messages message_type to allow 'location'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image', 'video', 'voice', 'system', 'location'));
