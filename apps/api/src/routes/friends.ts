import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { getDb } from '../db.js';
import { jsonError } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rate-limit.js';
import { createNotification } from '../services/notifications.js';
import type { ApiEnv } from '../types.js';

export const friendRoutes = new Hono<ApiEnv>();
friendRoutes.use('*', requireUser);

function pair(a: string, b: string) { return a < b ? [a,b] : [b,a]; }

friendRoutes.get('/', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`SELECT p.user_id AS id,p.username,p.display_name,p.bio,p.location,p.avatar_object_key,f.created_at
    FROM friendships f
    JOIN users u ON u.id=CASE WHEN f.user_low=${user.id} THEN f.user_high ELSE f.user_low END
    JOIN user_profiles p ON p.user_id=u.id
    WHERE (f.user_low=${user.id} OR f.user_high=${user.id}) AND u.status='active' AND u.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=${user.id}))
    ORDER BY p.display_name LIMIT 500`;
  return c.json({ friends: rows });
});

friendRoutes.get('/requests', async (c) => {
  const user = c.get('user');
  const direction = c.req.query('direction') === 'outgoing' ? 'outgoing' : 'incoming';
  const rows = direction === 'incoming'
    ? await getDb()`SELECT r.id,r.created_at,p.user_id AS user_id,p.username,p.display_name,p.bio,p.avatar_object_key
        FROM friend_requests r JOIN user_profiles p ON p.user_id=r.sender_id
        JOIN users u ON u.id=r.sender_id WHERE r.recipient_id=${user.id} AND r.status='pending' AND u.status='active' ORDER BY r.created_at DESC LIMIT 100`
    : await getDb()`SELECT r.id,r.created_at,p.user_id AS user_id,p.username,p.display_name,p.bio,p.avatar_object_key
        FROM friend_requests r JOIN user_profiles p ON p.user_id=r.recipient_id
        JOIN users u ON u.id=r.recipient_id WHERE r.sender_id=${user.id} AND r.status='pending' AND u.status='active' ORDER BY r.created_at DESC LIMIT 100`;
  return c.json({ direction, requests: rows });
});

friendRoutes.post('/requests/:userId', async (c) => {
  const limited=await enforceRateLimit(c,'friend-request',30,3600);if(limited)return limited;
  const user = c.get('user');
  const recipientId = c.req.param('userId');
  if (!/^[0-9a-f-]{36}$/i.test(recipientId) || recipientId === user.id) return jsonError(c, 422, 'RECIPIENT_INVALID', 'Choose another Haiku Messenger user.');
  const blocked = await getDb()`SELECT 1 FROM blocks WHERE (blocker_id=${user.id} AND blocked_id=${recipientId}) OR (blocker_id=${recipientId} AND blocked_id=${user.id}) LIMIT 1`;
  if (blocked.length) return jsonError(c, 404, 'USER_NOT_FOUND', 'That user is unavailable.');
  const target = await getDb()`SELECT 1 FROM users WHERE id=${recipientId} AND status='active' AND email_verified_at IS NOT NULL AND deleted_at IS NULL LIMIT 1`;
  if (!target.length) return jsonError(c, 404, 'USER_NOT_FOUND', 'That user is unavailable.');
  const [low,high] = pair(user.id, recipientId);
  const existingFriendship = await getDb()`SELECT 1 FROM friendships WHERE user_low=${low} AND user_high=${high} LIMIT 1`;
  if (existingFriendship.length) return jsonError(c, 409, 'ALREADY_FRIENDS', 'You are already friends.');
  const id = randomUUID();
  try {
    await getDb()`INSERT INTO friend_requests(id,sender_id,recipient_id,status) VALUES (${id},${user.id},${recipientId},'pending')`;
  } catch (error) {
    if ((error as {code?:string})?.code === '23505') return jsonError(c, 409, 'REQUEST_PENDING', 'A friend request is already pending.');
    return jsonError(c, 503, 'REQUEST_FAILED', 'The request could not be sent.');
  }
  try { await createNotification(recipientId, 'friend_request', user.id, id, {}); } catch { /* durable request is the source of truth */ }
  return c.json({ request: { id, status: 'pending', recipientId } }, 201);
});

