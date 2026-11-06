import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rate-limit.js';
import { getStorage, newObjectKey, verifyMediaSignature } from '../services/storage.js';
import type { ApiEnv } from '../types.js';

export const mediaRoutes = new Hono<ApiEnv>();
mediaRoutes.use('*', requireUser);

const uploadIntentSchema = z.object({
  purpose: z.enum(['message','story','avatar','report','group']),
  mediaType: z.enum(['image','video','voice']),
  mimeType: z.string().min(3).max(120),
  byteSize: z.number().int().positive().max(50 * 1024 * 1024),
  conversationId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.purpose === 'avatar' && value.mediaType !== 'image') ctx.addIssue({ code:'custom', message:'Profile pictures must be images.', path:['mediaType'] });
  if (value.purpose === 'story' && !['image','video'].includes(value.mediaType)) ctx.addIssue({ code:'custom', message:'Stories support photos or video.', path:['mediaType'] });
  if (value.purpose === 'group' && value.mediaType !== 'image') ctx.addIssue({ code:'custom', message:'Group photos must be images.', path:['mediaType'] });
  if (value.purpose === 'message' && !value.conversationId) ctx.addIssue({ code:'custom', message:'A conversation is required for message media.', path:['conversationId'] });
  if (value.purpose === 'group' && !value.groupId) ctx.addIssue({ code:'custom', message:'A group is required for its photo.', path:['groupId'] });
  if (value.purpose === 'story' && value.byteSize > 50 * 1024 * 1024) ctx.addIssue({ code:'custom', message:'Story media must be 50 MB or smaller.', path:['byteSize'] });
  if (value.mediaType === 'image' && value.byteSize > 10 * 1024 * 1024) ctx.addIssue({ code:'custom', message:'Images must be 10 MB or smaller.', path:['byteSize'] });
  if (value.mediaType === 'voice' && value.byteSize > 10 * 1024 * 1024) ctx.addIssue({ code:'custom', message:'Voice notes must be 10 MB or smaller.', path:['byteSize'] });
  const allowed = value.mediaType === 'image' ? ['image/jpeg','image/png','image/webp'] : value.mediaType === 'video' ? ['video/mp4'] : ['audio/mp4','audio/ogg','audio/webm','audio/matroska','audio/mpeg'];
  if (!allowed.includes(value.mimeType.toLowerCase().split(';')[0])) ctx.addIssue({ code:'custom', message:'This media format is not supported.', path:['mimeType'] });
});

async function canUseConversation(userId: string, conversationId: string) {
  const rows = await getDb()`SELECT c.id FROM conversations c JOIN conversation_members mine ON mine.conversation_id=c.id
    WHERE c.id=${conversationId} AND mine.user_id=${userId} AND mine.left_at IS NULL AND (
      (c.kind='direct' AND EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${userId}::uuid,other.user_id) AND f.user_high=GREATEST(${userId}::uuid,other.user_id)
        WHERE other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL
          WHERE (b.blocker_id=${userId} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${userId})))
      OR (c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)
        AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id=(SELECT g.id FROM haiku_groups g WHERE g.conversation_id=c.id) AND gm.user_id=${userId} AND gm.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=(SELECT g.id FROM haiku_groups g WHERE g.conversation_id=c.id) AND gm.user_id<>${userId} AND gm.left_at IS NULL
          WHERE (b.blocker_id=${userId} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${userId})))
    ) LIMIT 1`;
  return rows.length > 0;
}

