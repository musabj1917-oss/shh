import type { Context } from 'hono';

export type AuthenticatedUser = {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  username: string;
  displayName: string;
  accountStatus: 'active' | 'suspended' | 'deletion_pending';
};

export type ApiEnv = { Variables: { user: AuthenticatedUser; admin: { role: string; permissions: Record<string, boolean> } } };
export type ApiContext = Context<ApiEnv>;

export type ApiError = { error: { code: string; message: string; details?: unknown } };
