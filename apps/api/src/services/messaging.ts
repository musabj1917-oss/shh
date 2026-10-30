import { query } from '../db.js';
import { isBlocked } from './safety.js';
import { logAuditEvent } from './audit.js';

export async function areFriends(userA: string, userB: string): Promise<boolean> {
  const rows = await query(
    `SELECT id FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [userA, userB]
  );
  return rows.length > 0;
}

export async function sendPrivateMessage(
  senderId: string,
  recipientId: string,
  body?: string,
  mediaId?: string,
  kind: 'text' | 'image' | 'video' | 'audio' = 'text'
) {
  if (await isBlocked(senderId, recipientId)) {
    throw new Error('Messaging unavailable due to block.');
  }

  if (!(await areFriends(senderId, recipientId))) {
    throw new Error('You can only send private messages to accepted friends.');
  }

  // Find or create direct 1-to-1 conversation
  let convRows = await query<{ id: string }>(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_memberships cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
     JOIN conversation_memberships cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
     WHERE c.is_group = FALSE`,
    [senderId, recipientId]
  );

  let conversationId: string;
  if (convRows.length === 0) {
    const newConv = await query<{ id: string }>(
      `INSERT INTO conversations (is_group, creator_id) VALUES (FALSE, $1) RETURNING id`,
      [senderId]
    );
    conversationId = newConv[0].id;

    await query(
      `INSERT INTO conversation_memberships (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [conversationId, senderId, recipientId]
    );
  } else {
    conversationId = convRows[0].id;
  }

  // Set media expiry if media message (10 minutes)
  let expiresAt: string | null = null;
  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  }

  const msgRows = await query<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string | null;
    media_id: string | null;
    kind: string;
    expires_at: string | null;
    created_at: string;
  }>(
    `INSERT INTO messages (conversation_id, sender_id, body, media_id, kind, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, conversation_id, sender_id, body, media_id, kind, expires_at, created_at`,
    [conversationId, senderId, body || null, mediaId || null, kind, expiresAt]
  );

  return msgRows[0];
}

export async function editMessage(senderId: string, messageId: string, newBody: string) {
  const rows = await query<{ sender_id: string; created_at: string; kind: string }>(
    `SELECT sender_id, created_at, kind FROM messages WHERE id = $1 AND deleted_for_everyone = FALSE`,
    [messageId]
  );

  if (rows.length === 0) throw new Error('Message not found.');
  const msg = rows[0];

  if (msg.sender_id !== senderId) {
    throw new Error('You can only edit your own messages.');
  }

  if (msg.kind !== 'text') {
    throw new Error('Only text messages can be edited.');
  }

  const timeDiffMinutes = (Date.now() - new Date(msg.created_at).getTime()) / (1000 * 60);
  if (timeDiffMinutes > 15) {
    throw new Error('Messages can only be edited within 15 minutes of sending.');
  }

  await query(
    `UPDATE messages SET body = $1, edited_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [newBody, messageId]
  );
}

export async function deleteMessage(
  userId: string,
  messageId: string,
  mode: 'self' | 'everyone',
  isAdmin: boolean = false
) {
  const rows = await query<{ sender_id: string }>(
    `SELECT sender_id FROM messages WHERE id = $1`,
    [messageId]
  );

  if (rows.length === 0) return; // Idempotent

  const senderId = rows[0].sender_id;

  if (mode === 'everyone') {
    if (senderId !== userId && !isAdmin) {
      throw new Error('Only the message sender or platform admin can delete a message for everyone.');
    }
    await query(`UPDATE messages SET deleted_for_everyone = TRUE, body = NULL, updated_at = NOW() WHERE id = $1`, [messageId]);
    await logAuditEvent(userId, 'message.deleted_for_everyone', 'message', messageId);
  } else {
    await query(
      `INSERT INTO message_deleted_for_users (message_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [messageId, userId]
    );
  }
}

export async function cleanupExpiredContent() {
  // 10-min media messages cleanup
  const expiredMedia = await query<{ id: string; media_id: string | null }>(
    `SELECT id, media_id FROM messages
     WHERE expires_at IS NOT NULL AND expires_at <= NOW() AND deleted_for_everyone = FALSE`
  );

  for (const msg of expiredMedia) {
    await query(`UPDATE messages SET deleted_for_everyone = TRUE, body = NULL, updated_at = NOW() WHERE id = $1`, [msg.id]);
    if (msg.media_id) {
      await query(`DELETE FROM media_assets WHERE id = $1`, [msg.media_id]);
    }
  }

  // 24-hr stories cleanup
  await query(`DELETE FROM stories WHERE expires_at <= NOW()`);
}
