import { randomBytes, randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rate-limit.js';
import { createNotification } from '../services/notifications.js';
import { sha256 } from '../security.js';
import type { ApiEnv } from '../types.js';

export const groupRoutes = new Hono<ApiEnv>();
groupRoutes.use('*', requireUser);
const uuid = z.string().uuid();
const createGroupSchema = z.object({ name:z.string().trim().min(1).max(80), memberIds:z.array(uuid).max(99).default([]) }).strict();
const addMembersSchema = z.object({ userIds:z.array(uuid).min(1).max(99) }).strict();
const inviteSchema = z.object({ expiresInHours:z.number().int().min(1).max(720).default(168), maxUses:z.number().int().min(1).max(500).default(25), approvalRequired:z.boolean().default(false) }).strict();
const patchGroupSchema=z.object({name:z.string().trim().min(1).max(80).optional(),photoAttachmentId:z.string().uuid().nullable().optional()}).strict().refine(value=>Object.keys(value).length>0,'Provide a group name or photo change.');

async function roleFor(userId:string, groupId:string) {
  const rows=await getDb()`SELECT gm.role FROM group_members gm JOIN haiku_groups g ON g.id=gm.group_id WHERE gm.user_id=${userId} AND gm.group_id=${groupId} AND gm.left_at IS NULL AND g.suspended_at IS NULL LIMIT 1`;
  return (rows[0] as {role:string}|undefined)?.role || null;
}
async function groupConversation(groupId:string) {
  const rows=await getDb()`SELECT id,conversation_id,name,owner_id FROM haiku_groups WHERE id=${groupId} AND suspended_at IS NULL LIMIT 1`;
  return rows[0] as {id:string;conversation_id:string;name:string;owner_id:string}|undefined;
}
function isUuid(value:string) { return /^[0-9a-f-]{36}$/i.test(value); }

// Group creation, group metadata, and membership are normalized in Neon.
groupRoutes.get('/', async (c) => {
  const user=c.get('user');
  const rows=await getDb()`SELECT g.id,g.conversation_id,g.name,g.photo_object_key,g.owner_id,gm.role,gm.joined_at,
      (SELECT count(*)::int FROM group_members x WHERE x.group_id=g.id AND x.left_at IS NULL) AS member_count,
      (SELECT m.body FROM messages m WHERE m.conversation_id=g.conversation_id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now()) ORDER BY m.created_at DESC LIMIT 1) AS last_message
    FROM group_members gm JOIN haiku_groups g ON g.id=gm.group_id
    WHERE gm.user_id=${user.id} AND gm.left_at IS NULL AND g.suspended_at IS NULL ORDER BY g.updated_at DESC LIMIT 100`;
  return c.json({ groups:rows });
});

groupRoutes.post('/', async (c) => {
  const limited=await enforceRateLimit(c,'group-create',10,86400);if(limited)return limited;
  const user=c.get('user');
  const parsed=await parseJson(c,createGroupSchema); if('response' in parsed)return parsed.response;
  const ids=[...new Set(parsed.data.memberIds)].filter(id=>id!==user.id);
  if(ids.length!==parsed.data.memberIds.filter(id=>id!==user.id).length)return jsonError(c,422,'DUPLICATE_MEMBER','Remove duplicate group members.');
  if(ids.length){
    const rows=await getDb()`SELECT u.id FROM users u WHERE u.id=ANY(${ids}::uuid[]) AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=${user.id}))`;
    if(rows.length!==ids.length)return jsonError(c,422,'GROUP_MEMBER_INVALID','One or more selected people are unavailable or blocked.');
  }
  const groupId=randomUUID(), conversationId=randomUUID();
  try{
    const queries=[
      getDb()`INSERT INTO conversations(id,kind,created_by) VALUES (${conversationId},'group',${user.id})`,
      getDb()`INSERT INTO haiku_groups(id,conversation_id,name,owner_id) VALUES (${groupId},${conversationId},${parsed.data.name},${user.id})`,
      getDb()`INSERT INTO conversation_members(conversation_id,user_id) VALUES (${conversationId},${user.id})`,
      getDb()`INSERT INTO group_members(group_id,user_id,role,added_by) VALUES (${groupId},${user.id},'owner',${user.id})`,
    ];
    for(const id of ids){queries.push(getDb()`INSERT INTO conversation_members(conversation_id,user_id) VALUES (${conversationId},${id})`);queries.push(getDb()`INSERT INTO group_members(group_id,user_id,role,added_by) VALUES (${groupId},${id},'member',${user.id})`);}
    await getDb().transaction(queries);
    for(const id of ids){try{await createNotification(id,'group_membership',user.id,groupId,{name:parsed.data.name});}catch{}}
    return c.json({group:{id:groupId,conversationId,name:parsed.data.name,ownerId:user.id,memberCount:ids.length+1}},201);
  }catch{return jsonError(c,503,'GROUP_CREATE_FAILED','The group could not be created.');}
});

groupRoutes.get('/:groupId',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId');
  const role=await roleFor(user.id,groupId); if(!role)return jsonError(c,404,'GROUP_NOT_FOUND','Group not found.');
  const rows=await getDb()`SELECT g.id,g.name,g.photo_object_key,g.owner_id,g.created_at,g.updated_at,
      (SELECT count(*)::int FROM group_members m WHERE m.group_id=g.id AND m.left_at IS NULL) AS member_count
    FROM haiku_groups g WHERE g.id=${groupId} LIMIT 1`;
  return c.json({group:rows[0],role});
});

