import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { publishConversationEvent, publishMessageCreated, publishUserEvent } from '../services/realtime.js';
import { createNotification } from '../services/notifications.js';
import { locationPinSchema, locationUpdateSchema } from '../contracts.js';
import type { ApiEnv } from '../types.js';

export const locationRoutes = new Hono<ApiEnv>();
locationRoutes.use('*', requireUser);

// 1. Update or stop live location sharing
locationRoutes.put('/live', async (c) => {
  const user = c.get('user');
  const parsed = await parseJson(c, locationUpdateSchema);
  if ('response' in parsed) return parsed.response;

  const { latitude, longitude, accuracy, heading, speed, sharingMode, conversationId, durationMinutes } = parsed.data;

  if (sharingMode === 'off') {
    await getDb()`UPDATE user_locations SET sharing_mode = 'off', expires_at = now() WHERE user_id = ${user.id}`;
    // Notify friends that live sharing stopped
    const friends = await getDb()`
      SELECT CASE WHEN user_low = ${user.id} THEN user_high ELSE user_low END AS friend_id
      FROM friendships WHERE user_low = ${user.id} OR user_high = ${user.id}
    `;
    for (const f of friends as Array<{ friend_id: string }>) {
      try {
        await publishUserEvent(f.friend_id, 'friend.location.removed', { userId: user.id });
      } catch {}
    }
    return c.json({ status: 'stopped' });
  }

  const duration = Math.min(Math.max(durationMinutes || 60, 5), 1440);
  const rows = await getDb()`
    INSERT INTO user_locations (
      user_id, latitude, longitude, accuracy, heading, speed, sharing_mode, active_conversation_id, updated_at, expires_at
    ) VALUES (
      ${user.id}, ${latitude}, ${longitude}, ${accuracy ?? null}, ${heading ?? null}, ${speed ?? null},
      ${sharingMode}, ${conversationId ?? null}, now(), now() + (${duration} * interval '1 minute')
    )
    ON CONFLICT (user_id) DO UPDATE SET
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      accuracy = EXCLUDED.accuracy,
      heading = EXCLUDED.heading,
      speed = EXCLUDED.speed,
      sharing_mode = EXCLUDED.sharing_mode,
      active_conversation_id = EXCLUDED.active_conversation_id,
      updated_at = now(),
      expires_at = EXCLUDED.expires_at
    RETURNING user_id, latitude, longitude, accuracy, heading, speed, sharing_mode, active_conversation_id, updated_at, expires_at
  `;

  const location = rows[0];

  // Broadcast real-time location update
  if (sharingMode === 'friends') {
    const friends = await getDb()`
      SELECT CASE WHEN user_low = ${user.id} THEN user_high ELSE user_low END AS friend_id
      FROM friendships WHERE user_low = ${user.id} OR user_high = ${user.id}
    `;
    for (const f of friends as Array<{ friend_id: string }>) {
      try {
        await publishUserEvent(f.friend_id, 'friend.location.updated', {
          userId: user.id,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
          updatedAt: new Date().toISOString(),
        });
      } catch {}
    }
  } else if (sharingMode === 'live_chat' && conversationId) {
    try {
      await publishConversationEvent(conversationId, 'conversation.location.updated', {
        userId: user.id,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        heading: heading ?? null,
        speed: speed ?? null,
        updatedAt: new Date().toISOString(),
      });
    } catch {}
  }

  return c.json({ location });
});

// 2. Query current user's location status
locationRoutes.get('/self', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`
    SELECT user_id, latitude, longitude, accuracy, heading, speed, sharing_mode, active_conversation_id, updated_at, expires_at
    FROM user_locations WHERE user_id = ${user.id} AND (expires_at IS NULL OR expires_at > now()) LIMIT 1
  `;
  return c.json({ location: rows[0] || null });
});

// 3. Query mutual friends' active locations (Friend Radar)
locationRoutes.get('/friends', async (c) => {
  const user = c.get('user');
  const rows = await getDb()`
    SELECT 
      ul.user_id, ul.latitude, ul.longitude, ul.accuracy, ul.heading, ul.speed, ul.updated_at, ul.expires_at,
      p.username, p.display_name, p.avatar_object_key
    FROM user_locations ul
    JOIN user_profiles p ON p.user_id = ul.user_id
    WHERE ul.sharing_mode = 'friends'
      AND (ul.expires_at IS NULL OR ul.expires_at > now())
      AND ul.user_id <> ${user.id}
      AND EXISTS (
        SELECT 1 FROM friendships f
        WHERE (f.user_low = LEAST(${user.id}::uuid, ul.user_id) AND f.user_high = GREATEST(${user.id}::uuid, ul.user_id))
      )
    ORDER BY ul.updated_at DESC
  `;
  return c.json({ friends: rows });
});

// 4. Instant kill switch
locationRoutes.delete('/live', async (c) => {
  const user = c.get('user');
  await getDb()`UPDATE user_locations SET sharing_mode = 'off', expires_at = now() WHERE user_id = ${user.id}`;
  const friends = await getDb()`
    SELECT CASE WHEN user_low = ${user.id} THEN user_high ELSE user_low END AS friend_id
    FROM friendships WHERE user_low = ${user.id} OR user_high = ${user.id}
  `;
  for (const f of friends as Array<{ friend_id: string }>) {
    try {
      await publishUserEvent(f.friend_id, 'friend.location.removed', { userId: user.id });
    } catch {}
  }
  return c.json({ status: 'stopped' });
});

// 5. Send an in-chat Location Pin snapshot
const pinBodySchema = z.object({
  conversationId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  title: z.string().trim().max(120).optional(),
  address: z.string().trim().max(250).optional(),
}).strict();

locationRoutes.post('/pin', async (c) => {
  const user = c.get('user');
  const parsed = await parseJson(c, pinBodySchema);
  if ('response' in parsed) return parsed.response;

  const { conversationId, latitude, longitude, accuracy, title, address } = parsed.data;

  // Verify membership in conversation
  const members = await getDb()`
    SELECT user_id FROM conversation_members WHERE conversation_id = ${conversationId} AND user_id = ${user.id} AND left_at IS NULL LIMIT 1
  `;
  if (!members.length) {
    return jsonError(c, 403, 'FORBIDDEN', 'You are not a member of this conversation.');
  }

  const id = randomUUID();
  const body = JSON.stringify({
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    title: title || 'Current Location',
    address: address || null,
  });

  const rows = await getDb()`
    INSERT INTO messages (id, conversation_id, sender_id, message_type, body)
    VALUES (${id}, ${conversationId}, ${user.id}, 'location', ${body})
    RETURNING id, conversation_id, sender_id, message_type, body, attachment_id, reply_to_id, created_at, expires_at
  `;

  const message = rows[0];

  try {
    await publishMessageCreated(conversationId, id);
  } catch {}

  // Trigger push notification to other conversation members
  const recipients = await getDb()`
    SELECT user_id FROM conversation_members WHERE conversation_id = ${conversationId} AND user_id <> ${user.id} AND left_at IS NULL LIMIT 100
  `;
  for (const r of recipients as Array<{ user_id: string }>) {
    try {
      await createNotification(r.user_id, 'message', user.id, id, {
        conversationId,
        preview: '📍 Shared a location pin',
      });
    } catch {}
  }

  return c.json({ message }, 201);
});
