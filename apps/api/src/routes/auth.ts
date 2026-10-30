import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { emailSchema, googleRegisterSchema, loginSchema, meetsMinimumAge, passwordSchema, registerSchema } from '@haiku/contracts';
import { getDb } from '../db.js';
import { errorCode, jsonError, parseJson } from '../http.js';
import { createOpaqueToken, hashPassword, sha256, verifyPassword } from '../security.js';
import { createSession } from '../services/session.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/email.js';
import { requireUser } from '../middleware/auth.js';
import { enforceRateLimit } from '../middleware/rate-limit.js';
import type { ApiEnv } from '../types.js';

export const authRoutes = new Hono<ApiEnv>();
const googleClient = new OAuth2Client();
const safeName = (error: unknown) => error instanceof Error ? error.name : 'UnknownError';

async function createVerification(userId: string, email: string) {
  const token=createOpaqueToken();
  await getDb()`INSERT INTO email_verification_tokens(id,user_id,token_hash,expires_at) VALUES (${randomUUID()},${userId},${sha256(token)},now()+interval '30 minutes')`;
  return sendVerificationEmail(email,token);
}
async function profileFor(userId:string) {
  const rows=await getDb()`SELECT u.id,u.email,u.email_verified_at,p.username,p.display_name FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${userId} AND u.deleted_at IS NULL LIMIT 1`;
  return rows[0]||null;
}
function publicUser(row:Record<string,unknown>) {
  return {id:String(row.id),email:String(row.email),emailVerified:Boolean(row.email_verified_at),username:String(row.username),displayName:String(row.display_name)};
}

// Registration requires an age-eligible DOB; the year is stored privately and never returned in profiles.
authRoutes.post('/register',async(c)=>{
  const limited=await enforceRateLimit(c,'register',5,3600);if(limited)return limited;
  const parsed=await parseJson(c,registerSchema);if('response' in parsed)return parsed.response;
  const input=parsed.data;
  if(!meetsMinimumAge(input.dateOfBirth))return jsonError(c,422,'AGE_REQUIREMENT','You must be at least 13 years old to create an account.');
  if(process.env.NODE_ENV==='production'&&!process.env.SMTP_HOST)return jsonError(c,503,'CONFIG_EMAIL_MISSING','Email verification is not configured yet.');
  const id=randomUUID(),passwordHash=await hashPassword(input.password);
  try{
    await getDb().transaction([
      getDb()`INSERT INTO users(id,email,password_hash,date_of_birth,status) VALUES (${id},${input.email},${passwordHash},${input.dateOfBirth},'active')`,
      getDb()`INSERT INTO user_profiles(user_id,username,display_name) VALUES (${id},${input.username},${input.displayName})`,
    ]);
  }catch(error){
    if(errorCode(error)==='23505')return jsonError(c,409,'ACCOUNT_CONFLICT','That email or username is already in use.');
    console.error('registration failed',safeName(error));
    return jsonError(c,503,'REGISTRATION_UNAVAILABLE','Account creation is temporarily unavailable.');
  }
  try{
    const verification=await createVerification(id,input.email);
    return c.json({user:{id,email:input.email,username:input.username,displayName:input.displayName,emailVerified:false},verification:verification.delivered?{status:'sent'}:{status:'development-only',link:verification.developmentLink},message:'Verify your email before signing in.'},201);
  }catch(error){
    if(errorCode(error)==='CONFIG_SMTP_MISSING')return jsonError(c,503,'CONFIG_EMAIL_MISSING','The account was created but email delivery is not configured. Set up SMTP, then request another verification email.');
    console.error('verification delivery failed',safeName(error));
    return jsonError(c,503,'VERIFICATION_EMAIL_FAILED','The account was created but verification email delivery failed. You can request another verification email.');
  }
});

