-- Migration 009: Add performance indexes for unindexed foreign keys to prevent sequential scans on cascading checks and joins.

CREATE INDEX IF NOT EXISTS admin_members_granted_by_idx ON admin_members(granted_by);
CREATE INDEX IF NOT EXISTS conversations_created_by_idx ON conversations(created_by);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS group_invite_links_created_by_idx ON group_invite_links(created_by);
CREATE INDEX IF NOT EXISTS group_join_requests_invite_id_idx ON group_join_requests(invite_id);
CREATE INDEX IF NOT EXISTS group_members_added_by_idx ON group_members(added_by);
CREATE INDEX IF NOT EXISTS haiku_groups_owner_id_idx ON haiku_groups(owner_id);
CREATE INDEX IF NOT EXISTS messages_attachment_id_idx ON messages(attachment_id);
CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS notifications_actor_id_idx ON notifications(actor_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS reports_evidence_attachment_id_idx ON reports(evidence_attachment_id);
CREATE INDEX IF NOT EXISTS reports_group_id_idx ON reports(group_id);
CREATE INDEX IF NOT EXISTS reports_message_id_idx ON reports(message_id);
CREATE INDEX IF NOT EXISTS reports_reporter_user_id_idx ON reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS reports_reviewed_by_idx ON reports(reviewed_by);
CREATE INDEX IF NOT EXISTS stories_attachment_id_idx ON stories(attachment_id);
CREATE INDEX IF NOT EXISTS story_replies_sender_id_idx ON story_replies(sender_id);
CREATE INDEX IF NOT EXISTS user_locations_active_conversation_id_idx ON user_locations(active_conversation_id);
