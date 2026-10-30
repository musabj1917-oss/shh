import { query } from '../db.js';
import { logAuditEvent } from './audit.js';

export async function blockUser(blockerId: string, blockedId: string, reason?: string) {
  if (blockerId === blockedId) {
    throw new Error('You cannot block yourself.');
  }

  await query(
    `INSERT INTO blocks (blocker_id, blocked_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
    [blockerId, blockedId, reason || null]
  );

  // Remove any existing friendships or friend requests
  await query(
    `DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [blockerId, blockedId]
  );
  await query(
    `DELETE FROM friend_requests WHERE (requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1)`,
    [blockerId, blockedId]
  );

  await logAuditEvent(blockerId, 'user.block', 'user', blockedId, { reason });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await query(`DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]);
  await logAuditEvent(blockerId, 'user.unblock', 'user', blockedId);
}

export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const rows = await query(
    `SELECT id FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)`,
    [userA, userB]
  );
  return rows.length > 0;
}

export async function submitReport(
  reporterId: string,
  reportedUserId?: string,
  reportedMessageId?: string,
  reason?: string
) {
  if (!reason) throw new Error('Report reason is required.');

  const rows = await query<{ id: string }>(
    `INSERT INTO reports (reporter_id, reported_user_id, reported_message_id, reason, status)
     VALUES ($1, $2, $3, $4, 'open')
     RETURNING id`,
    [reporterId, reportedUserId || null, reportedMessageId || null, reason]
  );

  await logAuditEvent(reporterId, 'report.submitted', 'report', rows[0].id, {
    reportedUserId,
    reportedMessageId
  });

  return rows[0].id;
}
