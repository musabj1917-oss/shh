import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { envInt } from '../config.js';
import { createOpaqueToken, sha256 } from '../security.js';

export async function createSession(userId: string, userAgent: string | undefined) {
  const token = createOpaqueToken(32);
  const days = envInt('SESSION_TTL_DAYS', 30, 1, 60);
  await getDb()`
    INSERT INTO sessions (id, user_id, token_hash, user_agent, expires_at)
    VALUES (${randomUUID()}, ${userId}, ${sha256(token)}, ${userAgent?.slice(0, 200) || null}, now() + (${days} * interval '1 day'))`;
  return { token, expiresInSeconds: days * 86400 };
}