groupRoutes.patch('/:groupId',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId'),role=await roleFor(user.id,groupId);
  if(!role||!['owner','admin'].includes(role))return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only the owner or an admin can change group details.');
  const parsed=await parseJson(c,patchGroupSchema);if('response' in parsed)return parsed.response;
  let photoKey:string|null=null;
  if(parsed.data.photoAttachmentId){
    const rows=await getDb()`SELECT object_key FROM attachments WHERE id=${parsed.data.photoAttachmentId} AND owner_id=${user.id} AND purpose='group' AND media_type='image' AND status='ready' LIMIT 1`;
    if(!rows.length)return jsonError(c,422,'GROUP_PHOTO_INVALID','Upload a valid group photo first.');
    photoKey=String((rows[0] as {object_key:string}).object_key);
  }
  const rows=await getDb()`UPDATE haiku_groups SET
      name=CASE WHEN ${parsed.data.name!==undefined} THEN ${parsed.data.name??null} ELSE name END,
      photo_object_key=CASE WHEN ${parsed.data.photoAttachmentId!==undefined} THEN ${photoKey} ELSE photo_object_key END,
      updated_at=now() WHERE id=${groupId} AND suspended_at IS NULL RETURNING id,name,photo_object_key,owner_id,updated_at`;
  if(!rows.length)return jsonError(c,404,'GROUP_NOT_FOUND','Group not found or suspended.');
  return c.json({group:rows[0]});
});

groupRoutes.get('/:groupId/members',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId');
  if(!await roleFor(user.id,groupId))return jsonError(c,404,'GROUP_NOT_FOUND','Group not found.');
  const rows=await getDb()`SELECT gm.user_id AS id,gm.role,gm.joined_at,p.username,p.display_name,p.avatar_object_key
    FROM group_members gm JOIN user_profiles p ON p.user_id=gm.user_id JOIN users u ON u.id=gm.user_id
    WHERE gm.group_id=${groupId} AND gm.left_at IS NULL AND u.status='active' ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,p.display_name LIMIT 100`;
  return c.json({members:rows});
});

