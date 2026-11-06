import { createMiddleware } from 'hono/factory';
import { getDb } from '../db.js';
import { jsonError } from '../http.js';
import { sha256 } from '../security.js';
import type { ApiEnv } from '../types.js';

export const requireUser = createMiddleware<ApiEnv>(async (c, next) => {
  const authorization = c.req.header('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token || token.length > 512) return jsonError(c, 401, 'AUTH_REQUIRED', 'Sign in to continue.');
  try {
    const rows = await getDb()`
      SELECT u.id, u.email, u.email_verified_at, u.status, p.username, p.display_name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      JOIN user_profiles p ON p.user_id = u.id
      WHERE s.token_hash = ${sha256(token)}
        AND s.revoked_at IS NULL AND s.expires_at > now()
        AND u.status = 'active' AND u.deleted_at IS NULL
      LIMIT 1`;
    if (!rows.length) return jsonError(c, 401, 'SESSION_INVALID', 'Your session expired. Sign in again.');
    const row = rows[0] as Record<string, unknown>;
    if (!row.email_verified_at) return jsonError(c, 403, 'EMAIL_UNVERIFIED', 'Verify your email before using Haiku Messenger.');
    c.set('user', {
      id: String(row.id), email: String(row.email), emailVerifiedAt: String(row.email_verified_at),
      username: String(row.username), displayName: String(row.display_name), accountStatus: 'active',
    });
    await next();
  } catch (error) {
    console.error('auth middleware failed', safeErrorName(error));
    return jsonError(c, 503, 'AUTH_TEMPORARILY_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  }
});

function safeErrorName(error: unknown) { return error instanceof Error ? error.name : 'UnknownError'; }
