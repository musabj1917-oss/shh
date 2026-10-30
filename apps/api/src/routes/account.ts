import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { getDb } from '../db.js';
import { jsonError } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { sha256 } from '../security.js';
import type { ApiEnv } from '../types.js';

export const accountRoutes = new Hono<ApiEnv>();
accountRoutes.use('*',requireUser);

accountRoutes.get('/sessions',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`SELECT id,user_agent,created_at,last_seen_at,expires_at
    FROM sessions WHERE user_id=${user.id} AND revoked_at IS NULL AND expires_at>now() ORDER BY last_seen_at DESC LIMIT 50`;
  return c.json({sessions:rows});
});

accountRoutes.delete('/sessions/:sessionId',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`UPDATE sessions SET revoked_at=now() WHERE id=${c.req.param('sessionId')} AND user_id=${user.id} AND revoked_at IS NULL RETURNING id`;
  if(!rows.length)return jsonError(c,404,'SESSION_NOT_FOUND','Session not found.');
  return c.json({status:'revoked'});
});

accountRoutes.delete('/sessions',async(c)=>{
  const user=c.get('user');
  const current=(c.req.header('authorization')||'').slice(7).trim();
  await getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${user.id} AND token_hash<>${sha256(current)} AND revoked_at IS NULL`;
  return c.json({status:'other_sessions_revoked'});
});

accountRoutes.get('/deletion',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`SELECT id,scheduled_for FROM account_deletion_requests WHERE user_id=${user.id} AND canceled_at IS NULL AND completed_at IS NULL AND scheduled_for>now() ORDER BY created_at DESC LIMIT 1`;
  return c.json({request:rows[0]||null});
});

accountRoutes.post('/deletion',async(c)=>{
  const user=c.get('user');
  const existing=await getDb()`SELECT id,scheduled_for FROM account_deletion_requests WHERE user_id=${user.id} AND canceled_at IS NULL AND completed_at IS NULL LIMIT 1`;
  if(existing.length)return c.json({request:existing[0],alreadyScheduled:true});
  const raw=Number.parseInt(process.env.ACCOUNT_DELETION_GRACE_DAYS||'30',10);
  const days=Math.max(7,Math.min(90,Number.isFinite(raw)?raw:30));
  const id=randomUUID();
  const rows=await getDb()`INSERT INTO account_deletion_requests(id,user_id,scheduled_for) VALUES (${id},${user.id},now()+(${days}*interval '1 day')) RETURNING id,scheduled_for`;
  return c.json({request:rows[0],graceDays:days,warning:'When deletion completes, account data and associated media are removed where operationally possible. Copies saved outside Haiku Messenger, device caches, and backups cannot be guaranteed erased.'},201);
});

accountRoutes.delete('/deletion',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`UPDATE account_deletion_requests SET canceled_at=now() WHERE user_id=${user.id} AND canceled_at IS NULL AND completed_at IS NULL AND scheduled_for>now() RETURNING id`;
  if(!rows.length)return jsonError(c,404,'DELETION_REQUEST_NOT_FOUND','There is no pending deletion request to cancel.');
  return c.json({status:'canceled'});
});

accountRoutes.get('/export',async(c)=>{
  const user=c.get('user');
  const profile=await getDb()`SELECT p.username,p.display_name,p.bio,p.location,p.birthday_month,p.birthday_day,u.email,u.created_at
    FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${user.id} LIMIT 1`;
  const friends=await getDb()`SELECT p.username,p.display_name,f.created_at FROM friendships f
    JOIN user_profiles p ON p.user_id=CASE WHEN f.user_low=${user.id} THEN f.user_high ELSE f.user_low END
    WHERE f.user_low=${user.id} OR f.user_high=${user.id} ORDER BY p.username`;
  const settings=await getDb()`SELECT quiet_mode,notifications_enabled,sender_previews,presence_visible,read_receipts_enabled,typing_indicators_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
  const conversations=await getDb()`SELECT c.id,c.kind,g.name AS group_name,
      (SELECT p.display_name FROM conversation_members other JOIN user_profiles p ON p.user_id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL LIMIT 1) AS direct_name
    FROM conversations c JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=${user.id} AND mine.left_at IS NULL
    LEFT JOIN haiku_groups g ON g.conversation_id=c.id WHERE c.kind='group' OR NOT EXISTS(SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})) ORDER BY c.created_at DESC LIMIT 100`;
  const conversationIds=conversations.map((row)=>String((row as {id:string}).id));
  const messages=conversationIds.length ? await getDb()`SELECT id,conversation_id,message_type,body,created_at,edited_at
      FROM messages WHERE conversation_id=ANY(${conversationIds}::uuid[]) AND sender_id=${user.id} AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>now())
      ORDER BY created_at DESC LIMIT 2000` : [];
  return c.json({exportedAt:new Date().toISOString(),profile:profile[0]||null,friends,settings:settings[0]||null,conversations,messages,scope:'This limited export includes your profile, friend list, settings, and your own unexpired messages only. It excludes media bytes and messages authored by others.'});
});