groupRoutes.post('/:groupId/members',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId');
  const role=await roleFor(user.id,groupId); if(!role||!['owner','admin'].includes(role))return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only the group owner or an admin can add members.');
  const parsed=await parseJson(c,addMembersSchema); if('response' in parsed)return parsed.response;
  const group=await groupConversation(groupId); if(!group)return jsonError(c,404,'GROUP_NOT_FOUND','Group not found.');
  const ids=[...new Set(parsed.data.userIds)].filter(id=>id!==user.id);
  if(ids.length!==parsed.data.userIds.filter(id=>id!==user.id).length)return jsonError(c,422,'DUPLICATE_MEMBER','Remove duplicate users.');
  const available=await getDb()`SELECT u.id FROM users u WHERE u.id=ANY(${ids}::uuid[]) AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=${groupId} AND gm.left_at IS NULL
      WHERE (b.blocker_id=u.id AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=u.id))`;
  if(available.length!==ids.length)return jsonError(c,422,'GROUP_MEMBER_INVALID','One or more people are unavailable or blocked by a group member.');
  const queries=[];
  for(const id of ids){queries.push(getDb()`INSERT INTO group_members(group_id,user_id,role,added_by) VALUES (${groupId},${id},'member',${user.id}) ON CONFLICT(group_id,user_id) DO UPDATE SET left_at=NULL,role='member',joined_at=now(),added_by=${user.id}`);queries.push(getDb()`INSERT INTO conversation_members(conversation_id,user_id) VALUES (${group.conversation_id},${id}) ON CONFLICT(conversation_id,user_id) DO UPDATE SET left_at=NULL,joined_at=now()`);}
  await getDb().transaction(queries);
  for(const id of ids){try{await createNotification(id,'group_membership',user.id,groupId,{name:group.name});}catch{}}
  return c.json({added:ids.length});
});

groupRoutes.delete('/:groupId/members/:memberId',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId'),memberId=c.req.param('memberId');
  const group=await groupConversation(groupId);
  if(!group||group.owner_id!==user.id)return jsonError(c,403,'GROUP_OWNER_REQUIRED','Only the owner can remove existing members.');
  if(memberId===user.id)return jsonError(c,409,'OWNER_CANNOT_REMOVE_SELF','Transfer group ownership before leaving.');
  const rows=await getDb()`WITH removed AS (
      UPDATE group_members SET left_at=now() WHERE group_id=${groupId} AND user_id=${memberId} AND left_at IS NULL AND role<>'owner' RETURNING user_id
    ), left_conversation AS (
      UPDATE conversation_members cm SET left_at=now() FROM removed
      WHERE cm.conversation_id=${group.conversation_id} AND cm.user_id=removed.user_id AND cm.left_at IS NULL RETURNING cm.user_id
    ) SELECT user_id FROM left_conversation`;
  if(!rows.length)return jsonError(c,404,'GROUP_MEMBER_NOT_FOUND','Group member not found.');
  return c.json({status:'removed'});
});

groupRoutes.put('/:groupId/admins/:memberId',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId'),memberId=c.req.param('memberId');
  const group=await groupConversation(groupId); if(!group||group.owner_id!==user.id)return jsonError(c,403,'GROUP_OWNER_REQUIRED','Only the owner can appoint administrators.');
  const rows=await getDb()`UPDATE group_members SET role='admin' WHERE group_id=${groupId} AND user_id=${memberId} AND left_at IS NULL AND role='member' RETURNING user_id`;
  if(!rows.length)return jsonError(c,404,'GROUP_MEMBER_NOT_FOUND','Active member not found.');
  return c.json({status:'admin_assigned'});
});

groupRoutes.delete('/:groupId/admins/:memberId',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId'),memberId=c.req.param('memberId');
  const group=await groupConversation(groupId); if(!group||group.owner_id!==user.id)return jsonError(c,403,'GROUP_OWNER_REQUIRED','Only the owner can change administrator roles.');
  const rows=await getDb()`UPDATE group_members SET role='member' WHERE group_id=${groupId} AND user_id=${memberId} AND left_at IS NULL AND role='admin' RETURNING user_id`;
  if(!rows.length)return jsonError(c,404,'GROUP_ADMIN_NOT_FOUND','Group administrator not found.');
  return c.json({status:'admin_removed'});
});

groupRoutes.put('/:groupId/owner/:memberId',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId'),nextOwner=c.req.param('memberId');
  const group=await groupConversation(groupId); if(!group||group.owner_id!==user.id)return jsonError(c,403,'GROUP_OWNER_REQUIRED','Only the current owner can transfer ownership.');
  const member=await roleFor(nextOwner,groupId); if(!member)return jsonError(c,404,'GROUP_MEMBER_NOT_FOUND','The new owner must already be a group member.');
  await getDb().transaction([
    getDb()`UPDATE group_members SET role='admin' WHERE group_id=${groupId} AND user_id=${user.id} AND role='owner'`,
    getDb()`UPDATE group_members SET role='owner' WHERE group_id=${groupId} AND user_id=${nextOwner} AND left_at IS NULL`,
    getDb()`UPDATE haiku_groups SET owner_id=${nextOwner},updated_at=now() WHERE id=${groupId}`,
  ]);
  return c.json({status:'ownership_transferred',ownerId:nextOwner});
});

