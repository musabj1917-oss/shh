import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { publishUserEvent } from './realtime.js';

export async function createNotification(userId: string, type: string, actorId: string | null, entityId: string | null, payload: Record<string, unknown> = {}) {
  const id = randomUUID();
  await getDb()`INSERT INTO notifications (id,user_id,actor_id,type,entity_id,payload) VALUES (${id},${userId},${actorId},${type},${entityId},${JSON.stringify(payload)}::jsonb)`;
  try { await publishUserEvent(userId, 'notification.created', { id, type, entityId }); } catch { /* durable inbox remains; push delivery is a separate adapter */ }
  return id;
}