authRoutes.post('/resend-verification',async(c)=>{
  const limited=await enforceRateLimit(c,'resend-verification',5,3600);if(limited)return limited;
  const parsed=await parseJson(c,emailSchema);if('response' in parsed)return parsed.response;
  if(process.env.NODE_ENV==='production'&&!process.env.SMTP_HOST)return jsonError(c,503,'CONFIG_EMAIL_MISSING','Email verification is not configured.');
  const rows=await getDb()`SELECT id,email FROM users WHERE email=${parsed.data} AND email_verified_at IS NULL AND status='active' AND deleted_at IS NULL LIMIT 1`;
  if(rows.length){const user=rows[0] as {id:string;email:string};try{await createVerification(user.id,user.email);}catch(error){if(errorCode(error)==='CONFIG_SMTP_MISSING')return jsonError(c,503,'CONFIG_EMAIL_MISSING','Email delivery is not configured.');return jsonError(c,503,'EMAIL_SEND_FAILED','Verification email could not be sent.');}}
  return c.json({message:'If the account needs verification, instructions will be sent.'});
});

authRoutes.post('/login',async(c)=>{
  const limited=await enforceRateLimit(c,'login',10,900);if(limited)return limited;
  const parsed=await parseJson(c,loginSchema);if('response' in parsed)return parsed.response;
  const input=parsed.data;
  try{
    const rows=await getDb()`SELECT u.id,u.email,u.email_verified_at,u.password_hash,u.status,p.username,p.display_name
      FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.email=${input.email} AND u.deleted_at IS NULL LIMIT 1`;
    const row=rows[0] as Record<string,unknown>|undefined;
    if(!row||row.status!=='active'||!(await verifyPassword(input.password,row.password_hash as string|null)))return jsonError(c,401,'INVALID_CREDENTIALS','Email or password is incorrect.');
    if(!row.email_verified_at)return jsonError(c,403,'EMAIL_UNVERIFIED','Verify your email before signing in.');
    const session=await createSession(String(row.id),c.req.header('user-agent'));
    return c.json({accessToken:session.token,tokenType:'Bearer',expiresIn:session.expiresInSeconds,user:publicUser(row)});
  }catch(error){console.error('login failed',safeName(error));return jsonError(c,503,'LOGIN_UNAVAILABLE','Sign-in is temporarily unavailable.');}
});

