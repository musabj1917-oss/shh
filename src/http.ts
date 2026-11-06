import type { ZodType } from 'zod';
import type { ApiContext } from './types.js';

export function jsonError(c: ApiContext | any, status: number, code: string, message: string, details?: unknown) {
  return c.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status as never);
}

export async function parseJson<T>(c: ApiContext | any, schema: ZodType<T>): Promise<{ data: T } | { response: Response }> {
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return { response: jsonError(c, 400, 'INVALID_JSON', 'Request body must be valid JSON.') }; }
  const result = schema.safeParse(body);
  if (!result.success) {
    return { response: jsonError(c, 422, 'VALIDATION_ERROR', 'Check the submitted fields.', result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))) };
  }
  return { data: result.data };
}

export function errorCode(error: unknown): string | undefined {
  const value = error as { code?: string; message?: string } | null;
  return value?.code || value?.message;
}
