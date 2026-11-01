import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env if present
try {
  const envContent = await readFile(path.join(root, '.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // .env not present, continue with environment
}

const connection = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!connection || connection.includes('USER:PASSWORD') || connection.includes('HOST')) {
  console.error('\n❌ Set DATABASE_MIGRATION_URL or DATABASE_URL before migrating.');
  console.error('Example: DATABASE_URL="postgresql://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require" npm run migrate\n');
  process.exit(2);
}

const isNeon = connection.includes('neon.tech');
const psqlBin = process.env.PSQL_BIN || 'psql';

// Helper to query Neon over HTTPS (zero CLI binary dependencies required)
async function executeNeonHttp(sql) {
  const parsed = new URL(connection);
  const host = parsed.hostname;
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const response = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql, params: [] })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Neon HTTP error (${response.status}): ${text}`);
  }
  return response.json();
}

function hasPsqlBinary() {
  try {
    const res = spawnSync(psqlBin, ['--version'], { encoding: 'utf8' });
    return res.status === 0;
  } catch {
    return false;
  }
}

const usePsql = !isNeon || (process.env.FORCE_PSQL === 'true' && hasPsqlBinary());

console.log(`Running database migrations via ${usePsql ? 'psql CLI' : 'Neon Serverless HTTP'}...`);

// 1. Ensure schema_migrations table exists
if (usePsql) {
  const res = spawnSync(psqlBin, ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', connection, '-c', 
    'CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'],
    { encoding: 'utf8', stdio: 'inherit' });
  if (res.status !== 0) throw new Error(`Failed to ensure migrations table with psql`);
} else {
  await executeNeonHttp('CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
}

// 2. Discover migration files
const directory = path.join(root, 'database', 'migrations');
const files = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name)).sort();

for (const name of files) {
  let isApplied = false;
  if (usePsql) {
    const check = spawnSync(psqlBin, ['--no-psqlrc', '-A', '-t', '-v', 'ON_ERROR_STOP=1', connection, '-c',
      `SELECT 1 FROM public.schema_migrations WHERE name='${name}'`], { encoding: 'utf8' });
    if (check.status !== 0) throw new Error(`Could not check migration ${name}`);
    isApplied = check.stdout.trim() === '1';
  } else {
    const check = await executeNeonHttp(`SELECT 1 FROM public.schema_migrations WHERE name='${name}'`);
    isApplied = check.rows && check.rows.length > 0;
  }

  if (isApplied) {
    console.info(`skip ${name}`);
    continue;
  }

  const file = path.join(directory, name);
  const original = await readFile(file, 'utf8');
  console.info(`apply ${name}...`);

  if (usePsql) {
    const sql = original.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
    const temp = path.join(root, '.migration-current.sql');
    await writeFile(temp, `BEGIN;\n${sql}\nINSERT INTO public.schema_migrations(name) VALUES ('${name}');\nCOMMIT;\n`, 'utf8');
    try {
      const run = spawnSync(psqlBin, ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', connection, '-f', temp], { encoding: 'utf8', stdio: 'inherit' });
      if (run.status !== 0) throw new Error(`psql failed applying ${name}`);
    } finally {
      await unlink(temp).catch(() => {});
    }
  } else {
    // Execute over Neon HTTPS
    // Wrap with migration recording in single transaction
    const combinedSql = `${original}\nINSERT INTO public.schema_migrations(name) VALUES ('${name}');`;
    await executeNeonHttp(combinedSql);
  }
  console.info(`✓ applied ${name}`);
}

console.info('✅ Database migrations successfully applied.');