groupRoutes.get('/:groupId/invites',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId');
  const role=await roleFor(user.id,groupId);
  if(!role||!['owner','admin'].includes(role))return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only the owner or an admin can manage invitation links.');
  const limited=await enforceRateLimit(c,'group-invite-list',60,3600);if(limited)return limited;
  const rows=await getDb()`SELECT id,created_at,expires_at,max_uses,uses,approval_required
    FROM group_invite_links WHERE group_id=${groupId} AND revoked_at IS NULL AND expires_at>now() AND uses<max_uses
    ORDER BY created_at DESC LIMIT 50`;
  return c.json({invites:rows});
});

groupRoutes.post('/:groupId/invites',async(c)=>{
  const limited=await enforceRateLimit(c,'group-invite',20,3600);if(limited)return limited;
  const user=c.get('user'),groupId=c.req.param('groupId');
  const role=await roleFor(user.id,groupId); if(!role||!['owner','admin'].includes(role))return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only the owner or an admin can create invitation links.');
  const parsed=await parseJson(c,inviteSchema); if('response' in parsed)return parsed.response;
  const token=randomBytes(32).toString('base64url'),id=randomUUID();
  try{
    const rows=await getDb()`INSERT INTO group_invite_links(id,group_id,token_hash,created_by,expires_at,max_uses,approval_required)
      SELECT ${id},g.id,${sha256(token)},${user.id},now()+(${parsed.data.expiresInHours}*interval '1 hour'),${parsed.data.maxUses},${parsed.data.approvalRequired}
      FROM haiku_groups g WHERE g.id=${groupId} AND g.suspended_at IS NULL RETURNING id`;
    if(!rows.length)return jsonError(c,404,'GROUP_NOT_FOUND','Group not found or suspended.');
  }catch{return jsonError(c,503,'INVITE_CREATE_FAILED','The invitation link could not be created.');}
  return c.json({invite:{id,token,expiresInHours:parsed.data.expiresInHours,maxUses:parsed.data.maxUses,approvalRequired:parsed.data.approvalRequired}},201);
});

groupRoutes.delete('/:groupId/invites/:inviteId',async(c)=>{
  const limited=await enforceRateLimit(c,'group-invite-revoke',30,3600);if(limited)return limited;
  const user=c.get('user'),groupId=c.req.param('groupId');
  const role=await roleFor(user.id,groupId); if(!role||!['owner','admin'].includes(role))return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only the owner or an admin can revoke invitation links.');
  const rows=await getDb()`UPDATE group_invite_links SET revoked_at=now() WHERE id=${c.req.param('inviteId')} AND group_id=${groupId} AND revoked_at IS NULL RETURNING id`;
  if(!rows.length)return jsonError(c,404,'INVITE_NOT_FOUND','Invitation link is no longer active.');
  return c.json({status:'revoked'});
});

