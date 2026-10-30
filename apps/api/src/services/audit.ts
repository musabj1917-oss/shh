import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';

export async function auditAdmin(actorId: string, action: string, entityType: string, entityId: string | null, reason?: string, metadata: Record<string, unknown> = {}) {
  await getDb()`INSERT INTO admin_audit_events (id,admin_user_id,action,entity_type,entity_id,reason,metadata)
    VALUES (${randomUUID()},${actorId},${action.slice(0,100)},${entityType.slice(0,80)},${entityId?.slice(0,200) || null},${reason?.slice(0,500) || null},${JSON.stringify(metadata)}::jsonb)`;
}