authRoutes.post('/google',async(c)=>{
  const limited=await enforceRateLimit(c,'google-login',10,900);if(limited)return limited;
  const parsed=await parseJson(c,googleRegisterSchema);if('response' in parsed)return parsed.response;
  const clientId=process.env.GOOGLE_CLIENT_ID;
  if(!clientId)return jsonError(c,503,'CONFIG_GOOGLE_MISSING','Google sign-in is not configured.');
  try{
    const ticket=await googleClient.verifyIdToken({idToken:parsed.data.idToken,audience:clientId});
    const identity=ticket.getPayload();
    if(!identity?.sub||!identity.email||identity.email_verified!==true)return jsonError(c,401,'GOOGLE_IDENTITY_INVALID','Google could not verify this identity.');
    const email=identity.email.toLowerCase();
    let rows=await getDb()`SELECT u.id,u.email,u.email_verified_at,u.status,p.username,p.display_name
      FROM auth_identities i JOIN users u ON u.id=i.user_id JOIN user_profiles p ON p.user_id=u.id
      WHERE i.provider='google' AND i.provider_subject=${identity.sub} AND u.deleted_at IS NULL LIMIT 1`;
    let row=rows[0] as Record<string,unknown>|undefined;
    if(!row){
      // A verified Google email may be linked to an existing verified account.
      rows=await getDb()`SELECT u.id,u.email,u.email_verified_at,u.status,p.username,p.display_name FROM users u JOIN user_profiles p ON p.user_id=u.id
        WHERE u.email=${email} AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL LIMIT 1`;
      if(rows.length){
        row=rows[0] as Record<string,unknown>;
        if(row.status!=='active')return jsonError(c,403,'ACCOUNT_UNAVAILABLE','This account cannot sign in.');
        await getDb()`INSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email) VALUES (${randomUUID()},${String(row.id)},'google',${identity.sub},${email}) ON CONFLICT(provider,provider_subject) DO NOTHING`;
      }else{
        if(!parsed.data.dateOfBirth||!parsed.data.username)return c.json({registrationRequired:true,verifiedEmail:email,displayName:identity.name||'',message:'Submit this verified token again with a date of birth and username.'});
        if(!meetsMinimumAge(parsed.data.dateOfBirth))return jsonError(c,422,'AGE_REQUIREMENT','You must be at least 13 years old to create an account.');
        const id=randomUUID();
        await getDb().transaction([
          getDb()`INSERT INTO users(id,email,email_verified_at,date_of_birth,status) VALUES (${id},${email},now(),${parsed.data.dateOfBirth},'active')`,
          getDb()`INSERT INTO user_profiles(user_id,username,display_name) VALUES (${id},${parsed.data.username},${parsed.data.displayName||identity.name||parsed.data.username})`,
          getDb()`INSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email) VALUES (${randomUUID()},${id},'google',${identity.sub},${email})`,
        ]);
        row=await profileFor(id) as Record<string,unknown>;
      }
    }
    if(!row||row.status!=='active')return jsonError(c,403,'ACCOUNT_UNAVAILABLE','This account cannot sign in.');
    const session=await createSession(String(row.id),c.req.header('user-agent'));
    return c.json({accessToken:session.token,tokenType:'Bearer',expiresIn:session.expiresInSeconds,user:publicUser(row)});
  }catch(error){
    if(errorCode(error)==='23505')return jsonError(c,409,'ACCOUNT_CONFLICT','This Google account is already linked to another user.');
    if(errorCode(error)==='CONFIG_GOOGLE_MISSING')return jsonError(c,503,'CONFIG_GOOGLE_MISSING','Google sign-in is not configured.');
    console.error('Google identity verification failed',safeName(error));
    return jsonError(c,401,'GOOGLE_IDENTITY_INVALID','Google identity verification failed.');
  }
});

authRoutes.get('/verify-email',async(c)=>{
  const token=c.req.query('token')||'';
  if(token.length<20||token.length>256)return jsonError(c,400,'TOKEN_INVALID','This verification link is invalid or expired.');
  const rows=await getDb()`WITH used AS (
      UPDATE email_verification_tokens SET used_at=now() WHERE token_hash=${sha256(token)} AND used_at IS NULL AND expires_at>now() RETURNING user_id
    ), verified AS (
      UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id IN (SELECT user_id FROM used) RETURNING id
    ) SELECT id FROM verified`;
  if(!rows.length)return jsonError(c,400,'TOKEN_INVALID','This verification link is invalid or expired.');
  return c.html('<!doctype html><meta name="viewport" content="width=device-width"><title>Email verified</title><main style="font:16px system-ui;max-width:32rem;margin:15vh auto;padding:24px;color:#20352f"><h1>Email verified</h1><p>Your Haiku Messenger account is ready. Return to the app and sign in.</p></main>');
});

authRoutes.post('/forgot-password',async(c)=>{
  const limited=await enforceRateLimit(c,'forgot-password',5,3600);if(limited)return limited;
  const parsed=await parseJson(c,emailSchema);if('response' in parsed)return parsed.response;
  if(process.env.NODE_ENV==='production'&&!process.env.SMTP_HOST)return jsonError(c,503,'CONFIG_EMAIL_MISSING','Password recovery email is not configured.');
  try{
    const rows=await getDb()`SELECT id,email FROM users WHERE email=${parsed.data} AND status='active' AND deleted_at IS NULL LIMIT 1`;
    if(rows.length){
      const user=rows[0] as {id:string;email:string},token=createOpaqueToken();
      await getDb()`INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES (${randomUUID()},${user.id},${sha256(token)},now()+interval '30 minutes')`;
      await sendPasswordResetEmail(user.email,token);
    }
    return c.json({message:'If an eligible account exists, recovery instructions will be sent.'});
  }catch(error){if(errorCode(error)==='CONFIG_SMTP_MISSING')return jsonError(c,503,'CONFIG_EMAIL_MISSING','Password recovery email is not configured.');console.error('password recovery failed',safeName(error));return jsonError(c,503,'RECOVERY_UNAVAILABLE','Password recovery is temporarily unavailable.');}
});