groupRoutes.post('/join/:token',async(c)=>{
  const limited=await enforceRateLimit(c,'group-join',20,3600);if(limited)return limited;
  const user=c.get('user'),token=c.req.param('token');
  if(token.length<32||token.length>128)return jsonError(c,404,'INVITE_INVALID','This invitation is invalid or expired.');
  const existing=await getDb()`SELECT 1 FROM group_invite_links l JOIN group_members gm ON gm.group_id=l.group_id
    WHERE l.token_hash=${sha256(token)} AND gm.user_id=${user.id} AND gm.left_at IS NULL LIMIT 1`;
  if(existing.length)return jsonError(c,409,'ALREADY_MEMBER','You are already in this group.');
  const invite=await getDb()`SELECT l.id,l.group_id,l.approval_required,g.conversation_id,g.name FROM group_invite_links l JOIN haiku_groups g ON g.id=l.group_id
    WHERE l.token_hash=${sha256(token)} AND l.revoked_at IS NULL AND l.expires_at>now() AND l.uses<l.max_uses AND g.suspended_at IS NULL LIMIT 1`;
  if(!invite.length)return jsonError(c,404,'INVITE_INVALID','This invitation is invalid, expired, or no longer has places.');
  const value=invite[0] as {id:string;group_id:string;approval_required:boolean;conversation_id:string;name:string};
  const blocked=await getDb()`SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=${value.group_id} AND gm.left_at IS NULL
    WHERE (b.blocker_id=${user.id} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${user.id}) LIMIT 1`;
  if(blocked.length)return jsonError(c,403,'BLOCKED_GROUP_MEMBER','A group member has blocked you or is blocked by you.');
  if(value.approval_required){
    const pending=await getDb()`SELECT 1 FROM group_join_requests WHERE group_id=${value.group_id} AND user_id=${user.id} AND status='pending' LIMIT 1`;
    if(pending.length)return jsonError(c,409,'JOIN_REQUEST_PENDING','You already have a pending request for this group.');
    const requestId=randomUUID();
    try{
      const requested=await getDb()`WITH claimed AS (
          UPDATE group_invite_links l SET uses=l.uses+1
          FROM haiku_groups g
          WHERE l.id=${value.id} AND l.group_id=g.id AND l.approval_required=true AND l.revoked_at IS NULL
            AND l.expires_at>now() AND l.uses<l.max_uses AND g.suspended_at IS NULL
            AND NOT EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=l.group_id AND gm.user_id=${user.id} AND gm.left_at IS NULL)
            AND NOT EXISTS(SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=l.group_id AND gm.left_at IS NULL
              WHERE (b.blocker_id=${user.id} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${user.id}))
            AND NOT EXISTS(SELECT 1 FROM group_join_requests r WHERE r.group_id=l.group_id AND r.user_id=${user.id} AND r.status='pending')
          RETURNING l.id AS invite_id,l.group_id
        ), created AS (
          INSERT INTO group_join_requests(id,group_id,invite_id,user_id)
          SELECT ${requestId},claimed.group_id,claimed.invite_id,${user.id} FROM claimed
          RETURNING id,group_id,invite_id
        ) SELECT created.id,claimed.group_id,g.name FROM created JOIN claimed ON claimed.invite_id=created.invite_id
          JOIN haiku_groups g ON g.id=claimed.group_id`;
      if(!requested.length){const pending=await getDb()`SELECT 1 FROM group_join_requests WHERE group_id=${value.group_id} AND user_id=${user.id} AND status='pending' LIMIT 1`;if(pending.length)return jsonError(c,409,'JOIN_REQUEST_PENDING','You already have a pending request for this group.');return jsonError(c,404,'INVITE_INVALID','This invitation is invalid, expired, or no longer available.');}
      try{const admins=await getDb()`SELECT user_id FROM group_members WHERE group_id=${value.group_id} AND left_at IS NULL AND role IN ('owner','admin')`;for(const admin of admins){const adminId=String((admin as {user_id:string}).user_id);if(adminId!==user.id)try{await createNotification(adminId,'group_invite',user.id,value.group_id,{groupName:value.name,requestId});}catch{}}}catch{}
      return c.json({status:'approval_required',requestId,groupName:value.name},202);
    }catch(error){
      if((error as {code?:string})?.code==='23505')return jsonError(c,409,'JOIN_REQUEST_PENDING','You already have a pending request for this group.');
      return jsonError(c,503,'JOIN_REQUEST_FAILED','Your request could not be submitted.');
    }
  }
  try{
    const joined=await getDb()`WITH claimed AS (
        UPDATE group_invite_links l SET uses=l.uses+1
        FROM haiku_groups g
        WHERE l.id=${value.id} AND l.group_id=g.id AND l.approval_required=false AND l.revoked_at IS NULL
          AND l.expires_at>now() AND l.uses<l.max_uses AND g.suspended_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=l.group_id AND gm.user_id=${user.id} AND gm.left_at IS NULL)
          AND NOT EXISTS(SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=l.group_id AND gm.left_at IS NULL
            WHERE (b.blocker_id=${user.id} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${user.id}))
        RETURNING l.group_id
      ), member AS (
        INSERT INTO group_members(group_id,user_id,role,added_by)
        SELECT claimed.group_id,${user.id},'member',NULL FROM claimed
        ON CONFLICT(group_id,user_id) DO UPDATE SET left_at=NULL,role='member',joined_at=now()
        RETURNING group_id,user_id
      ), conversation_member AS (
        INSERT INTO conversation_members(conversation_id,user_id)
        SELECT g.conversation_id,member.user_id FROM member JOIN haiku_groups g ON g.id=member.group_id
        ON CONFLICT(conversation_id,user_id) DO UPDATE SET left_at=NULL,joined_at=now()
        RETURNING conversation_id,user_id
      ) SELECT member.group_id FROM member JOIN conversation_member ON conversation_member.user_id=member.user_id`;
    if(!joined.length)return jsonError(c,404,'INVITE_INVALID','This invitation is invalid, expired, or no longer available.');
    return c.json({status:'joined',groupId:String((joined[0] as {group_id:string}).group_id)},201);
  }catch{return jsonError(c,503,'GROUP_JOIN_FAILED','You could not join this group. Please retry.');}
});

