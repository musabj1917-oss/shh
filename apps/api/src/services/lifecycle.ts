import { query } from '../db.js';
import { logAuditEvent } from './audit.js';

export async function processAccountDeletionLifecycle() {
  // Find account deletion requests scheduled in the past that are still pending
  const requests = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM account_deletion_requests
     WHERE status = 'requested' AND scheduled_for <= NOW()`
  );

  for (const req of requests) {
    const userId = req.user_id;

    // Purge user data across tables idempotently
    await query(`DELETE FROM auth_providers WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM message_receipts WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM message_deleted_for_users WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM group_memberships WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM conversation_memberships WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1`, [userId]);
    await query(`DELETE FROM friend_requests WHERE requester_id = $1 OR recipient_id = $1`, [userId]);
    await query(`DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1`, [userId]);
    await query(`DELETE FROM stories WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM media_assets WHERE owner_id = $1`, [userId]);
    await query(`DELETE FROM decoy_credentials WHERE user_id = $1`, [userId]);

    // Soft/hard delete user record
    await query(
      `UPDATE users
       SET email = CONCAT('deleted_', gen_random_uuid(), '@deleted.internal'),
           first_name = 'Deleted',
           last_name = 'User',
           password_hash = NULL,
           bio = NULL,
           location = NULL,
           profile_photo_url = NULL,
           is_active = FALSE,
           deleted_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    // Update request status
    await query(
      `UPDATE account_deletion_requests SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [req.id]
    );

    await logAuditEvent(null, 'account_deletion.completed', 'user', userId);
  }
}
