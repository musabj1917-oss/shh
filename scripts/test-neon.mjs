import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env if present
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  // .env not present or unreadable, continue
}

const connection = process.env.DATABASE_URL || process.env.DATABASE_MIGRATION_URL;

console.log('\n========================================');
console.log('   Haiku Messenger - Neon DB Checker   ');
console.log('========================================\n');

if (!connection || connection.includes('USER:PASSWORD') || connection.includes('HOST')) {
  console.log('⚠️  DATABASE_URL is not configured yet or has placeholder values.');
  console.log('To connect to your Neon database:');
  console.log('1. Copy .env.example to .env:');
  console.log('   cp .env.example .env');
  console.log('2. In your Neon Console (https://console.neon.tech):');
  console.log('   - Select your project');
  console.log('   - Copy the "Pooled connection" string into DATABASE_URL');
  console.log('   - Copy the "Direct connection" string into DATABASE_MIGRATION_URL');
  console.log('3. Re-run this check:');
  console.log('   npm run db:test\n');
  process.exit(0);
}

try {
  const parsed = new URL(connection);
  const host = parsed.hostname;
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const database = parsed.pathname.replace(/^\//, '');

  console.log(`Connecting to Neon host: ${host}`);
  console.log(`Database: ${database} | User: ${username}`);

  const start = Date.now();
  const queryNeon = async (sql) => {
    const response = await fetch(`https://${host}/sql`, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': connection,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql, params: [] })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Neon HTTP error (${response.status}): ${text}`);
    }
    return response.json();
  };

  const verResult = await queryNeon('SELECT version(), current_database(), current_user, now();');
  const duration = Date.now() - start;

  console.log(`✅ Connected to Neon successfully in ${duration}ms!`);
  if (verResult.rows && verResult.rows[0]) {
    console.log(`PostgreSQL Version: ${verResult.rows[0].version?.split(' on ')[0] || 'Unknown'}`);
    console.log(`Current Time (DB): ${verResult.rows[0].now}`);
  }

  // Check migrations table
  try {
    const migCheck = await queryNeon(`SELECT count(*)::int as count FROM public.schema_migrations`);
    const count = migCheck.rows?.[0]?.count || 0;
    console.log(`\nApplied migrations: ${count}`);
    const migrations = await queryNeon(`SELECT name, applied_at FROM public.schema_migrations ORDER BY applied_at ASC`);
    for (const m of migrations.rows || []) {
      console.log(`  - [✓] ${m.name} (${new Date(m.applied_at).toISOString()})`);
    }
  } catch (err) {
    console.log('\n⚠️  Migration table public.schema_migrations does not exist yet.');
    console.log('Run `npm run migrate` to apply migrations to your Neon database.');
  }

  // Check tables
  const tables = await queryNeon(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`\nPublic tables in database (${tables.rows?.length || 0}):`);
  const names = (tables.rows || []).map(r => r.table_name);
  console.log(names.length > 0 ? names.join(', ') : '  (None yet - ready for migration)');

  console.log('\n========================================');
  console.log('✅ Neon database connection is READY for Vercel!');
  console.log('========================================\n');
} catch (err) {
  console.error('\n❌ Failed to connect to Neon database:');
  console.error(err.message);
  console.log('\nPlease check that:');
  console.log('1. The connection string in .env is correct and includes password.');
  console.log('2. Network connection allows outbound HTTPS to *.neon.tech.');
  console.log('3. sslmode=require is present in the connection string.\n');
  process.exit(1);
}
