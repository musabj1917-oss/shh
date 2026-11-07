import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { publishUserEvent } from './realtime.js';
import { sendFcmNotification } from './firebase.js';

async function dispatchPushNotification(
  userId: string,
  type: string,
  actorId: string | null,
  entityId: string | null,
  payload: Record<string, unknown>,
  notificationId: string
) {
  try {
    // Check user settings
    const settingsRows = await getDb()`SELECT quiet_mode, notifications_enabled, sender_previews FROM user_settings WHERE user_id = ${userId} LIMIT 1`;
    const settings = settingsRows[0] as { quiet_mode?: boolean; notifications_enabled?: boolean; sender_previews?: boolean } | undefined;

    if (settings && (settings.notifications_enabled === false || settings.quiet_mode === true)) {
      return;
    }

    // Fetch device push tokens
    const tokenRows = await getDb()`SELECT token FROM device_push_tokens WHERE user_id = ${userId}`;
    if (!tokenRows.length) return;
    const tokens = tokenRows.map((r) => String(r.token));

    // Look up actor info if present
    let actorName = 'Someone';
    if (actorId) {
      try {
        const actorRows = await getDb()`SELECT display_name, username FROM user_profiles WHERE user_id = ${actorId} LIMIT 1`;
        if (actorRows.length) {
          const actor = actorRows[0] as { display_name?: string; username?: string };
          actorName = (settings?.sender_previews !== false ? actor.display_name : null) || `@${actor.username}` || 'Someone';
        }
      } catch {
        // fallback
      }
    }

    let title = 'Haiku Messenger';
    let body = 'You have a new update.';

    switch (type) {
      case 'message': {
        title = settings?.sender_previews !== false ? actorName : 'Haiku Messenger';
        body = typeof payload.preview === 'string' && payload.preview
          ? payload.preview
          : 'Sent you a new message';
        break;
      }
      case 'friend_request': {
        title = 'Friend Request';
        body = `${actorName} sent you a friend request.`;
        break;
      }
      case 'friend_accepted': {
        title = 'Friend Request Accepted';
        body = `${actorName} accepted your friend request.`;
        break;
      }
      case 'group_membership': {
        title = 'Group Update';
        body = typeof payload.name === 'string'
          ? `You were added to "${payload.name}".`
          : 'You were added to a group.';
        break;
      }
      case 'group_invite': {
        title = 'Group Invitation';
        body = typeof payload.groupName === 'string'
          ? `You've been invited to join "${payload.groupName}".`
          : "You've been invited to join a group.";
        break;
      }
      case 'story_reply': {
        title = 'Story Reply';
        body = `${actorName} replied to your story.`;
        break;
      }
      case 'report_update': {
        title = 'Report Update';
        body = 'An update is available on your report.';
        break;
      }
      default: {
        title = 'Haiku Messenger';
        body = 'You have a new notification.';
      }
    }

    const fcmData: Record<string, string> = {
      notificationId,
      type,
      entityId: entityId || '',
      actorId: actorId || '',
    };

    const result = await sendFcmNotification(tokens, { title, body, data: fcmData });

    // Clean up invalid or stale tokens
    if (result.invalidTokens && result.invalidTokens.length > 0) {
      try {
        await getDb()`DELETE FROM device_push_tokens WHERE token = ANY(${result.invalidTokens}::text[])`;
      } catch (cleanErr) {
        console.warn('[Notifications] Failed to clean up invalid push tokens:', cleanErr);
      }
    }
  } catch (err) {
    console.error('[Notifications] Push notification dispatch failed:', err);
  }
}

export async function createNotification(
  userId: string,
  type: string,
  actorId: string | null,
  entityId: string | null,
  payload: Record<string, unknown> = {}
) {
  const id = randomUUID();
  await getDb()`INSERT INTO notifications (id,user_id,actor_id,type,entity_id,payload) VALUES (${id},${userId},${actorId},${type},${entityId},${JSON.stringify(payload)}::jsonb)`;
  
  try { 
    await publishUserEvent(userId, 'notification.created', { id, type, entityId }); 
  } catch { 
    /* durable inbox remains */ 
  }

  // Asynchronous push delivery via FCM
  dispatchPushNotification(userId, type, actorId, entityId, payload, id).catch((err) => {
    console.error('[Notifications] Asynchronous FCM push error:', err);
  });

  return id;
}
