import { createMiddleware } from 'hono/factory';
import { getDb } from '../db.js';
import { jsonError } from '../http.js';
import type { ApiContext, ApiEnv } from '../types.js';

export const requireAdmin = createMiddleware<ApiEnv>(async (c, next) => {
  const user = c.get('user');
  const rows = await getDb()`SELECT r.role_name, r.permissions FROM admin_members m
    JOIN admin_roles r ON r.role_name=m.role_name
    WHERE m.user_id=${user.id} AND m.revoked_at IS NULL LIMIT 1`;
  if (!rows.length) return jsonError(c, 403, 'ADMIN_REQUIRED', 'Administrator access is required.');
  const row = rows[0] as { role_name: string; permissions: Record<string, boolean> };
  c.set('admin', { role: row.role_name, permissions: row.permissions || {} });
  await next();
});

export function hasAdminPermission(c: ApiContext, permission: string) {
  const admin = c.get('admin');
  return admin.role === 'owner' || admin.permissions[permission] === true;
}
