import { query } from '../db.js';
import { isBlocked } from './safety.js';
import { logAuditEvent } from './audit.js';

export async function createStory(userId: string, mediaId?: string, caption?: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const rows = await query<{ id: string; expires_at: string; created_at: string }>(
    `INSERT INTO stories (user_id, media_id, caption, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, expires_at, created_at`,
    [userId, mediaId || null, caption || null, expiresAt]
  );

  await logAuditEvent(userId, 'story.created', 'story', rows[0].id);
  return rows[0];
}

export async function getStoriesFeed(currentUserId: string) {
  const rows = await query<{
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    username: string | null;
    profile_photo_url: string | null;
    media_id: string | null;
    caption: string | null;
    expires_at: string;
    created_at: string;
  }>(
    `SELECT s.id, s.user_id, u.first_name, u.last_name, u.username, u.profile_photo_url,
            s.media_id, s.caption, s.expires_at, s.created_at
     FROM stories s
     JOIN users u ON s.user_id = u.id
     WHERE s.expires_at > NOW()
       AND u.deleted_at IS NULL
       AND s.user_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION
         SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
     ORDER BY s.created_at DESC`,
    [currentUserId]
  );

  return rows;
}

export async function replyToStory(userId: string, storyId: string, body: string) {
  const storyRows = await query<{ user_id: string; expires_at: string }>(
    `SELECT user_id, expires_at FROM stories WHERE id = $1`,
    [storyId]
  );

  if (storyRows.length === 0 || new Date(storyRows[0].expires_at) <= new Date()) {
    throw new Error('Story not found or has expired.');
  }

  const storyOwner = storyRows[0].user_id;
  if (await isBlocked(userId, storyOwner)) {
    throw new Error('Story reply unavailable due to blocking.');
  }

  const replyRows = await query<{ id: string; created_at: string }>(
    `INSERT INTO story_replies (story_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [storyId, userId, body]
  );

  await logAuditEvent(userId, 'story.reply_sent', 'story_reply', replyRows[0].id);
  return replyRows[0];
}

export async function deleteStory(userId: string, storyId: string) {
  await query(`DELETE FROM stories WHERE id = $1 AND user_id = $2`, [storyId, userId]);
  await logAuditEvent(userId, 'story.deleted', 'story', storyId);
}
