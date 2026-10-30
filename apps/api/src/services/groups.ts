
import { query } from '../db.js';
import { logAuditEvent } from './audit.js';

export async function createGroup(ownerId: string, name: string, description?: string, isPrivate: boolean = false) {
  const groupRows = await query<{ id: string }>(
    `INSERT INTO groups (name, description, owner_id, is_private)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, description || null, ownerId, isPrivate]
  );

  const groupId = groupRows[0].id;

  // Create associated group conversation
  const convRows = await query<{ id: string }>(
    `INSERT INTO conversations (title, is_group, creator_id)
     VALUES ($1, TRUE, $2)
     RETURNING id`,
    [name, ownerId]
  );

  await query(
    `INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [groupId, ownerId]
  );

  await query(
    `INSERT INTO conversation_memberships (conversation_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [convRows[0].id, ownerId]
  );

  await logAuditEvent(ownerId, 'group.created', 'group', groupId);
  return groupId;
}

export async function createGroupInviteLink(
  userId: string,
  groupId: string,
  expiresInHours?: number,
  maxUses?: number
) {
  // Check membership
  const memberCheck = await query<{ role: string }>(
    `SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  if (memberCheck.length === 0) {
    throw new Error('You must be a group member to generate an invite link.');
  }

  const code = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  let expiresAt: string | null = null;
  if (expiresInHours) {
    expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
  }

  const rows = await query<{ code: string }>(
    `INSERT INTO group_invite_links (group_id, code, created_by, expires_at, max_uses)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING code`,
    [groupId, code, userId, expiresAt, maxUses || null]
  );

  return rows[0].code;
}

export async function requestJoinViaLink(userId: string, code: string) {
  const linkRows = await query<{
    id: string;
    group_id: string;
    expires_at: string | null;
    max_uses: number | null;
    uses_count: number;
    is_revoked: boolean;
  }>(`SELECT * FROM group_invite_links WHERE code = $1`, [code]);

  if (linkRows.length === 0 || linkRows[0].is_revoked) {
    throw new Error('Invalid or revoked invite link.');
  }

  const link = linkRows[0];
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    throw new Error('Invite link has expired.');
  }
  if (link.max_uses && link.uses_count >= link.max_uses) {
    throw new Error('Invite link max uses reached.');
  }

  // Submit join request
  await query(
    `INSERT INTO group_join_requests (group_id, user_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'pending', updated_at = NOW()`,
    [link.group_id, userId]
  );

  await query(`UPDATE group_invite_links SET uses_count = uses_count + 1 WHERE id = $1`, [link.id]);
  await logAuditEvent(userId, 'group.join_request_submitted', 'group', link.group_id);
}

export async function handleJoinRequest(
  adminId: string,
  groupId: string,
  applicantUserId: string,
  approve: boolean
) {
  const adminCheck = await query<{ role: string }>(
    `SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2`,
    [groupId, adminId]
  );

  if (adminCheck.length === 0 || (adminCheck[0].role !== 'owner' && adminCheck[0].role !== 'admin')) {
    throw new Error('Only group owners or admins can approve join requests.');
  }

  const status = approve ? 'approved' : 'rejected';
  await query(
    `UPDATE group_join_requests SET status = $1, updated_at = NOW()
     WHERE group_id = $2 AND user_id = $3`,
    [status, groupId, applicantUserId]
  );

  if (approve) {
    await query(
      `INSERT INTO group_memberships (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, applicantUserId]
    );

    // Also add to conversation
    const convRows = await query<{ id: string }>(
      `SELECT id FROM conversations WHERE is_group = TRUE AND creator_id IN (
         SELECT user_id FROM group_memberships WHERE group_id = $1 AND role = 'owner'
       ) LIMIT 1`,
      [groupId]
    );

    if (convRows.length > 0) {
      await query(
        `INSERT INTO conversation_memberships (conversation_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [convRows[0].id, applicantUserId]
      );
    }

    await logAuditEvent(adminId, 'group.join_request_approved', 'group', groupId, { applicantUserId });
  }
}

export async function removeGroupMember(requesterId: string, groupId: string, targetUserId: string) {
  if (requesterId === targetUserId) {
    // User leaving on their own
    await query(`DELETE FROM group_memberships WHERE group_id = $1 AND user_id = $2`, [groupId, targetUserId]);
    return;
  }

  // Only the owner can remove existing members
  const ownerCheck = await query<{ owner_id: string }>(`SELECT owner_id FROM groups WHERE id = $1`, [groupId]);
  if (ownerCheck.length === 0 || ownerCheck[0].owner_id !== requesterId) {
    throw new Error('Only the group owner can remove members from the group.');
  }

  await query(`DELETE FROM group_memberships WHERE group_id = $1 AND user_id = $2`, [groupId, targetUserId]);
  await logAuditEvent(requesterId, 'group.member_removed', 'group', groupId, { targetUserId });
}
