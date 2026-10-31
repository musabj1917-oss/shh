import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { sendMessageSchema } from '../contracts.js';
import { getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rate-limit.js';
import { createRealtimeTokenRequest, publishMessageCreated } from '../services/realtime.js';
import { createNotification } from '../services/notifications.js';
import type { ApiEnv } from '../types.js';

export const conversationRoutes = new Hono<ApiEnv>();
conversationRoutes.use('*', requireUser);

function orderedPair(a: string, b: string) { return a < b ? [a,b] : [b,a]; }
function validUuid(value: string) { return /^[0-9a-f-]{36}$/i.test(value); }

conversationRoutes.get('/', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`SELECT c.id,c.kind,c.created_at,
      CASE WHEN c.kind='group' THEN g.name ELSE (SELECT p.display_name FROM conversation_members other JOIN user_profiles p ON p.user_id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL LIMIT 1) END AS title,
      CASE WHEN c.kind='group' THEN g.photo_object_key ELSE (SELECT p.avatar_object_key FROM conversation_members other JOIN user_profiles p ON p.user_id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL LIMIT 1) END AS avatar_object_key,
      lm.id AS last_message_id,lm.body AS last_message_text,lm.message_type AS last_message_type,lm.created_at AS last_message_at,
      (SELECT count(*)::int FROM message_receipts mr JOIN messages m ON m.id=mr.message_id
        WHERE mr.user_id=${user.id} AND mr.read_at IS NULL AND m.conversation_id=c.id AND m.sender_id<>${user.id}
          AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())) AS unread_count,
      (SELECT count(*)::int FROM conversation_members m WHERE m.conversation_id=c.id AND m.left_at IS NULL) AS member_count
    FROM conversations c
    JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=${user.id} AND mine.left_at IS NULL
    LEFT JOIN haiku_groups g ON g.conversation_id=c.id
    LEFT JOIN LATERAL (SELECT m.id,m.body,m.message_type,m.created_at FROM messages m
      WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
        AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id=m.id AND h.user_id=${user.id})
      ORDER BY m.created_at DESC,m.id DESC LIMIT 1) lm ON true
    WHERE (c.kind='group' AND g.suspended_at IS NULL) OR (
      EXISTS (SELECT 1 FROM friendships f JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
        WHERE f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id))
      AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
        WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id}))
    ) ORDER BY COALESCE(lm.created_at,c.created_at) DESC LIMIT 100`;
  return c.json({ conversations: rows });
});

conversationRoutes.post('/direct/:otherUserId', async (c) => {
  const user = c.get('user');
  const otherId = c.req.param('otherUserId');
  if (!validUuid(otherId) || otherId === user.id) return jsonError(c, 422, 'USER_INVALID', 'Choose another user.');
  const [low,high] = orderedPair(user.id, otherId);
  const permissions = await getDb()`SELECT 1 FROM friendships f
    JOIN users a ON a.id=${user.id} AND a.status='active' AND a.deleted_at IS NULL
    JOIN users b ON b.id=${otherId} AND b.status='active' AND b.email_verified_at IS NOT NULL AND b.deleted_at IS NULL
    WHERE f.user_low=${low} AND f.user_high=${high}
      AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id=${user.id} AND blocked_id=${otherId}) OR (blocker_id=${otherId} AND blocked_id=${user.id})) LIMIT 1`;
  if (!permissions.length) return jsonError(c, 403, 'FRIENDSHIP_REQUIRED', 'Private conversations are available after the friend request is accepted.');
  const key = `${low}:${high}`;
  const conversationId = randomUUID();
  await getDb().transaction([
    getDb()`INSERT INTO conversations(id,kind,direct_key,created_by) VALUES (${conversationId},'direct',${key},${user.id}) ON CONFLICT(direct_key) DO NOTHING`,
    getDb()`INSERT INTO conversation_members(conversation_id,user_id) SELECT id,${user.id} FROM conversations WHERE direct_key=${key} ON CONFLICT DO NOTHING`,
    getDb()`INSERT INTO conversation_members(conversation_id,user_id) SELECT id,${otherId} FROM conversations WHERE direct_key=${key} ON CONFLICT DO NOTHING`,
  ]);
  const rows = await getDb()`SELECT id FROM conversations WHERE direct_key=${key} LIMIT 1`;
  if (!rows.length) return jsonError(c, 503, 'CONVERSATION_CREATE_FAILED', 'The conversation could not be created.');
  return c.json({ conversationId: String((rows[0] as {id:string}).id), kind: 'direct' }, 201);
});

