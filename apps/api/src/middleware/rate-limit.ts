import { getDb } from '../db.js';
import { sha256 } from '../security.js';
import { jsonError } from '../http.js';
import type { ApiContext } from '../types.js';

/** Persistent fixed-window rate limit shared across serverless instances. */
export async function enforceRateLimit(c: ApiContext, bucket: string, limit: number, windowSeconds: number) {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = `${bucket}:${sha256(ip)}`.slice(0, 240);
  try {
    const rows = await getDb()`INSERT INTO rate_limit_buckets (bucket_key,window_started_at,hit_count)
      VALUES (${key},now(),1)
      ON CONFLICT(bucket_key) DO UPDATE SET
        hit_count=CASE WHEN rate_limit_buckets.window_started_at <= now()-(${windowSeconds}*interval '1 second') THEN 1 ELSE rate_limit_buckets.hit_count+1 END,
        window_started_at=CASE WHEN rate_limit_buckets.window_started_at <= now()-(${windowSeconds}*interval '1 second') THEN now() ELSE rate_limit_buckets.window_started_at END
      RETURNING hit_count,window_started_at`;
    const row = rows[0] as {hit_count:number;window_started_at:Date|string};
    if (Number(row.hit_count) > limit) {
      const startedAt = new Date(row.window_started_at).getTime();
      const retryAfter = Math.max(1, windowSeconds - Math.floor((Date.now() - startedAt) / 1000));
      c.header('Retry-After', String(retryAfter));
      return jsonError(c, 429, 'RATE_LIMITED', 'Too many requests. Please try again shortly.');
    }
    return null;
  } catch {
    return jsonError(c, 503, 'RATE_LIMIT_UNAVAILABLE', 'Please retry shortly.');
  }
}