authRoutes.post('/reset-password',async(c)=>{
  const parsed=await parseJson(c,z.object({token:z.string().min(20).max(256),password:passwordSchema}).strict());if('response' in parsed)return parsed.response;
  const newHash=await hashPassword(parsed.data.password);
  const rows=await getDb()`WITH token AS (
      UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=${sha256(parsed.data.token)} AND used_at IS NULL AND expires_at>now() RETURNING user_id
    ), changed AS (
      UPDATE users SET password_hash=${newHash},updated_at=now() WHERE id IN (SELECT user_id FROM token) RETURNING id
    ), revoked AS (
      UPDATE sessions SET revoked_at=now() WHERE user_id IN (SELECT id FROM changed) AND revoked_at IS NULL RETURNING id
    ) SELECT id FROM changed`;
  if(!rows.length)return jsonError(c,400,'TOKEN_INVALID','This password reset link is invalid or expired.');
  return c.json({message:'Password changed. Sign in again on your devices.'});
});

authRoutes.post('/change-password',requireUser,async(c)=>{
  const user=c.get('user');
  const parsed=await parseJson(c,z.object({currentPassword:z.string().min(1).max(256),newPassword:passwordSchema}).strict());if('response' in parsed)return parsed.response;
  const rows=await getDb()`SELECT password_hash FROM users WHERE id=${user.id} AND status='active' AND deleted_at IS NULL LIMIT 1`;
  const passwordHash=(rows[0] as {password_hash:string|null}|undefined)?.password_hash;
  if(!passwordHash)return jsonError(c,409,'PASSWORD_RESET_REQUIRED','This account has no password set. Use email recovery to establish one.');
  if(!(await verifyPassword(parsed.data.currentPassword,passwordHash)))return jsonError(c,403,'CURRENT_PASSWORD_INVALID','Your current password is incorrect.');
  const nextHash=await hashPassword(parsed.data.newPassword),token=(c.req.header('authorization')||'').slice(7).trim();
  await getDb().transaction([
    getDb()`UPDATE users SET password_hash=${nextHash},updated_at=now() WHERE id=${user.id}`,
    getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${user.id} AND token_hash<>${sha256(token)} AND revoked_at IS NULL`,
  ]);
  return c.json({message:'Password updated. Other sessions have been signed out.'});
});

authRoutes.get('/me',requireUser,async(c)=>{
  const user=c.get('user');
  const rows=await getDb()`SELECT p.bio,p.location,p.birthday_month,p.birthday_day,p.avatar_object_key,u.created_at,u.status,
      us.presence_visible,us.read_receipts_enabled,us.typing_indicators_enabled
    FROM users u JOIN user_profiles p ON p.user_id=u.id LEFT JOIN user_settings us ON us.user_id=u.id WHERE u.id=${user.id} LIMIT 1`;
  return c.json({user,profile:rows[0]||null});
});

authRoutes.post('/logout',requireUser,async(c)=>{
  const token=(c.req.header('authorization')||'').slice(7).trim();
  await getDb()`UPDATE sessions SET revoked_at=now() WHERE token_hash=${sha256(token)} AND revoked_at IS NULL`;
  return c.json({message:'Signed out.'});
});

authRoutes.post('/logout-all',requireUser,async(c)=>{
  const user=c.get('user');
  await getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${user.id} AND revoked_at IS NULL`;
  return c.json({message:'All sessions were signed out.'});
});
