import 'dotenv/config';
import { z } from 'zod';

const production = process.env.NODE_ENV === 'production';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).default(production ? '' : 'postgres://postgres:postgres@localhost:5432/haiiku'),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  JWT_SECRET: z.string().min(32).default(production ? '' : 'dev-only-secret-change-before-deployment-123456')
});

// Production must never start with a known, public JWT signing key or a local database fallback.
export const env = envSchema.parse(process.env);

