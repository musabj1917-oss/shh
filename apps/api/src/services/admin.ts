import { query } from '../db.js';
import { logAuditEvent } from './audit.js';

export async function getAdminActiveMessages() {
  const rows = await query<{
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_email: string;
    body: string | null;
    kind: string;
    created_at: string;
    expires_at: string | null;
  }>(
    `SELECT m.id, m.conversation_id, m.sender_id, u.email as sender_email, m.body, m.kind, m.created_at, m.expires_at
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE m.deleted_for_everyone = FALSE
       AND (m.expires_at IS NULL OR m.expires_at > NOW())
     ORDER BY m.created_at DESC
     LIMIT 50`
  );
  return rows;
}

export async function getAdminUsersList() {
  const rows = await query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    username: string | null;
    is_active: boolean;
    is_admin: boolean;
    created_at: string;
  }>(
    `SELECT id, email, first_name, last_name, username, is_active, is_admin, created_at
     FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
  return rows;
}

export async function setAdminUserStatus(adminId: string, targetUserId: string, isActive: boolean) {
  await query(`UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, [isActive, targetUserId]);
  await logAuditEvent(adminId, isActive ? 'admin.user_restored' : 'admin.user_suspended', 'user', targetUserId);
}

export async function getAdminReportsList() {
  const rows = await query<{
    id: string;
    reporter_id: string;
    reporter_email: string;
    reported_user_id: string | null;
    reported_message_id: string | null;
    reason: string;
    status: string;
    reviewer_notes: string | null;
    created_at: string;
  }>(
    `SELECT r.id, r.reporter_id, u.email as reporter_email, r.reported_user_id, r.reported_message_id,
            r.reason, r.status, r.reviewer_notes, r.created_at
     FROM reports r
     JOIN users u ON r.reporter_id = u.id
     ORDER BY r.created_at DESC`
  );
  return rows;
}

export async function resolveAdminReport(adminId: string, reportId: string, status: 'resolved' | 'dismissed', notes?: string) {
  await query(
    `UPDATE reports SET status = $1, reviewer_id = $2, reviewer_notes = $3, resolved_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [status, adminId, notes || null, reportId]
  );
  await logAuditEvent(adminId, `admin.report_${status}`, 'report', reportId, { notes });
}

export async function getAdminGroupsList() {
  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    owner_id: string;
    owner_email: string;
    is_private: boolean;
    members_count: number;
    created_at: string;
  }>(
    `SELECT g.id, g.name, g.description, g.owner_id, u.email as owner_email, g.is_private,
            COUNT(gm.id) as members_count, g.created_at
     FROM groups g
     JOIN users u ON g.owner_id = u.id
     LEFT JOIN group_memberships gm ON g.id = gm.group_id
     GROUP BY g.id, u.email
     ORDER BY g.created_at DESC`
  );
  return rows;
}

export async function getAdminAuditLogs() {
  const rows = await query<{
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    metadata: unknown;
    created_at: string;
  }>(`SELECT id, actor_id, action, target_type, target_id, metadata, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100`);
  return rows;
}

export async function getAdminSystemMetrics() {
  const totalUsers = await query<{ count: string }>(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`);
  const activeMessages = await query<{ count: string }>(`SELECT COUNT(*) as count FROM messages WHERE deleted_for_everyone = FALSE`);
  const totalMediaAssets = await query<{ count: string; total_bytes: string | null }>(`SELECT COUNT(*) as count, SUM(bytes) as total_bytes FROM media_assets`);
  const pendingReports = await query<{ count: string }>(`SELECT COUNT(*) as count FROM reports WHERE status = 'open'`);

  return {
    usersCount: Number(totalUsers[0].count),
    activeMessagesCount: Number(activeMessages[0].count),
    mediaAssetsCount: Number(totalMediaAssets[0].count),
    mediaTotalBytes: Number(totalMediaAssets[0].total_bytes || 0),
    pendingReportsCount: Number(pendingReports[0].count),
    neonStorageFreeTierLimitBytes: 1024 * 1024 * 1024 // 1GB Neon free storage limit
  };
}
