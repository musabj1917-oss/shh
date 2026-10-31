import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { storyCreateSchema } from '../contracts.js';
import { getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rate-limit.js';
import { createNotification } from '../services/notifications.js';
import type { ApiEnv } from '../types.js';

export const storyRoutes = new Hono<ApiEnv>();
storyRoutes.use('*',requireUser);

storyRoutes.get('/',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`SELECT s.id,s.user_id,s.media_type,s.caption,s.created_at,s.expires_at,
      p.username,p.display_name,p.avatar_object_key,a.id AS attachment_id,
      (SELECT count(*)::int FROM story_views v WHERE v.story_id=s.id) AS view_count,
      EXISTS(SELECT 1 FROM story_views v WHERE v.story_id=s.id AND v.viewer_id=${user.id}) AS viewed
    FROM stories s JOIN users u ON u.id=s.user_id JOIN user_profiles p ON p.user_id=s.user_id
    JOIN attachments a ON a.id=s.attachment_id AND a.status='ready'
    WHERE s.deleted_at IS NULL AND s.expires_at>now() AND u.status='active' AND u.email_verified_at IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=s.user_id) OR (b.blocker_id=s.user_id AND b.blocked_id=${user.id}))
      AND (s.user_id=${user.id} OR EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${user.id}::uuid,s.user_id) AND f.user_high=GREATEST(${user.id}::uuid,s.user_id)))
    ORDER BY s.created_at DESC LIMIT 200`;
  return c.json({stories:rows});
});

storyRoutes.post('/',async(c)=>{
  const limited=await enforceRateLimit(c,'story-create',20,86400);if(limited)return limited;
  const user=c.get('user');
  const parsed=await parseJson(c,storyCreateSchema);if('response' in parsed)return parsed.response;
  const {attachmentId,caption,mediaType}=parsed.data;
  const id=randomUUID();
  const rows=await getDb()`WITH ready AS (
      UPDATE attachments SET expires_at=now()+interval '24 hours'
      WHERE id=${attachmentId} AND owner_id=${user.id} AND purpose='story' AND media_type=${mediaType} AND status='ready'
        AND (expires_at IS NULL OR expires_at>now()) RETURNING id
    ) INSERT INTO stories(id,user_id,attachment_id,media_type,caption,expires_at)
      SELECT ${id},${user.id},ready.id,${mediaType},${caption ?? null},now()+interval '24 hours' FROM ready
      RETURNING id,user_id,media_type,caption,created_at,expires_at,attachment_id`;
  if(!rows.length)return jsonError(c,422,'STORY_MEDIA_INVALID','Upload a valid photo or video before posting.');
  return c.json({story:rows[0]},201);
});

storyRoutes.get('/:storyId',async(c)=>{
  const user=c.get('user'),storyId=c.req.param('storyId');
  const rows=await getDb()`SELECT s.id,s.user_id,s.media_type,s.caption,s.created_at,s.expires_at,a.id AS attachment_id,
      p.username,p.display_name,p.avatar_object_key
    FROM stories s JOIN users u ON u.id=s.user_id JOIN user_profiles p ON p.user_id=s.user_id JOIN attachments a ON a.id=s.attachment_id
    WHERE s.id=${storyId} AND s.deleted_at IS NULL AND s.expires_at>now() AND a.status='ready'
      AND u.status='active' AND u.email_verified_at IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=s.user_id) OR (b.blocker_id=s.user_id AND b.blocked_id=${user.id}))
      AND (s.user_id=${user.id} OR EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${user.id}::uuid,s.user_id) AND f.user_high=GREATEST(${user.id}::uuid,s.user_id))) LIMIT 1`;
  if(!rows.length)return jsonError(c,404,'STORY_NOT_FOUND','This story is no longer available.');
  const story=rows[0] as {id:string;user_id:string;[key:string]:unknown};
  if(story.user_id!==user.id) await getDb()`INSERT INTO story_views(story_id,viewer_id) VALUES (${storyId},${user.id}) ON CONFLICT(story_id,viewer_id) DO UPDATE SET viewed_at=now()`;
  return c.json({story});
});