mediaRoutes.post('/upload-intents', async (c) => {
  const limited=await enforceRateLimit(c,'media-upload-intent',30,600);if(limited)return limited;
  const user = c.get('user');
  const parsed = await parseJson(c, uploadIntentSchema); if ('response' in parsed) return parsed.response;
  const input = parsed.data;
  try { if (getStorage().mode === 'local' && input.byteSize > 10 * 1024 * 1024) return jsonError(c,413,'LOCAL_MEDIA_LIMIT','Local development uploads are limited to 10 MB. Configure signed object storage for larger files.'); }
  catch (error) { const message=error instanceof Error?error.message:'';if(message.startsWith('CONFIG_'))return jsonError(c,503,message,'Media storage is not configured.');return jsonError(c,503,'MEDIA_STORAGE_UNAVAILABLE','Media storage is not available.'); }
  if (input.purpose === 'message' && !(await canUseConversation(user.id, input.conversationId!))) return jsonError(c, 403, 'MEDIA_NOT_ALLOWED', 'You cannot attach media to this conversation.');
  if (input.purpose === 'group') {
    const role = await getDb()`SELECT role FROM group_members WHERE group_id=${input.groupId!} AND user_id=${user.id} AND left_at IS NULL LIMIT 1`;
    if (!role.length || !['owner','admin'].includes(String((role[0] as {role:string}).role))) return jsonError(c,403,'GROUP_ADMIN_REQUIRED','Only group admins can upload a group photo.');
  }
  try {
    const id = randomUUID();
    const objectKey = newObjectKey();
    await getDb()`INSERT INTO attachments(id,owner_id,object_key,purpose,media_type,mime_type,byte_size,status)
      VALUES (${id},${user.id},${objectKey},${input.purpose},${input.mediaType},${input.mimeType.toLowerCase().split(';')[0]},${input.byteSize},'pending')`;
    const baseUrl = process.env.API_PUBLIC_URL || new URL(c.req.url).origin;
    const plan = await getStorage().uploadPlan(objectKey, input.mimeType, input.byteSize, baseUrl, id);
    return c.json({ attachmentId:id, objectKey, upload:plan }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('CONFIG_')) return jsonError(c, 503, message, 'Media storage is not configured.');
    return jsonError(c, 503, 'MEDIA_STORAGE_UNAVAILABLE', 'Upload could not be prepared.');
  }
});

