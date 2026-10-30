import { Hono } from 'hono';
import { z } from 'zod';
import { profilePatchSchema, usernameSchema } from '@haiku/contracts';
import { getDb } from '../db.js';
import { jsonError, parseJson } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rate-limit.js';
import type { ApiEnv } from '../types.js';

export const profileRoutes=new Hono<ApiEnv>();
profileRoutes.use('*',requireUser);

profileRoutes.get('/me',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`SELECT u.id,u.email,p.username,p.display_name,p.bio,p.location,p.avatar_object_key,p.username_changed_at,u.created_at
    FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${user.id} LIMIT 1`;
  return c.json({profile:rows[0]||null});
});

profileRoutes.patch('/me',async(c)=>{
  const user=c.get('user');
  const parsed=await parseJson(c,profilePatchSchema);if('response' in parsed)return parsed.response;
  const patch=parsed.data;
  if(patch.username&&patch.username!==user.username){
    const rows=await getDb()`SELECT username_changed_at FROM user_profiles WHERE user_id=${user.id} LIMIT 1`;
    const changedAt=(rows[0] as {username_changed_at:Date|string|null}|undefined)?.username_changed_at;
    if(changedAt&&Date.now()-new Date(changedAt).getTime()<30*86400000){
      return jsonError(c,409,'USERNAME_CHANGE_COOLDOWN','You can change your username once every 30 days.',{availableAt:new Date(new Date(changedAt).getTime()+30*86400000).toISOString()});
    }
  }
  let avatarKey:string|null=null;
  if(patch.avatarAttachmentId){
    const rows=await getDb()`SELECT object_key,status,purpose,expires_at FROM attachments WHERE id=${patch.avatarAttachmentId} AND owner_id=${user.id} LIMIT 1`;
    const item=rows[0] as {object_key:string;status:string;purpose:string;expires_at:Date|string|null}|undefined;
    if(!item||item.status!=='ready'||item.purpose!=='avatar'||(item.expires_at&&new Date(item.expires_at).getTime()<=Date.now()))return jsonError(c,422,'AVATAR_ATTACHMENT_INVALID','Choose an uploaded profile image that is still available.');
    avatarKey=item.object_key;
  }
  try{
    await getDb()`UPDATE user_profiles SET
      username=CASE WHEN ${patch.username!==undefined} THEN ${patch.username??null} ELSE username END,
      username_changed_at=CASE WHEN ${patch.username!==undefined&&patch.username!==user.username} THEN now() ELSE username_changed_at END,
      display_name=CASE WHEN ${patch.displayName!==undefined} THEN ${patch.displayName??null} ELSE display_name END,
      bio=CASE WHEN ${patch.bio!==undefined} THEN ${patch.bio??null} ELSE bio END,
      location=CASE WHEN ${patch.location!==undefined} THEN ${patch.location??null} ELSE location END,
      birthday_month=CASE WHEN ${patch.birthdayMonth!==undefined} THEN ${patch.birthdayMonth??null} ELSE birthday_month END,
      birthday_day=CASE WHEN ${patch.birthdayDay!==undefined} THEN ${patch.birthdayDay??null} ELSE birthday_day END,
      avatar_object_key=CASE WHEN ${patch.avatarAttachmentId!==undefined} THEN ${avatarKey} ELSE avatar_object_key END,
      updated_at=now() WHERE user_id=${user.id}`;
    const rows=await getDb()`SELECT username,display_name,bio,location,birthday_month,birthday_day,avatar_object_key,username_changed_at FROM user_profiles WHERE user_id=${user.id} LIMIT 1`;
    return c.json({profile:rows[0]});
  }catch(error){if((error as {code?:string})?.code==='23505')return jsonError(c,409,'USERNAME_TAKEN','That username is already in use.');return jsonError(c,503,'PROFILE_UPDATE_FAILED','Profile could not be updated.');}
});

profileRoutes.get('/username-available',async(c)=>{
  const parsed=usernameSchema.safeParse(c.req.query('username')||'');
  if(!parsed.success)return jsonError(c,422,'USERNAME_INVALID','Use 3–24 lowercase letters, numbers, or underscores.');
  const user=c.get('user');
  const rows=await getDb()`SELECT 1 FROM user_profiles WHERE username=${parsed.data} AND user_id<>${user.id} LIMIT 1`;
  return c.json({username:parsed.data,available:rows.length===0});
});

profileRoutes.get('/search',async(c)=>{
  const limited=await enforceRateLimit(c,'people-search',40,60);if(limited)return limited;
  const user=c.get('user'),query=(c.req.query('q')||'').trim().slice(0,48);
  if(query.length<2)return jsonError(c,422,'SEARCH_TOO_SHORT','Enter at least two characters.');
  const like=`%${query.replace(/[\\%_]/g,'\\$&')}%`;
  const rows=await getDb()`SELECT p.user_id AS id,p.username,p.display_name,p.bio,p.location,p.avatar_object_key
    FROM user_profiles p JOIN users u ON u.id=p.user_id
    WHERE u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL AND p.user_id<>${user.id}
      AND (p.username ILIKE ${like} ESCAPE '\\' OR p.display_name ILIKE ${like} ESCAPE '\\')
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=${user.id}))
      AND NOT EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${user.id}::uuid,p.user_id) AND f.user_high=GREATEST(${user.id}::uuid,p.user_id))
    ORDER BY p.username LIMIT 30`;
  return c.json({people:rows});
});

