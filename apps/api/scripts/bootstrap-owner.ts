import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const databaseUrl=process.env.DATABASE_MIGRATION_URL||process.env.DATABASE_URL;
const email=process.env.OWNER_EMAIL?.trim().toLowerCase();
if(!databaseUrl||!email||process.env.ADMIN_BOOTSTRAP_CONFIRM!=='grant-haiku-owner'){
  console.error('Refusing bootstrap. Set DATABASE_MIGRATION_URL, OWNER_EMAIL, and ADMIN_BOOTSTRAP_CONFIRM=grant-haiku-owner.');
  process.exit(2);
}
const sql=neon(databaseUrl);
const current=await sql`SELECT 1 FROM admin_members WHERE role_name='owner' AND revoked_at IS NULL LIMIT 1`;
if(current.length){console.error('An active owner already exists. Bootstrap is one-time and will not replace it.');process.exit(3);}
const users=await sql`SELECT id FROM users WHERE email=${email} AND status='active' AND email_verified_at IS NOT NULL AND deleted_at IS NULL LIMIT 1`;
if(!users.length){console.error('The target must be an existing active, email-verified account. Create and verify it first.');process.exit(4);}
const userId=String((users[0] as {id:string}).id);
await sql`INSERT INTO admin_members(user_id,role_name,granted_by,revoked_at) VALUES (${userId},'owner',${userId},NULL)
  ON CONFLICT(user_id) DO UPDATE SET role_name='owner',granted_by=${userId},granted_at=now(),revoked_at=NULL`;
await sql`INSERT INTO admin_audit_events(id,admin_user_id,action,entity_type,entity_id,reason,metadata)
  VALUES (${randomUUID()},${userId},'admin.bootstrap','admin_member',${userId},'One-time local bootstrap', '{}'::jsonb)`;
console.info(`Owner access granted to ${email}. Remove ADMIN_BOOTSTRAP_CONFIRM from your shell.`);
