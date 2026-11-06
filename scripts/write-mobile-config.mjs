import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'apps/mobile/src/config.generated.ts');

let base = (
  process.env.HAIKU_API_BASE_URL ||
  process.env.HAIKU_API_URL ||
  process.env.API_BASE_URL ||
  process.env.API_PUBLIC_URL ||
  'https://shh-jet-five.vercel.app/v1'
).trim().replace(/\/+$/, '');

// Ensure /v1 endpoint prefix is present for mobile API client routes
if (!base.endsWith('/v1')) {
  base = `${base}/v1`;
}

let parsed;
try {
  parsed = new URL(base);
} catch {
  console.error(`Invalid API URL: ${base}. Must be a valid absolute URL.`);
  process.exit(2);
}

if (!['http:', 'https:'].includes(parsed.protocol)) {
  console.error(`API URL must use http or https. Got: ${parsed.protocol}`);
  process.exit(2);
}

await writeFile(
  target,
  `// Generated from HAIKU_API_BASE_URL / HAIKU_API_URL. Do not put secrets here.\nexport const API_BASE_URL = ${JSON.stringify(base)};\n`,
  'utf8'
);

console.log(`Mobile API URL successfully configured: ${base}`);