profileRoutes.get('/discover',async(c)=>{
  const user=c.get('user'),mode=c.req.query('mode')==='popular'?'popular':'random';
  const limit=Math.min(30,Math.max(1,Number.parseInt(c.req.query('limit')||'20',10)||20));
  const rows=await getDb()`WITH eligible AS (
      SELECT p.user_id AS id,p.username,p.display_name,p.bio,p.location,p.avatar_object_key,
        (SELECT count(*)::int FROM friendships f WHERE f.user_low=p.user_id OR f.user_high=p.user_id) AS connection_count
      FROM user_profiles p JOIN users u ON u.id=p.user_id
      WHERE u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL AND p.user_id<>${user.id}
        AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=${user.id}))
        AND NOT EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${user.id}::uuid,p.user_id) AND f.user_high=GREATEST(${user.id}::uuid,p.user_id))
    ) SELECT * FROM eligible ORDER BY CASE WHEN ${mode}='popular' THEN connection_count END DESC,random() LIMIT ${limit}`;
  return c.json({mode,people:rows});
});

profileRoutes.get('/id/:userId',async(c)=>{
  const user=c.get('user'),target=c.req.param('userId');
  if(!/^[0-9a-f-]{36}$/i.test(target))return jsonError(c,404,'PROFILE_NOT_FOUND','Profile not found.');
  if(target!==user.id){const blocked=await getDb()`SELECT 1 FROM blocks WHERE (blocker_id=${user.id} AND blocked_id=${target}) OR (blocker_id=${target} AND blocked_id=${user.id}) LIMIT 1`;if(blocked.length)return jsonError(c,404,'PROFILE_NOT_FOUND','Profile not found.');}
  const rows=await getDb()`SELECT p.user_id AS id,p.username,p.display_name,p.bio,p.location,p.avatar_object_key,u.created_at
    FROM user_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=${target} AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL LIMIT 1`;
  if(!rows.length)return jsonError(c,404,'PROFILE_NOT_FOUND','Profile not found.');
  const friendship=await getDb()`SELECT 1 FROM friendships WHERE user_low=LEAST(${user.id}::uuid,${target}::uuid) AND user_high=GREATEST(${user.id}::uuid,${target}::uuid) LIMIT 1`;
  return c.json({profile:rows[0],isFriend:friendship.length>0});
});

const settingsSchema=z.object({quietMode:z.boolean().optional(),notificationsEnabled:z.boolean().optional(),senderPreviews:z.boolean().optional(),presenceVisible:z.boolean().optional(),readReceiptsEnabled:z.boolean().optional(),typingIndicatorsEnabled:z.boolean().optional()}).strict().refine(value=>Object.keys(value).length>0,'Provide at least one setting.');
profileRoutes.get('/settings',async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`SELECT quiet_mode,notifications_enabled,sender_previews,presence_visible,read_receipts_enabled,typing_indicators_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
  return c.json({settings:rows[0]||{quiet_mode:true,notifications_enabled:true,sender_previews:true,presence_visible:true,read_receipts_enabled:true,typing_indicators_enabled:true}});
});
profileRoutes.patch('/settings',async(c)=>{
  const user=c.get('user'),parsed=await parseJson(c,settingsSchema);if('response' in parsed)return parsed.response;
  const s=parsed.data;
  await getDb()`INSERT INTO user_settings(user_id,quiet_mode,notifications_enabled,sender_previews,presence_visible,read_receipts_enabled,typing_indicators_enabled)
    VALUES (${user.id},${s.quietMode??true},${s.notificationsEnabled??true},${s.senderPreviews??true},${s.presenceVisible??true},${s.readReceiptsEnabled??true},${s.typingIndicatorsEnabled??true})
    ON CONFLICT(user_id) DO UPDATE SET
      quiet_mode=CASE WHEN ${s.quietMode!==undefined} THEN ${s.quietMode??null} ELSE user_settings.quiet_mode END,
      notifications_enabled=CASE WHEN ${s.notificationsEnabled!==undefined} THEN ${s.notificationsEnabled??null} ELSE user_settings.notifications_enabled END,
      sender_previews=CASE WHEN ${s.senderPreviews!==undefined} THEN ${s.senderPreviews??null} ELSE user_settings.sender_previews END,
      presence_visible=CASE WHEN ${s.presenceVisible!==undefined} THEN ${s.presenceVisible??null} ELSE user_settings.presence_visible END,
      read_receipts_enabled=CASE WHEN ${s.readReceiptsEnabled!==undefined} THEN ${s.readReceiptsEnabled??null} ELSE user_settings.read_receipts_enabled END,
      typing_indicators_enabled=CASE WHEN ${s.typingIndicatorsEnabled!==undefined} THEN ${s.typingIndicatorsEnabled??null} ELSE user_settings.typing_indicators_enabled END,
      updated_at=now()`;
  const rows=await getDb()`SELECT quiet_mode,notifications_enabled,sender_previews,presence_visible,read_receipts_enabled,typing_indicators_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
  return c.json({settings:rows[0]});
});