friendRoutes.post('/requests/:requestId/accept', async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const accepted = await getDb()`WITH request AS (
      UPDATE friend_requests SET status='accepted',responded_at=now()
      WHERE id=${requestId} AND recipient_id=${user.id} AND status='pending'
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=friend_requests.sender_id) OR (b.blocker_id=friend_requests.sender_id AND b.blocked_id=${user.id}))
      RETURNING sender_id,recipient_id
    ), friendship AS (
      INSERT INTO friendships(user_low,user_high)
        SELECT LEAST(sender_id,recipient_id),GREATEST(sender_id,recipient_id) FROM request
        ON CONFLICT DO NOTHING RETURNING user_low,user_high
    ) SELECT request.sender_id,request.recipient_id FROM request`;
  if (!accepted.length) return jsonError(c, 404, 'REQUEST_NOT_FOUND', 'This request is no longer available.');
  const request = accepted[0] as {sender_id:string;recipient_id:string};
  try { await createNotification(request.sender_id, 'friend_accepted', user.id, requestId, {}); } catch { /* notification delivery is best effort */ }
  return c.json({ status: 'accepted', friendId: request.sender_id });
});

friendRoutes.post('/requests/:requestId/reject', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`UPDATE friend_requests SET status='rejected',responded_at=now()
    WHERE id=${c.req.param('requestId')} AND recipient_id=${user.id} AND status='pending' RETURNING id`;
  if (!rows.length) return jsonError(c, 404, 'REQUEST_NOT_FOUND', 'This request is no longer available.');
  return c.json({ status: 'rejected' });
});

friendRoutes.delete('/requests/:requestId', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`UPDATE friend_requests SET status='canceled',responded_at=now()
    WHERE id=${c.req.param('requestId')} AND sender_id=${user.id} AND status='pending' RETURNING id`;
  if (!rows.length) return jsonError(c, 404, 'REQUEST_NOT_FOUND', 'This request is no longer available.');
  return c.json({ status: 'canceled' });
});

friendRoutes.delete('/:userId', async (c) => {
  const user = c.get('user');
  const friendId = c.req.param('userId');
  if (!/^[0-9a-f-]{36}$/i.test(friendId)) return jsonError(c, 404, 'FRIEND_NOT_FOUND', 'Friend not found.');
  const [low,high] = pair(user.id, friendId);
  const deleted = await getDb()`DELETE FROM friendships WHERE user_low=${low} AND user_high=${high} RETURNING user_low`;
  if (!deleted.length) return jsonError(c, 404, 'FRIEND_NOT_FOUND', 'Friend not found.');
  return c.json({ status: 'removed' });
});

friendRoutes.get('/blocks', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`SELECT b.blocked_id AS id,p.username,p.display_name,b.created_at
    FROM blocks b JOIN user_profiles p ON p.user_id=b.blocked_id WHERE b.blocker_id=${user.id} ORDER BY b.created_at DESC LIMIT 500`;
  return c.json({ blockedUsers: rows });
});

friendRoutes.post('/blocks/:userId', async (c) => {
  const limited=await enforceRateLimit(c,'block-account',20,3600);if(limited)return limited;
  const user = c.get('user');
  const blockedId = c.req.param('userId');
  if (!/^[0-9a-f-]{36}$/i.test(blockedId) || blockedId === user.id) return jsonError(c, 422, 'USER_INVALID', 'You cannot block this account.');
  const target = await getDb()`SELECT id FROM users WHERE id=${blockedId} AND deleted_at IS NULL LIMIT 1`;
  if (!target.length) return jsonError(c, 404, 'USER_NOT_FOUND', 'User not found.');
  const [low,high] = pair(user.id, blockedId);
  await getDb().transaction([
    getDb()`INSERT INTO blocks(blocker_id,blocked_id) VALUES (${user.id},${blockedId}) ON CONFLICT DO NOTHING`,
    getDb()`DELETE FROM friendships WHERE user_low=${low} AND user_high=${high}`,
    getDb()`UPDATE friend_requests SET status='canceled',responded_at=now() WHERE status='pending' AND ((sender_id=${user.id} AND recipient_id=${blockedId}) OR (sender_id=${blockedId} AND recipient_id=${user.id}))`,
  ]);
  return c.json({ status: 'blocked' });
});

friendRoutes.delete('/blocks/:userId', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`DELETE FROM blocks WHERE blocker_id=${user.id} AND blocked_id=${c.req.param('userId')} RETURNING blocked_id`;
  if (!rows.length) return jsonError(c, 404, 'BLOCK_NOT_FOUND', 'That block was not found.');
  return c.json({ status: 'unblocked' });
});
