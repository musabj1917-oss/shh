import { query } from '../db.js';

export async function logAuditEvent(
  actorId: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, action, targetType ?? null, targetId ?? null, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