groupRoutes.get('/:groupId/join-requests',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId'),role=await roleFor(user.id,groupId);
  if(!role||!['owner','admin'].includes(role))return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only the owner or an admin can review requests.');
  const rows=await getDb()`SELECT r.id,r.created_at,p.user_id AS user_id,p.username,p.display_name FROM group_join_requests r
    JOIN user_profiles p ON p.user_id=r.user_id WHERE r.group_id=${groupId} AND r.status='pending' ORDER BY r.created_at LIMIT 100`;
  return c.json({requests:rows});
});

groupRoutes.post('/:groupId/join-requests/:requestId/accept',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId'),role=await roleFor(user.id,groupId);
  if(!role||!['owner','admin'].includes(role))return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only the owner or an admin can accept requests.');
  const group=await groupConversation(groupId);if(!group)return jsonError(c,404,'GROUP_NOT_FOUND','Group not found.');
  const rows=await getDb()`WITH accepted AS (
      UPDATE group_join_requests SET status='accepted',resolved_at=now()
      WHERE id=${c.req.param('requestId')} AND group_id=${groupId} AND status='pending'
        AND EXISTS(SELECT 1 FROM users u WHERE u.id=group_join_requests.user_id AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=group_join_requests.group_id AND gm.left_at IS NULL
          WHERE (b.blocker_id=group_join_requests.user_id AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=group_join_requests.user_id))
        AND (invite_id IS NULL OR EXISTS(SELECT 1 FROM group_invite_links l WHERE l.id=group_join_requests.invite_id AND l.revoked_at IS NULL AND l.expires_at>now()))
      RETURNING user_id
    ), member AS (
      INSERT INTO group_members(group_id,user_id,role,added_by)
        SELECT ${groupId},accepted.user_id,'member',${user.id} FROM accepted
        ON CONFLICT(group_id,user_id) DO UPDATE SET left_at=NULL,role='member',joined_at=now()
        RETURNING user_id
    ), conversation_member AS (
      INSERT INTO conversation_members(conversation_id,user_id)
        SELECT ${group.conversation_id},member.user_id FROM member
        ON CONFLICT(conversation_id,user_id) DO UPDATE SET left_at=NULL,joined_at=now()
        RETURNING user_id
    ) SELECT accepted.user_id FROM accepted JOIN conversation_member USING(user_id)`;
  if(!rows.length)return jsonError(c,404,'JOIN_REQUEST_NOT_FOUND','Request is no longer available.');
  const newMember=String((rows[0] as {user_id:string}).user_id);
  return c.json({status:'accepted',userId:newMember});
});

groupRoutes.post('/:groupId/join-requests/:requestId/reject',async(c)=>{
  const user=c.get('user'),groupId=c.req.param('groupId'),role=await roleFor(user.id,groupId);
  if(!role||!['owner','admin'].includes(role))return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only the owner or an admin can reject requests.');
  const rows=await getDb()`UPDATE group_join_requests SET status='rejected',resolved_at=now() WHERE id=${c.req.param('requestId')} AND group_id=${groupId} AND status='pending' RETURNING id`;
  if(!rows.length)return jsonError(c,404,'JOIN_REQUEST_NOT_FOUND','Request is no longer available.');
  return c.json({status:'rejected'});
});
