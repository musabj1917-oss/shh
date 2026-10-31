import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { reportSchema } from '../contracts.js';
import { getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rate-limit.js';
import type { ApiEnv } from '../types.js';

export const reportRoutes = new Hono<ApiEnv>();
reportRoutes.use('*',requireUser);

reportRoutes.post('/',async(c)=>{
  const limited=await enforceRateLimit(c,'report-submit',10,3600);if(limited)return limited;
  const user=c.get('user');
  const parsed=await parseJson(c,reportSchema);if('response' in parsed)return parsed.response;
  const input=parsed.data;
  if(input.targetUserId===user.id)return jsonError(c,422,'REPORT_SELF','You cannot report your own account.');
  if(input.targetUserId){const target=await getDb()`SELECT 1 FROM users WHERE id=${input.targetUserId} AND deleted_at IS NULL LIMIT 1`;if(!target.length)return jsonError(c,404,'REPORT_TARGET_NOT_FOUND','Report target not found.');}
  if(input.groupId){const group=await getDb()`SELECT 1 FROM haiku_groups WHERE id=${input.groupId} LIMIT 1`;if(!group.length)return jsonError(c,404,'REPORT_TARGET_NOT_FOUND','Report target not found.');}
  if(input.messageId){
    const message=await getDb()`SELECT m.id FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id
      WHERE m.id=${input.messageId} AND cm.user_id=${user.id} AND cm.left_at IS NULL AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now()) LIMIT 1`;
    if(!message.length)return jsonError(c,404,'REPORT_TARGET_NOT_FOUND','That message is unavailable.');
  }
  if(input.evidenceAttachmentId){const evidence=await getDb()`SELECT 1 FROM attachments WHERE id=${input.evidenceAttachmentId} AND owner_id=${user.id} AND purpose='report' AND status='ready' LIMIT 1`;if(!evidence.length)return jsonError(c,422,'REPORT_EVIDENCE_INVALID','Evidence must be uploaded with the report attachment flow.');}
  const id=randomUUID();
  await getDb()`INSERT INTO reports(id,reporter_user_id,target_user_id,group_id,message_id,category,reason,evidence_attachment_id)
    VALUES (${id},${user.id},${input.targetUserId ?? null},${input.groupId ?? null},${input.messageId ?? null},${input.category},${input.reason ?? null},${input.evidenceAttachmentId ?? null})`;
  return c.json({report:{id,status:'open',createdAt:new Date().toISOString()},message:'Thank you. Your report was submitted for review.'},201);
});

reportRoutes.get('/mine',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`SELECT id,category,status,created_at,reviewed_at FROM reports WHERE reporter_user_id=${user.id} AND created_at>now()-interval '365 days' ORDER BY created_at DESC LIMIT 100`;
  return c.json({reports:rows});
});