storyRoutes.get('/:storyId/viewers',async(c)=>{
  const user=c.get('user'),storyId=c.req.param('storyId');
  const owns=await getDb()`SELECT 1 FROM stories WHERE id=${storyId} AND user_id=${user.id} AND deleted_at IS NULL LIMIT 1`;
  if(!owns.length)return jsonError(c,404,'STORY_NOT_FOUND','Story not found.');
  const rows=await getDb()`SELECT v.viewed_at,p.user_id AS id,p.username,p.display_name,p.avatar_object_key
    FROM story_views v JOIN user_profiles p ON p.user_id=v.viewer_id JOIN users u ON u.id=v.viewer_id
    WHERE v.story_id=${storyId} AND u.status='active' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=v.viewer_id) OR (b.blocker_id=v.viewer_id AND b.blocked_id=${user.id}))
    ORDER BY v.viewed_at DESC LIMIT 500`;
  return c.json({viewers:rows});
});

storyRoutes.post('/:storyId/replies',async(c)=>{
  const user=c.get('user'),storyId=c.req.param('storyId');
  const parsed=await parseJson(c,z.object({text:z.string().trim().min(1).max(1000)}).strict());if('response' in parsed)return parsed.response;
  const story=await getDb()`SELECT user_id FROM stories WHERE id=${storyId} AND deleted_at IS NULL AND expires_at>now() LIMIT 1`;
  if(!story.length)return jsonError(c,404,'STORY_NOT_FOUND','This story is no longer available.');
  const recipient=String((story[0] as {user_id:string}).user_id);
  if(recipient===user.id)return jsonError(c,409,'OWN_STORY_REPLY','You cannot reply to your own story.');
  const blocked=await getDb()`SELECT 1 FROM blocks WHERE (blocker_id=${user.id} AND blocked_id=${recipient}) OR (blocker_id=${recipient} AND blocked_id=${user.id}) LIMIT 1`;
  if(blocked.length)return jsonError(c,404,'STORY_NOT_FOUND','This story is no longer available.');
  const friends=await getDb()`SELECT 1 FROM friendships WHERE user_low=LEAST(${user.id}::uuid,${recipient}::uuid) AND user_high=GREATEST(${user.id}::uuid,${recipient}::uuid) LIMIT 1`;
  if(!friends.length)return jsonError(c,404,'STORY_NOT_FOUND','This story is no longer available.');
  const id=randomUUID();
  await getDb()`INSERT INTO story_replies(id,story_id,sender_id,body) VALUES (${id},${storyId},${user.id},${parsed.data.text})`;
  try{await createNotification(recipient,'story_reply',user.id,id,{storyId});}catch{}
  return c.json({reply:{id,storyId,createdAt:new Date().toISOString()}},201);
});

storyRoutes.get('/replies/inbox',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`SELECT r.id,r.story_id,r.body,r.created_at,p.user_id AS sender_id,p.username,p.display_name
    FROM story_replies r JOIN stories s ON s.id=r.story_id JOIN user_profiles p ON p.user_id=r.sender_id
    WHERE s.user_id=${user.id} AND s.deleted_at IS NULL AND s.expires_at>now() AND r.created_at>now()-interval '7 days'
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=r.sender_id) OR (b.blocker_id=r.sender_id AND b.blocked_id=${user.id}))
    ORDER BY r.created_at DESC LIMIT 100`;
  return c.json({replies:rows});
});

storyRoutes.delete('/:storyId',async(c)=>{
  const user=c.get('user'),storyId=c.req.param('storyId');
  const rows=await getDb()`UPDATE stories SET deleted_at=now() WHERE id=${storyId} AND user_id=${user.id} AND deleted_at IS NULL RETURNING attachment_id`;
  if(!rows.length)return jsonError(c,404,'STORY_NOT_FOUND','Story not found.');
  const attachmentId=String((rows[0] as {attachment_id:string}).attachment_id);
  await getDb()`UPDATE attachments SET expires_at=now() WHERE id=${attachmentId}`;
  return c.json({status:'deleted'});
});
