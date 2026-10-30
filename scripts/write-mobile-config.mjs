import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'apps/mobile/src/config.generated.ts');
const base=(process.env.HAIKU_API_BASE_URL||'http://10.0.2.2:3001/v1').trim().replace(/\/$/,'');
let parsed;
try{parsed=new URL(base);}catch{console.error('HAIKU_API_BASE_URL must be an absolute URL.');process.exit(2);}
if(!['http:','https:'].includes(parsed.protocol)){console.error('HAIKU_API_BASE_URL must use http or https.');process.exit(2);}
if(parsed.protocol==='http:'&&process.env.NODE_ENV==='production'){console.error('Use HTTPS for production API URLs.');process.exit(2);}
await writeFile(target,`// Generated from HAIKU_API_BASE_URL. Do not put secrets here.\nexport const API_BASE_URL = ${JSON.stringify(base)};\n`,'utf8');
console.log(`Mobile API URL configured: ${base}`);
