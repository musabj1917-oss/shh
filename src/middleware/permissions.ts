import { getDb } from '../db.js';
import type { AuthenticatedUser } from '../types.js';

export async function areFriends(userA: string, userB: string) {
  const [low, high] = userA < userB ? [userA, userB] : [userB, userA];
  const rows = await getDb()`SELECT 1 FROM friendships WHERE user_low=${low} AND user_high=${high} LIMIT 1`;
  return rows.length > 0;
}

export async function eitherBlocked(userA: string, userB: string) {
  const rows = await getDb()`SELECT 1 FROM blocks WHERE (blocker_id=${userA} AND blocked_id=${userB}) OR (blocker_id=${userB} AND blocked_id=${userA}) LIMIT 1`;
  return rows.length > 0;
}

export async function canAccessConversation(user: AuthenticatedUser, conversationId: string) {
  const rows = await getDb()`
    SELECT c.kind, c.id
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=${user.id} AND cm.left_at IS NULL
    WHERE c.id=${conversationId}
      AND (c.kind='group' OR NOT EXISTS (
        SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
        WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})
      ))
    LIMIT 1`;
  return rows.length > 0;
}
