import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let cached: NeonQueryFunction<false,false> | undefined;
export function getDb():NeonQueryFunction<false,false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('CONFIG_DATABASE_URL_MISSING');
  if (!cached) cached = neon(connectionString);
  return cached;
}

export function dbReady() {
  return Boolean(process.env.DATABASE_URL);
}
