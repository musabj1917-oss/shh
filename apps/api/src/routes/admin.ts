import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { hasAdminPermission, requireAdmin } from '../middleware/admin.js';
import { auditAdmin } from '../services/audit.js';
import { getStorage } from '../services/storage.js';
import type { ApiEnv } from '../types.js';

export const adminRoutes = new Hono<ApiEnv>();
adminRoutes.use('*',requireUser,requireAdmin);
const pageArgs=(c:any)=>({page:Math.max(1,Number.parseInt(c.req.query('page')||'1',10)||1),limit:Math.min(100,Math.max(1,Number.parseInt(c.req.query('limit')||'25',10)||25))});
const check=(c:any,permission:string)=>hasAdminPermission(c,permission);

adminRoutes.get('/me',async(c)=>{
  const user=c.get('user'),admin=c.get('admin');
  return c.json({admin:{id:user.id,email:user.email,username:user.username,displayName:user.displayName,role:admin.role,permissions:admin.permissions}});
});

adminRoutes.get('/dashboard',async(c)=>{
  if(!check(c,'users.read')&&!check(c,'reports.read'))return jsonError(c,403,'PERMISSION_DENIED','You do not have dashboard permission.');
  const rows=await getDb()`SELECT
    (SELECT count(*)::int FROM users WHERE status='active' AND deleted_at IS NULL) AS active_users,
    (SELECT count(*)::int FROM users WHERE created_at>now()-interval '7 days' AND deleted_at IS NULL) AS new_users_7d,
    (SELECT count(*)::int FROM reports WHERE status IN ('open','reviewing')) AS open_reports,
    (SELECT count(*)::int FROM haiku_groups WHERE suspended_at IS NULL) AS active_groups,
    (SELECT count(*)::int FROM stories WHERE deleted_at IS NULL AND expires_at>now()) AS live_stories,
    (SELECT count(*)::int FROM messages WHERE deleted_at IS NULL AND (expires_at IS NULL OR expires_at>now()) AND created_at>now()-interval '24 hours') AS messages_24h`;
  await auditAdmin(c.get('user').id,'dashboard.read','dashboard',null,undefined,{});
  return c.json({summary:rows[0]||{}});
});

adminRoutes.get('/users',async(c)=>{
  if(!check(c,'users.read'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to search users.');
  const {page,limit}=pageArgs(c),offset=(page-1)*limit,q=(c.req.query('q')||'').trim().slice(0,80);
  const like=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
  const rows=await getDb()`SELECT u.id,u.email,u.status,u.email_verified_at,u.created_at,u.updated_at,p.username,p.display_name,p.location,
      (SELECT count(*)::int FROM friendships f WHERE f.user_low=u.id OR f.user_high=u.id) AS friend_count
    FROM users u JOIN user_profiles p ON p.user_id=u.id
    WHERE u.deleted_at IS NULL AND (${q}='' OR u.email ILIKE ${like} ESCAPE '\\' OR p.username ILIKE ${like} ESCAPE '\\' OR p.display_name ILIKE ${like} ESCAPE '\\')
    ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const count=await getDb()`SELECT count(*)::int AS total FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.deleted_at IS NULL
    AND (${q}='' OR u.email ILIKE ${like} ESCAPE '\\' OR p.username ILIKE ${like} ESCAPE '\\' OR p.display_name ILIKE ${like} ESCAPE '\\')`;
  await auditAdmin(c.get('user').id,'users.search','users',null,undefined,{queryLength:q.length,page});
  return c.json({users:rows,pagination:{page,limit,total:Number((count[0] as {total:number}|undefined)?.total||0)}});
});

adminRoutes.get('/users/:userId',async(c)=>{
  if(!check(c,'users.read'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to view user details.');
  const id=c.req.param('userId');
  const rows=await getDb()`SELECT u.id,u.email,u.status,u.email_verified_at,u.created_at,u.updated_at,p.username,p.display_name,p.bio,p.location,p.birthday_month,p.birthday_day
    FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${id} LIMIT 1`;
  if(!rows.length)return jsonError(c,404,'USER_NOT_FOUND','User not found.');
  await auditAdmin(c.get('user').id,'user.read','user',id,undefined,{});
  return c.json({user:rows[0]});
});

adminRoutes.get('/users/:userId/conversations',async(c)=>{
  if(c.get('admin').role!=='owner')return jsonError(c,403,'OWNER_REQUIRED','Only the designated owner can review private conversation content.');
  const actor=c.get('user'),userId=c.req.param('userId');
  const rows=await getDb()`SELECT c.id,c.kind,g.name AS group_name,
      (SELECT p.display_name FROM conversation_members other JOIN user_profiles p ON p.user_id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL LIMIT 1) AS direct_name,
      (SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())) AS active_message_count,
      (SELECT max(m.created_at) FROM messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())) AS last_message_at
    FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=${userId}
    LEFT JOIN haiku_groups g ON g.conversation_id=c.id ORDER BY last_message_at DESC NULLS LAST LIMIT 100`;
  await auditAdmin(actor.id,'user.conversations.read','user',userId,'Owner access to conversation metadata',{rowCount:rows.length});
  return c.json({conversations:rows,notice:'This list contains conversation metadata only. Message content is available to the owner and is audited separately.'});
});

adminRoutes.post('/users/:userId/suspend',async(c)=>{
  if(!check(c,'users.manage'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to suspend users.');
  const user=c.get('user'),id=c.req.param('userId');
  const parsed=await parseJson(c,z.object({reason:z.string().trim().min(5).max(500)}).strict());if('response' in parsed)return parsed.response;
  if(id===user.id)return jsonError(c,409,'SELF_SUSPENSION','You cannot suspend your own administrator account.');
  const rows=await getDb()`UPDATE users SET status='suspended',updated_at=now() WHERE id=${id} AND status='active' AND deleted_at IS NULL RETURNING id`;
  if(!rows.length)return jsonError(c,404,'USER_NOT_ACTIVE','Active user not found.');
  await getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${id} AND revoked_at IS NULL`;
  await auditAdmin(user.id,'user.suspend','user',id,parsed.data.reason,{});
  return c.json({status:'suspended'});
});

