import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { getDb } from '../db.js';
import { envInt } from '../config.js';
import { sha256 } from '../security.js';
import { getStorage } from '../services/storage.js';

export const internalRoutes=new Hono();
function validCronSecret(header:string,expected:string){
  const supplied=header.startsWith('Bearer ')?header.slice(7):'';
  const left=Buffer.from(sha256(supplied)),right=Buffer.from(sha256(expected));
  return supplied.length>0&&timingSafeEqual(left,right);
}

internalRoutes.post('/cleanup',async(c)=>{
  const secret=process.env.CRON_SECRET;
  if(!secret||!validCronSecret(c.req.header('authorization')||'',secret))return c.json({error:{code:'CRON_UNAUTHORIZED',message:'Not authorized.'}},401);
  const runId=randomUUID();
  await getDb()`INSERT INTO cleanup_runs(id,status) VALUES (${runId},'running')`;
  let deletedObjects=0,deletedAccounts=0,deletedMessages=0,partial=false;
  try{
    const cleared=await getDb()`SELECT haiku_clear_expired_text_messages(1000) AS changed`;
    deletedMessages+=Number((cleared[0] as {changed:number}|undefined)?.changed||0);
    const otherExpired=await getDb()`WITH due AS (SELECT id,attachment_id FROM messages WHERE expires_at IS NOT NULL AND expires_at<=now() AND deleted_at IS NULL ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED)
      UPDATE messages m SET body=NULL,attachment_id=NULL,deleted_at=now(),deletion_kind='expired' FROM due WHERE m.id=due.id RETURNING due.attachment_id`;
    deletedMessages+=otherExpired.length;
    const expiredAttachments=await getDb()`UPDATE attachments SET expires_at=now() WHERE purpose='story' AND id IN (SELECT attachment_id FROM stories WHERE expires_at<=now() OR deleted_at IS NOT NULL) AND (expires_at IS NULL OR expires_at>now())`;
    void expiredAttachments;
    await getDb()`UPDATE stories SET deleted_at=COALESCE(deleted_at,now()) WHERE expires_at<=now() AND deleted_at IS NULL`;

    // Deletion is idempotent: a failing object delete leaves its metadata row for a later retry.
    const dueAttachments=await getDb()`SELECT id,object_key FROM attachments
      WHERE (expires_at IS NOT NULL AND expires_at<=now()) OR (status IN ('pending','failed') AND created_at<=now()-interval '24 hours')
      ORDER BY created_at LIMIT 100`;
    let storage;
    try{storage=getStorage();}catch{storage=undefined;partial=true;}
    for(const item of dueAttachments as Array<{id:string;object_key:string}>){
      try{
        if(storage)await storage.deleteObject(item.object_key);
        else {partial=true;continue;}
        await getDb()`DELETE FROM attachments WHERE id=${item.id}`;
        deletedObjects++;
      }catch{partial=true;}
    }

    const dueAccounts=await getDb()`SELECT user_id,id FROM account_deletion_requests WHERE canceled_at IS NULL AND completed_at IS NULL AND scheduled_for<=now() ORDER BY scheduled_for LIMIT 25`;
    for(const row of dueAccounts as Array<{user_id:string;id:string}>){
      const id=row.user_id;
      try{
        await getDb().transaction([
          getDb()`UPDATE messages SET body=NULL,attachment_id=NULL,deleted_at=COALESCE(deleted_at,now()),deletion_kind='account' WHERE sender_id=${id} AND deleted_at IS NULL`,
          getDb()`UPDATE stories SET deleted_at=COALESCE(deleted_at,now()) WHERE user_id=${id}`,
          getDb()`UPDATE attachments SET expires_at=now() WHERE owner_id=${id}`,
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
          getDb()`UPDATE conversation_members SET left_at=now() WHERE user_id=${id} AND left_at IS NULL`,
          getDb()`DELETE FROM friendships WHERE user_low=${id} OR user_high=${id}`,
          getDb()`DELETE FROM blocks WHERE blocker_id=${id} OR blocked_id=${id}`,
          getDb()`UPDATE friend_requests SET status='canceled',responded_at=now() WHERE status='pending' AND (sender_id=${id} OR recipient_id=${id})`,
          getDb()`UPDATE sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=${id}`,
          getDb()`UPDATE users SET email=${`deleted+${id}@invalid.local`},password_hash=NULL,email_verified_at=NULL,status='deleted',deleted_at=COALESCE(deleted_at,now()),updated_at=now(),date_of_birth=DATE '1900-01-01' WHERE id=${id} AND status<>'deleted'`,
          getDb()`UPDATE user_profiles SET username=${`deleted_${id.replace(/-/g,'').slice(0,16)}`},display_name='Deleted account',bio=NULL,location=NULL,birthday_month=NULL,birthday_day=NULL,avatar_object_key=NULL,updated_at=now() WHERE user_id=${id}`,
          getDb()`UPDATE account_deletion_requests SET completed_at=now() WHERE id=${row.id} AND completed_at IS NULL`,
        ]);
        deletedAccounts++;
      }catch{partial=true;}
    }

    const reportDays=envInt('REPORT_RETENTION_DAYS',365,30,3650);
    await getDb()`UPDATE attachments SET expires_at=now() WHERE id IN (SELECT evidence_attachment_id FROM reports WHERE created_at<now()-(${reportDays}*interval '1 day') AND evidence_attachment_id IS NOT NULL)`;
    await getDb()`DELETE FROM reports WHERE created_at<now()-(${reportDays}*interval '1 day')`;
    await getDb()`DELETE FROM email_verification_tokens WHERE expires_at<=now() OR used_at IS NOT NULL`;
    await getDb()`DELETE FROM password_reset_tokens WHERE expires_at<=now() OR used_at IS NOT NULL`;
    await getDb()`DELETE FROM sessions WHERE expires_at<=now() OR revoked_at<now()-interval '30 days'`;
    await getDb()`DELETE FROM notifications WHERE expires_at<=now()`;
    await getDb()`DELETE FROM rate_limit_buckets WHERE window_started_at<now()-interval '1 day'`;
    await getDb()`DELETE FROM admin_audit_events WHERE created_at<now()-interval '365 days'`;
    const status=partial?'partial':'succeeded';
    await getDb()`UPDATE cleanup_runs SET finished_at=now(),status=${status},deleted_objects=${deletedObjects},deleted_accounts=${deletedAccounts},deleted_messages=${deletedMessages},error_code=${partial?'RETRY_REQUIRED':null} WHERE id=${runId}`;
    return c.json({runId,status,deletedMessages,deletedObjects,deletedAccounts});
  }catch{
    await getDb()`UPDATE cleanup_runs SET finished_at=now(),status='failed',deleted_objects=${deletedObjects},deleted_accounts=${deletedAccounts},deleted_messages=${deletedMessages},error_code='CLEANUP_FAILED' WHERE id=${runId}`.catch(()=>undefined);
    return c.json({error:{code:'CLEANUP_FAILED',message:'Cleanup failed and will be retried.'}},503);
  }
});