conversationRoutes.get('/:conversationId/messages', async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('conversationId');
  if (!validUuid(conversationId)) return jsonError(c, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  const access = await getDb()`SELECT c.kind FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE c.id=${conversationId} AND cm.user_id=${user.id} AND cm.left_at IS NULL
      AND ((c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)) OR (
        EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id)
          WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
          WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id}))
      )) LIMIT 1`;
  if (!access.length) return jsonError(c, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  await getDb()`UPDATE message_receipts mr SET delivered_at=COALESCE(mr.delivered_at,now()) FROM messages m
    WHERE mr.message_id=m.id AND mr.user_id=${user.id} AND mr.delivered_at IS NULL AND m.conversation_id=${conversationId}
      AND m.sender_id<>${user.id} AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())`;
  const limit = Math.max(1, Math.min(100, Number.parseInt(c.req.query('limit') || '40', 10) || 40));
  const before = c.req.query('before');
  if (before && Number.isNaN(Date.parse(before))) return jsonError(c, 422, 'CURSOR_INVALID', 'Message cursor is invalid.');
  const cursor = before ? new Date(before).toISOString() : null;
  const read = await getDb()`SELECT m.id,m.sender_id,m.message_type,m.body,m.attachment_id,m.reply_to_id,m.created_at,m.edited_at,
      CASE WHEN m.sender_id=${user.id} THEN (SELECT CASE
        WHEN count(*) FILTER(WHERE COALESCE(s.read_receipts_enabled,true))>0 AND bool_and(mr.read_at IS NOT NULL) FILTER(WHERE COALESCE(s.read_receipts_enabled,true)) THEN 'read'
        WHEN count(*)>0 AND bool_and(mr.delivered_at IS NOT NULL) THEN 'delivered' ELSE 'sent' END
        FROM message_receipts mr LEFT JOIN user_settings s ON s.user_id=mr.user_id WHERE mr.message_id=m.id) ELSE NULL END AS receipt_status,
      (SELECT jsonb_build_object('username',p.username,'displayName',p.display_name) FROM user_profiles p WHERE p.user_id=m.sender_id) AS sender
    FROM messages m
    WHERE m.conversation_id=${conversationId} AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
      AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id=m.id AND h.user_id=${user.id})
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=m.sender_id) OR (b.blocker_id=m.sender_id AND b.blocked_id=${user.id}))
      AND (${cursor}::timestamptz IS NULL OR m.created_at<${cursor}::timestamptz)
    ORDER BY m.created_at DESC,m.id DESC LIMIT ${limit}`;
  return c.json({ messages: read.reverse(), hasMore: read.length === limit });
});

conversationRoutes.post('/:conversationId/messages', async (c) => {
  const limited = await enforceRateLimit(c, 'send-message', 120, 60); if (limited) return limited;
  const user = c.get('user');
  const conversationId = c.req.param('conversationId');
  if (!validUuid(conversationId)) return jsonError(c, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  const parsed = await parseJson(c, sendMessageSchema); if ('response' in parsed) return parsed.response;
  const input = parsed.data;
  let attachment: {id:string;media_type:string;purpose:string;status:string;owner_id:string;expires_at:Date|string|null} | undefined;
  if (input.attachmentId) {
    const rows = await getDb()`SELECT id,media_type,purpose,status,owner_id,expires_at FROM attachments WHERE id=${input.attachmentId} LIMIT 1`;
    attachment = rows[0] as typeof attachment;
    if (!attachment || attachment.owner_id !== user.id || attachment.status !== 'ready' || attachment.purpose !== 'message' || (attachment.expires_at && new Date(attachment.expires_at).getTime() <= Date.now())) {
      return jsonError(c, 422, 'ATTACHMENT_INVALID', 'This attachment is not available. Upload it again.');
    }
  }
  const messageType = attachment ? attachment.media_type : 'text';
  const id = randomUUID();
  const hours = input.expiresInHours;
  const rows = await getDb()`INSERT INTO messages (id,conversation_id,sender_id,message_type,body,attachment_id,reply_to_id,expires_at)
    SELECT ${id},c.id,${user.id},${messageType},${input.text ?? null},${input.attachmentId ?? null},${input.replyToId ?? null},
      CASE WHEN ${messageType === 'video' || messageType === 'voice'} THEN now()+interval '10 minutes'
           WHEN ${hours ?? null}::int IS NOT NULL THEN now()+(${hours ?? 0}*interval '1 hour') ELSE NULL END
    FROM conversations c JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=${user.id} AND mine.left_at IS NULL
    WHERE c.id=${conversationId} AND (
      (c.kind='direct'
        AND EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id)
          WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
          WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})))
      OR (c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)
        AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id=(SELECT g.id FROM haiku_groups g WHERE g.conversation_id=c.id) AND gm.user_id=${user.id} AND gm.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=(SELECT g.id FROM haiku_groups g WHERE g.conversation_id=c.id) AND gm.user_id<>${user.id} AND gm.left_at IS NULL
          WHERE (b.blocker_id=${user.id} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${user.id})))
    ) AND (${input.replyToId ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM messages parent WHERE parent.id=${input.replyToId ?? null} AND parent.conversation_id=c.id AND parent.deleted_at IS NULL AND (parent.expires_at IS NULL OR parent.expires_at>now())))
      AND (${input.attachmentId ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM attachments a WHERE a.id=${input.attachmentId ?? null} AND a.owner_id=${user.id} AND a.status='ready' AND a.purpose='message' AND (a.expires_at IS NULL OR a.expires_at>now())))
    RETURNING id,conversation_id,sender_id,message_type,body,attachment_id,reply_to_id,created_at,expires_at`;
  if (!rows.length) return jsonError(c, 403, 'MESSAGE_NOT_ALLOWED', 'You cannot send a message in this conversation. Check membership, friendship, and block settings.');
  const message = rows[0] as {id:string;conversation_id:string;sender_id:string;message_type:string;body:string|null;attachment_id:string|null;reply_to_id:string|null;created_at:Date|string;expires_at:Date|string|null};
  if (message.attachment_id) await getDb()`UPDATE attachments SET expires_at=${message.expires_at ?? null} WHERE id=${message.attachment_id} AND owner_id=${user.id}`;
  await getDb()`INSERT INTO message_receipts(message_id,user_id)
    SELECT ${message.id},cm.user_id FROM conversation_members cm WHERE cm.conversation_id=${conversationId} AND cm.user_id<>${user.id} AND cm.left_at IS NULL ON CONFLICT DO NOTHING`;
  let realtime: 'published' | 'unavailable' = 'published';
  try { await publishMessageCreated(conversationId, message.id); } catch { realtime = 'unavailable'; }
  // Notification payload contains no message body; recipient previews are read from settings at delivery time.
  const recipients = await getDb()`SELECT user_id FROM conversation_members WHERE conversation_id=${conversationId} AND user_id<>${user.id} AND left_at IS NULL LIMIT 100`;
  for (const row of recipients as Array<{user_id:string}>) {
    try { await createNotification(row.user_id, 'message', user.id, message.id, { conversationId }); } catch { /* message persists; notification retry is handled by inbox refresh */ }
  }
  return c.json({ message, realtime }, 201);
});

conversationRoutes.patch('/:conversationId/messages/:messageId', async (c) => {
  const user = c.get('user');
  const parsed = await parseJson(c, z.object({ text:z.string().trim().min(1).max(4000) }).strict());
  if ('response' in parsed) return parsed.response;
  const rows = await getDb()`UPDATE messages m SET body=${parsed.data.text},edited_at=now()
    FROM conversation_members cm WHERE m.id=${c.req.param('messageId')} AND m.conversation_id=${c.req.param('conversationId')}
      AND m.sender_id=${user.id} AND m.message_type='text' AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
      AND m.created_at>now()-interval '15 minutes' AND cm.conversation_id=m.conversation_id AND cm.user_id=${user.id} AND cm.left_at IS NULL
    RETURNING m.id,m.body,m.edited_at,m.created_at,m.expires_at`;
  if (!rows.length) return jsonError(c, 404, 'MESSAGE_NOT_EDITABLE', 'This message cannot be edited. It may have expired or be older than 15 minutes.');
  try { await publishMessageCreated(c.req.param('conversationId'), c.req.param('messageId')); } catch { /* message is durable; clients can refresh */ }
  return c.json({ message: rows[0] });
});

conversationRoutes.delete('/:conversationId/messages/:messageId', async (c) => {
  const user = c.get('user');
  const mode = c.req.query('mode') === 'everyone' ? 'everyone' : 'me';
  const conversationId = c.req.param('conversationId');
  const messageId = c.req.param('messageId');
  if (mode === 'me') {
    const allowed = await getDb()`SELECT 1 FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id
      WHERE m.id=${messageId} AND m.conversation_id=${conversationId} AND cm.user_id=${user.id} AND cm.left_at IS NULL LIMIT 1`;
    if (!allowed.length) return jsonError(c, 404, 'MESSAGE_NOT_FOUND', 'Message not found.');
    await getDb()`INSERT INTO message_hidden(message_id,user_id) VALUES (${messageId},${user.id}) ON CONFLICT DO NOTHING`;
    return c.json({ status: 'deleted_for_me' });
  }
  const owned=await getDb()`SELECT m.attachment_id FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id
    WHERE m.id=${messageId} AND m.conversation_id=${conversationId} AND m.sender_id=${user.id} AND m.deleted_at IS NULL AND cm.user_id=${user.id} AND cm.left_at IS NULL LIMIT 1`;
  if(!owned.length)return jsonError(c,404,'MESSAGE_NOT_FOUND','Only your own available messages can be deleted for everyone.');
  const attached=(owned[0] as {attachment_id:string|null}).attachment_id;
  const rows=await getDb()`UPDATE messages SET body=NULL,attachment_id=NULL,deleted_at=now(),deletion_kind='sender'
    WHERE id=${messageId} AND conversation_id=${conversationId} AND sender_id=${user.id} AND deleted_at IS NULL RETURNING id`;
  if(!rows.length)return jsonError(c,404,'MESSAGE_NOT_FOUND','Message not found.');
  if(attached)await getDb()`UPDATE attachments SET expires_at=now() WHERE id=${attached}`;
  try { await publishMessageCreated(conversationId, messageId); } catch { /* clients can refresh */ }
  return c.json({ status: 'deleted_for_everyone' });
});

conversationRoutes.post('/:conversationId/read', async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('conversationId');
  const visible = await getDb()`SELECT 1 FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE c.id=${conversationId} AND cm.user_id=${user.id} AND cm.left_at IS NULL AND (
      (c.kind='group' AND EXISTS(SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)) OR
      (c.kind='direct' AND EXISTS(SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id) WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})))
    ) LIMIT 1`;
  if (!visible.length) return jsonError(c, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  const settings = await getDb()`SELECT read_receipts_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
  if ((settings[0] as {read_receipts_enabled?:boolean}|undefined)?.read_receipts_enabled !== false) {
    await getDb()`UPDATE message_receipts mr SET read_at=COALESCE(mr.read_at,now()) FROM messages m
      WHERE mr.message_id=m.id AND mr.user_id=${user.id} AND mr.read_at IS NULL AND m.conversation_id=${conversationId}
        AND m.sender_id<>${user.id} AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())`;
  }
  await getDb()`UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=${conversationId} AND user_id=${user.id}`;
  return c.json({ status: 'read' });
});

conversationRoutes.get('/:conversationId/search', async (c) => {
  const limited = await enforceRateLimit(c, 'message-search', 30, 60); if (limited) return limited;
  const user = c.get('user');
  const conversationId = c.req.param('conversationId');
  if(!validUuid(conversationId))return jsonError(c,404,'CONVERSATION_NOT_FOUND','Conversation not found.');
  const q = (c.req.query('q') || '').trim().slice(0,100);
  if (q.length < 2) return jsonError(c, 422, 'SEARCH_TOO_SHORT', 'Enter at least two characters.');
  const membership = await getDb()`SELECT 1 FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE c.id=${conversationId} AND cm.user_id=${user.id} AND cm.left_at IS NULL AND (
      (c.kind='group' AND EXISTS(SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)) OR
      (c.kind='direct' AND EXISTS(SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id) WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})))
    ) LIMIT 1`;
  if (!membership.length) return jsonError(c, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const rows = await getDb()`SELECT id,sender_id,body,created_at,edited_at FROM messages m
    WHERE conversation_id=${conversationId} AND message_type='text' AND body ILIKE ${like} ESCAPE '\\'
      AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>now())
      AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id=m.id AND h.user_id=${user.id})
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=m.sender_id) OR (b.blocker_id=m.sender_id AND b.blocked_id=${user.id}))
    ORDER BY created_at DESC LIMIT 50`;
  return c.json({ messages: rows });
});

conversationRoutes.post('/realtime/token-request', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`SELECT c.id FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE cm.user_id=${user.id} AND cm.left_at IS NULL AND (
      (c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)) OR (EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id)
        WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
          WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})))
    ) LIMIT 150`;
  try {
    const prefs=await getDb()`SELECT presence_visible,typing_indicators_enabled,notifications_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
    const preference=(prefs[0] as {presence_visible?:boolean;typing_indicators_enabled?:boolean;notifications_enabled?:boolean}|undefined);
    const tokenRequest = await createRealtimeTokenRequest(user.id, rows.map((row) => String((row as {id:string}).id)),{presenceVisible:preference?.presence_visible!==false,typingIndicatorsEnabled:preference?.typing_indicators_enabled!==false,notificationsEnabled:preference?.notifications_enabled!==false});
    c.header('Cache-Control','no-store');
    return c.json(tokenRequest);
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFIG_ABLY_MISSING') return jsonError(c, 503, 'CONFIG_ABLY_MISSING', 'Realtime messaging is not configured.');
    return jsonError(c, 503, 'REALTIME_UNAVAILABLE', 'Realtime connection is temporarily unavailable.');
  }
});

conversationRoutes.get('/notifications', async (c) => {
  const user = c.get('user');
  const before = c.req.query('before');
  const rows = await getDb()`SELECT n.id,n.type,n.actor_id,n.entity_id,n.payload,n.created_at,n.read_at,p.username,p.display_name
    FROM notifications n LEFT JOIN user_profiles p ON p.user_id=n.actor_id
    WHERE n.user_id=${user.id} AND n.expires_at>now() AND (${before || null}::timestamptz IS NULL OR n.created_at<${before || null}::timestamptz)
    ORDER BY n.created_at DESC LIMIT 50`;
  return c.json({ notifications: rows });
});

conversationRoutes.post('/notifications/:id/read', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=${c.req.param('id')} AND user_id=${user.id} AND expires_at>now() RETURNING id`;
  if (!rows.length) return jsonError(c, 404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  return c.json({ status: 'read' });
});