adminRoutes.post('/users/:userId/restore',async(c)=>{
  if(!check(c,'users.manage'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to restore users.');
  const actor=c.get('user'),id=c.req.param('userId');
  const rows=await getDb()`UPDATE users SET status='active',updated_at=now() WHERE id=${id} AND status='suspended' AND deleted_at IS NULL RETURNING id`;
  if(!rows.length)return jsonError(c,404,'USER_NOT_SUSPENDED','Suspended user not found.');
  await auditAdmin(actor.id,'user.restore','user',id,undefined,{});
  return c.json({status:'active'});
});

adminRoutes.delete('/users/:userId',async(c)=>{
  if(!check(c,'users.manage'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to delete users.');
  const actor=c.get('user'),id=c.req.param('userId');
  const parsed=await parseJson(c,z.object({confirmation:z.literal('DELETE'),reason:z.string().trim().min(5).max(500)}).strict());if('response' in parsed)return parsed.response;
  if(id===actor.id)return jsonError(c,409,'SELF_DELETE','You cannot delete your own administrator account.');
  const exists=await getDb()`SELECT 1 FROM users WHERE id=${id} AND deleted_at IS NULL LIMIT 1`;
  if(!exists.length)return jsonError(c,404,'USER_NOT_FOUND','User not found.');
  try{
    await getDb().transaction([
      getDb()`UPDATE messages SET body=NULL,attachment_id=NULL,deleted_at=now(),deletion_kind='account' WHERE sender_id=${id} AND deleted_at IS NULL`,
      getDb()`UPDATE attachments SET expires_at=now() WHERE owner_id=${id}`,
      getDb()`UPDATE stories SET deleted_at=now() WHERE user_id=${id} AND deleted_at IS NULL`,
      getDb()`UPDATE conversation_members SET left_at=now() WHERE user_id=${id} AND left_at IS NULL`,
      getDb()`WITH candidates AS (
          SELECT g.id,(SELECT gm.user_id FROM group_members gm JOIN users u ON u.id=gm.user_id
            WHERE gm.group_id=g.id AND gm.user_id<>${id} AND gm.left_at IS NULL AND u.status='active' AND u.deleted_at IS NULL
            ORDER BY CASE gm.role WHEN 'admin' THEN 0 ELSE 1 END,gm.joined_at LIMIT 1) AS successor
          FROM haiku_groups g WHERE g.owner_id=${id}
        ) UPDATE haiku_groups g SET owner_id=COALESCE(c.successor,g.owner_id),
          suspended_at=CASE WHEN c.successor IS NULL THEN COALESCE(g.suspended_at,now()) ELSE g.suspended_at END,
          suspension_reason=CASE WHEN c.successor IS NULL THEN 'Owner account deleted; admin review required' ELSE g.suspension_reason END,
          updated_at=now() FROM candidates c WHERE g.id=c.id`,
      getDb()`UPDATE group_members gm SET role='owner' FROM haiku_groups g WHERE gm.group_id=g.id AND g.owner_id=gm.user_id AND gm.left_at IS NULL AND g.owner_id<>${id}`,
      getDb()`UPDATE group_members SET left_at=now() WHERE user_id=${id} AND left_at IS NULL`,
      getDb()`DELETE FROM friendships WHERE user_low=${id} OR user_high=${id}`, 
      getDb()`DELETE FROM blocks WHERE blocker_id=${id} OR blocked_id=${id}`,
      getDb()`UPDATE friend_requests SET status='canceled',responded_at=now() WHERE status='pending' AND (sender_id=${id} OR recipient_id=${id})`,
      getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${id} AND revoked_at IS NULL`,
      getDb()`UPDATE admin_members SET revoked_at=now() WHERE user_id=${id} AND revoked_at IS NULL`,
      getDb()`UPDATE users SET email=${`deleted+${id}@invalid.local`},password_hash=NULL,email_verified_at=NULL,status='deleted',deleted_at=now(),updated_at=now(),date_of_birth=DATE '1900-01-01' WHERE id=${id}`,
      getDb()`UPDATE user_profiles SET username=${`deleted_${id.replace(/-/g,'').slice(0,16)}`},display_name='Deleted account',bio=NULL,location=NULL,birthday_month=NULL,birthday_day=NULL,avatar_object_key=NULL,updated_at=now() WHERE user_id=${id}`,
    ]);
  }catch{return jsonError(c,503,'USER_DELETE_FAILED','Account deletion could not be completed.');}
  await auditAdmin(actor.id,'user.delete','user',id,parsed.data.reason,{});
  return c.json({status:'deleted'});
});

adminRoutes.get('/reports',async(c)=>{
  if(!check(c,'reports.read'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to review reports.');
  const {page,limit}=pageArgs(c),offset=(page-1)*limit,status=c.req.query('status')||'open';
  const allowed=['open','reviewing','resolved','dismissed','all'];if(!allowed.includes(status))return jsonError(c,422,'FILTER_INVALID','Unsupported report filter.');
  const rows=await getDb()`SELECT r.id,r.category,r.reason,r.status,r.created_at,r.admin_notes,r.target_user_id,r.group_id,r.message_id,r.evidence_attachment_id,
      reporter.username AS reporter_username,reporter.display_name AS reporter_name,target.username AS target_username,target.display_name AS target_name,
      g.name AS group_name,m.body AS reported_message,m.created_at AS message_created_at
    FROM reports r LEFT JOIN user_profiles reporter ON reporter.user_id=r.reporter_user_id
    LEFT JOIN user_profiles target ON target.user_id=r.target_user_id LEFT JOIN haiku_groups g ON g.id=r.group_id
    LEFT JOIN messages m ON m.id=r.message_id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
    WHERE (${status}='all' OR r.status=${status}) AND r.created_at>now()-interval '365 days'
    ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,r.created_at ASC LIMIT ${limit} OFFSET ${offset}`;
  await auditAdmin(c.get('user').id,'reports.read','reports',null,undefined,{status,page});
  return c.json({reports:rows,pagination:{page,limit}});
});

adminRoutes.patch('/reports/:reportId',async(c)=>{
  if(!check(c,'reports.resolve'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to update reports.');
  const actor=c.get('user');
  const parsed=await parseJson(c,z.object({status:z.enum(['reviewing','resolved','dismissed']),notes:z.string().trim().max(2000).optional()}).strict());if('response' in parsed)return parsed.response;
  const rows=await getDb()`UPDATE reports SET status=${parsed.data.status},admin_notes=${parsed.data.notes??null},reviewed_by=${actor.id},reviewed_at=now()
    WHERE id=${c.req.param('reportId')} AND status IN ('open','reviewing') RETURNING id,status`;
  if(!rows.length)return jsonError(c,404,'REPORT_NOT_OPEN','Report not found or already closed.');
  await auditAdmin(actor.id,'report.update','report',c.req.param('reportId'),parsed.data.notes, {status:parsed.data.status});
  return c.json({report:rows[0]});
});

adminRoutes.get('/groups',async(c)=>{
  if(!check(c,'groups.read'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to view groups.');
  const {page,limit}=pageArgs(c),offset=(page-1)*limit,q=(c.req.query('q')||'').trim().slice(0,80),like=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
  const rows=await getDb()`SELECT g.id,g.name,g.owner_id,g.created_at,g.updated_at,g.suspended_at,g.suspension_reason,
      (SELECT count(*)::int FROM group_members gm WHERE gm.group_id=g.id AND gm.left_at IS NULL) AS member_count,
      p.username AS owner_username,p.display_name AS owner_name
    FROM haiku_groups g LEFT JOIN user_profiles p ON p.user_id=g.owner_id
    WHERE (${q}='' OR g.name ILIKE ${like} ESCAPE '\\') ORDER BY g.updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
  await auditAdmin(c.get('user').id,'groups.read','groups',null,undefined,{page,qLength:q.length});
  return c.json({groups:rows,pagination:{page,limit}});
});

adminRoutes.post('/groups/:groupId/suspend',async(c)=>{
  if(!check(c,'groups.manage'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to moderate groups.');
  const actor=c.get('user');
  const parsed=await parseJson(c,z.object({reason:z.string().trim().min(5).max(500)}).strict());if('response' in parsed)return parsed.response;
  const rows=await getDb()`UPDATE haiku_groups SET suspended_at=now(),suspension_reason=${parsed.data.reason},updated_at=now()
    WHERE id=${c.req.param('groupId')} AND suspended_at IS NULL RETURNING id`;
  if(!rows.length)return jsonError(c,404,'GROUP_NOT_FOUND','Active group not found.');
  await getDb()`UPDATE group_invite_links SET revoked_at=now() WHERE group_id=${c.req.param('groupId')} AND revoked_at IS NULL`;
  await auditAdmin(actor.id,'group.suspend','group',c.req.param('groupId'),parsed.data.reason,{});
  return c.json({status:'suspended'});
});

adminRoutes.post('/groups/:groupId/restore',async(c)=>{
  if(!check(c,'groups.manage'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to restore groups.');
  const actor=c.get('user');
  const rows=await getDb()`UPDATE haiku_groups SET suspended_at=NULL,suspension_reason=NULL,updated_at=now() WHERE id=${c.req.param('groupId')} AND suspended_at IS NOT NULL RETURNING id`;
  if(!rows.length)return jsonError(c,404,'GROUP_NOT_SUSPENDED','Suspended group not found.');
  await auditAdmin(actor.id,'group.restore','group',c.req.param('groupId'),undefined,{});
  return c.json({status:'active'});
});

adminRoutes.get('/conversations/:conversationId/messages',async(c)=>{
  const actor=c.get('user'),admin=c.get('admin');
  // Product owner only: private-content access is narrower than ordinary moderation.
  if(admin.role!=='owner')return jsonError(c,403,'OWNER_REQUIRED','Only the designated owner can view private conversation content.');
  const id=c.req.param('conversationId');
  const rows=await getDb()`SELECT m.id,m.sender_id,m.message_type,m.body,m.attachment_id,m.created_at,m.edited_at,m.expires_at,p.username,p.display_name
    FROM messages m LEFT JOIN user_profiles p ON p.user_id=m.sender_id
    WHERE m.conversation_id=${id} AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
    ORDER BY m.created_at DESC LIMIT 100`;
  await auditAdmin(actor.id,'conversation.messages.read','conversation',id,'Owner access to active content',{rowCount:rows.length});
  return c.json({messages:rows,retention:'Expired and deleted content is excluded and is not recoverable through this endpoint.'});
});

adminRoutes.get('/media/:attachmentId',async(c)=>{
  const actor=c.get('user'),admin=c.get('admin');
  if(admin.role!=='owner'&&!check(c,'reports.read'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to review evidence.');
  const id=c.req.param('attachmentId');
  const rows=await getDb()`SELECT a.object_key,a.mime_type,a.purpose,a.expires_at,a.status,
      r.id AS report_id,m.id AS message_id,s.id AS story_id
    FROM attachments a LEFT JOIN reports r ON r.evidence_attachment_id=a.id
    LEFT JOIN messages m ON m.attachment_id=a.id LEFT JOIN stories s ON s.attachment_id=a.id
    WHERE a.id=${id} AND a.status='ready' AND (a.expires_at IS NULL OR a.expires_at>now()) LIMIT 1`;
  if(!rows.length)return jsonError(c,404,'MEDIA_NOT_FOUND','Evidence is unavailable.');
  const item=rows[0] as {object_key:string;mime_type:string;purpose:string;expires_at:Date|string|null;status:string;report_id:string|null;message_id:string|null;story_id:string|null};
  if(admin.role!=='owner'&&(item.purpose!=='report'||!item.report_id))return jsonError(c,404,'MEDIA_NOT_FOUND','Evidence is unavailable.');
  await auditAdmin(actor.id,'media.review','attachment',id,undefined,{purpose:item.purpose,reportId:item.report_id});
  try{return c.json(await getStorage().downloadUrl(item.object_key,process.env.API_PUBLIC_URL||new URL(c.req.url).origin));}catch{return jsonError(c,503,'MEDIA_UNAVAILABLE','Media storage is unavailable.');}
});

adminRoutes.get('/roles',async(c)=>{
  if(c.get('admin').role!=='owner')return jsonError(c,403,'OWNER_REQUIRED','Only the owner can manage administrator roles.');
  const rows=await getDb()`SELECT m.user_id,m.role_name,m.granted_at,m.revoked_at,p.username,p.display_name,u.email
    FROM admin_members m JOIN users u ON u.id=m.user_id JOIN user_profiles p ON p.user_id=m.user_id ORDER BY m.granted_at DESC LIMIT 500`;
  await auditAdmin(c.get('user').id,'admins.list','admin_members',null,undefined,{});
  return c.json({admins:rows});
});

adminRoutes.post('/roles',async(c)=>{
  const actor=c.get('user');if(actor && c.get('admin').role!=='owner')return jsonError(c,403,'OWNER_REQUIRED','Only the owner can grant administrator access.');
  const parsed=await parseJson(c,z.object({userId:z.string().uuid(),role:z.enum(['moderator','support','analyst'])}).strict());if('response' in parsed)return parsed.response;
  const target=await getDb()`SELECT id FROM users WHERE id=${parsed.data.userId} AND status='active' AND email_verified_at IS NOT NULL AND deleted_at IS NULL LIMIT 1`;
  if(!target.length)return jsonError(c,404,'USER_NOT_FOUND','Choose an active, verified account.');
  await getDb()`INSERT INTO admin_members(user_id,role_name,granted_by,revoked_at) VALUES (${parsed.data.userId},${parsed.data.role},${actor.id},NULL)
    ON CONFLICT(user_id) DO UPDATE SET role_name=${parsed.data.role},granted_by=${actor.id},granted_at=now(),revoked_at=NULL`;
  await auditAdmin(actor.id,'admin.grant','admin_member',parsed.data.userId,undefined,{role:parsed.data.role});
  return c.json({status:'granted',userId:parsed.data.userId,role:parsed.data.role},201);
});

adminRoutes.delete('/roles/:userId',async(c)=>{
  const actor=c.get('user');if(c.get('admin').role!=='owner')return jsonError(c,403,'OWNER_REQUIRED','Only the owner can revoke administrator access.');
  if(c.req.param('userId')===actor.id)return jsonError(c,409,'SELF_REVOKE','Transfer ownership before revoking your own access.');
  const rows=await getDb()`UPDATE admin_members SET revoked_at=now() WHERE user_id=${c.req.param('userId')} AND revoked_at IS NULL RETURNING user_id`;
  if(!rows.length)return jsonError(c,404,'ADMIN_NOT_FOUND','Active administrator not found.');
  await auditAdmin(actor.id,'admin.revoke','admin_member',c.req.param('userId'),undefined,{});
  return c.json({status:'revoked'});
});

adminRoutes.get('/audit',async(c)=>{
  if(!check(c,'audit.read'))return jsonError(c,403,'PERMISSION_DENIED','You do not have permission to view audit logs.');
  const {page,limit}=pageArgs(c),offset=(page-1)*limit;
  const rows=await getDb()`SELECT a.id,a.admin_user_id,a.action,a.entity_type,a.entity_id,a.reason,a.metadata,a.created_at,p.username,p.display_name
    FROM admin_audit_events a LEFT JOIN user_profiles p ON p.user_id=a.admin_user_id ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return c.json({events:rows,pagination:{page,limit}});
});