mediaRoutes.put('/:attachmentId/content', bodyLimit({ maxSize: 10 * 1024 * 1024 }), async (c) => {
  const user = c.get('user');
  const id = c.req.param('attachmentId');
  const rows = await getDb()`SELECT id,object_key,purpose,media_type,mime_type,byte_size,status,owner_id FROM attachments WHERE id=${id} AND owner_id=${user.id} LIMIT 1`;
  const attachment = rows[0] as {id:string;object_key:string;purpose:string;media_type:string;mime_type:string;byte_size:number;status:string;owner_id:string}|undefined;
  if (!attachment || attachment.status !== 'pending') return jsonError(c, 404, 'UPLOAD_NOT_FOUND', 'Upload was not found or is no longer available.');
  let storage;
  try { storage=getStorage(); } catch (error) { const message=error instanceof Error?error.message:''; return jsonError(c,503,message||'CONFIG_MEDIA_STORAGE_MISSING','Media storage is not configured.'); }
  if (storage.mode !== 'local' || !storage.putLocal) return jsonError(c, 405, 'USE_SIGNED_UPLOAD', 'Upload the file to the temporary signed URL, then confirm it.');
  const contentType = c.req.header('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== attachment.mime_type) return jsonError(c, 415, 'MEDIA_TYPE_MISMATCH', 'The uploaded file type does not match the upload request.');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength !== Number(attachment.byte_size)) return jsonError(c, 413, 'MEDIA_SIZE_MISMATCH', 'The uploaded file size does not match the declared size.');
  if (!verifyMediaSignature(attachment.media_type, attachment.mime_type, bytes)) return jsonError(c, 415, 'MEDIA_SIGNATURE_INVALID', 'The file contents do not match the declared media type.');
  try {
    await storage.putLocal(attachment.object_key, bytes);
    await getDb()`UPDATE attachments SET status='ready',ready_at=now() WHERE id=${id} AND owner_id=${user.id} AND status='pending'`;
    return c.json({ attachmentId:id, status:'ready' });
  } catch { return jsonError(c, 503, 'MEDIA_WRITE_FAILED', 'The upload could not be saved. Retry with a new upload.'); }
});

mediaRoutes.post('/:attachmentId/complete', async (c) => {
  const user = c.get('user');
  const id = c.req.param('attachmentId');
  const rows = await getDb()`SELECT id,object_key,purpose,media_type,mime_type,byte_size,status,owner_id FROM attachments WHERE id=${id} AND owner_id=${user.id} LIMIT 1`;
  const attachment = rows[0] as {id:string;object_key:string;purpose:string;media_type:string;mime_type:string;byte_size:number;status:string;owner_id:string}|undefined;
  if (!attachment || attachment.status !== 'pending') return jsonError(c, 404, 'UPLOAD_NOT_FOUND', 'Upload was not found or is no longer available.');
  try {
    const object = await getStorage().checkObject?.(attachment.object_key, attachment.mime_type);
    if (!object || object.byteSize !== Number(attachment.byte_size) || object.mimeType.toLowerCase().split(';')[0] !== attachment.mime_type || !verifyMediaSignature(attachment.media_type, attachment.mime_type, object.prefix)) {
      await getStorage().deleteObject(attachment.object_key).catch(() => undefined);
      await getDb()`UPDATE attachments SET status='failed' WHERE id=${id} AND owner_id=${user.id}`;
      return jsonError(c, 415, 'MEDIA_VALIDATION_FAILED', 'The uploaded file did not pass server validation.');
    }
    await getDb()`UPDATE attachments SET status='ready',ready_at=now() WHERE id=${id} AND owner_id=${user.id} AND status='pending'`;
    return c.json({ attachmentId:id, status:'ready' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('CONFIG_')) return jsonError(c, 503, message, 'Media storage is not configured.');
    return jsonError(c, 503, 'MEDIA_VERIFY_FAILED', 'Upload could not be verified. Retry confirmation.');
  }
});

async function authorizedAttachment(userId: string, attachmentId: string) {
  const rows = await getDb()`SELECT a.id,a.object_key,a.mime_type,a.owner_id,a.purpose,a.media_type,a.expires_at,a.status,
      CASE WHEN a.purpose='message' THEN m.conversation_id ELSE NULL END AS conversation_id,
      CASE WHEN a.purpose='story' THEN s.user_id ELSE NULL END AS story_author,
      CASE WHEN a.purpose='group' THEN g.id ELSE NULL END AS group_id
    FROM attachments a
    LEFT JOIN messages m ON m.attachment_id=a.id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
    LEFT JOIN stories s ON s.attachment_id=a.id AND s.deleted_at IS NULL AND s.expires_at>now()
    LEFT JOIN haiku_groups g ON g.photo_object_key=a.object_key
    WHERE a.id=${attachmentId} AND a.status='ready' AND (a.expires_at IS NULL OR a.expires_at>now()) LIMIT 1`;
  const item = rows[0] as {id:string;object_key:string;mime_type:string;owner_id:string;purpose:string;media_type:string;expires_at:Date|string|null;status:string;conversation_id:string|null;story_author:string|null;group_id:string|null}|undefined;
  if (!item) return null;
  if (item.owner_id === userId && (item.purpose === 'avatar' || item.purpose === 'report')) return item;
  if (item.purpose === 'message' && item.conversation_id) {
    const access = await getDb()`SELECT 1 FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
      WHERE c.id=${item.conversation_id} AND cm.user_id=${userId} AND cm.left_at IS NULL AND (
        (c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${userId} AND b.blocked_id=${item.owner_id}) OR (b.blocker_id=${item.owner_id} AND b.blocked_id=${userId}))) OR (EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${userId}::uuid,other.user_id) AND f.user_high=GREATEST(${userId}::uuid,other.user_id)
          WHERE other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL
            WHERE (b.blocker_id=${userId} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${userId})))
      ) LIMIT 1`;
    return access.length ? item : null;
  }
  if (item.purpose === 'story' && item.story_author) {
    const access = await getDb()`SELECT 1 FROM users u WHERE u.id=${userId} AND u.status='active' AND u.email_verified_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id=${userId} AND blocked_id=${item.story_author}) OR (blocker_id=${item.story_author} AND blocked_id=${userId}))
      AND (${userId}=${item.story_author} OR EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${userId}::uuid,${item.story_author}::uuid) AND f.user_high=GREATEST(${userId}::uuid,${item.story_author}::uuid))) LIMIT 1`;
    return access.length ? item : null;
  }
  if (item.purpose === 'group' && item.group_id) {
    const access = await getDb()`SELECT 1 FROM group_members mine JOIN users u ON u.id=mine.user_id JOIN haiku_groups g ON g.id=mine.group_id
      WHERE mine.group_id=${item.group_id} AND mine.user_id=${userId} AND mine.left_at IS NULL AND u.status='active' AND g.suspended_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${userId} AND b.blocked_id=${item.owner_id}) OR (b.blocker_id=${item.owner_id} AND b.blocked_id=${userId})) LIMIT 1`;
    return access.length ? item : null;
  }
  return null;
}

mediaRoutes.get('/avatars/:userId', async (c) => {
  const viewer=c.get('user'),ownerId=c.req.param('userId');
  if(!/^[0-9a-f-]{36}$/i.test(ownerId))return jsonError(c,404,'MEDIA_NOT_FOUND','This media is unavailable.');
  const rows=await getDb()`SELECT p.avatar_object_key,a.id,a.object_key,a.mime_type,a.expires_at
    FROM user_profiles p JOIN users u ON u.id=p.user_id
    JOIN attachments a ON a.owner_id=p.user_id AND a.object_key=p.avatar_object_key AND a.purpose='avatar' AND a.status='ready'
    WHERE p.user_id=${ownerId} AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL
      AND (a.expires_at IS NULL OR a.expires_at>now())
      AND (${viewer.id}=${ownerId} OR NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${viewer.id} AND b.blocked_id=${ownerId}) OR (b.blocker_id=${ownerId} AND b.blocked_id=${viewer.id}))) LIMIT 1`;
  if(!rows.length)return jsonError(c,404,'MEDIA_NOT_FOUND','This media is unavailable.');
  const item=rows[0] as {object_key:string;mime_type:string;expires_at:Date|string|null};
  try{return c.json({...(await getStorage().downloadUrl(item.object_key,process.env.API_PUBLIC_URL||new URL(c.req.url).origin)),mimeType:item.mime_type,expiresAt:item.expires_at});}
  catch(error){const message=error instanceof Error?error.message:'';if(message.startsWith('CONFIG_'))return jsonError(c,503,message,'Media storage is not configured.');return jsonError(c,503,'MEDIA_URL_FAILED','Media could not be opened.');}
});

mediaRoutes.delete('/:attachmentId',async(c)=>{
  const user=c.get('user'),id=c.req.param('attachmentId');
  const rows=await getDb()`SELECT a.object_key,a.status FROM attachments a WHERE a.id=${id} AND a.owner_id=${user.id}
    AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.attachment_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM stories s WHERE s.attachment_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM reports r WHERE r.evidence_attachment_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM haiku_groups g WHERE g.photo_object_key=a.object_key)
    AND NOT EXISTS(SELECT 1 FROM user_profiles p WHERE p.avatar_object_key=a.object_key) LIMIT 1`;
  if(!rows.length)return jsonError(c,404,'MEDIA_NOT_FOUND','This attachment cannot be deleted or is already in use.');
  const key=String((rows[0] as {object_key:string}).object_key);
  try{await getStorage().deleteObject(key);}catch{}
  await getDb()`UPDATE attachments SET status='failed',expires_at=now() WHERE id=${id} AND owner_id=${user.id}`;
  return c.json({status:'deleted'});
});

mediaRoutes.get('/:attachmentId', async (c) => {
  const user = c.get('user');
  const attachment = await authorizedAttachment(user.id, c.req.param('attachmentId'));
  if (!attachment) return jsonError(c, 404, 'MEDIA_NOT_FOUND', 'This media is unavailable.');
  try {
    const url = await getStorage().downloadUrl(attachment.object_key, process.env.API_PUBLIC_URL || new URL(c.req.url).origin);
    return c.json({ ...url, mimeType:attachment.mime_type, expiresAt:attachment.expires_at });
  } catch (error) {
    const message=error instanceof Error?error.message:'';
    if (message.startsWith('CONFIG_')) return jsonError(c,503,message,'Media storage is not configured.');
    return jsonError(c,503,'MEDIA_URL_FAILED','Media could not be opened.');
  }
});

mediaRoutes.get('/object/:objectKey', async (c) => {
  const user = c.get('user');
  let attachmentId: string | null = null;
  const rows = await getDb()`SELECT id FROM attachments WHERE object_key=${c.req.param('objectKey')} LIMIT 1`;
  if (rows.length) attachmentId = String((rows[0] as {id:string}).id);
  if (!attachmentId) return jsonError(c,404,'MEDIA_NOT_FOUND','This media is unavailable.');
  const attachment = await authorizedAttachment(user.id,attachmentId);
  if (!attachment) return jsonError(c,404,'MEDIA_NOT_FOUND','This media is unavailable.');
  try {
    const storage=getStorage();
    if (storage.mode !== 'local' || !storage.readLocal) return jsonError(c,404,'MEDIA_NOT_FOUND','This media is unavailable.');
    const bytes=await storage.readLocal(attachment.object_key);
    const body=new Uint8Array(bytes.byteLength);body.set(bytes);
    return new Response(body.buffer,{headers:{'Content-Type':attachment.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  } catch { return jsonError(c,404,'MEDIA_NOT_FOUND','This media is unavailable.'); }
});
