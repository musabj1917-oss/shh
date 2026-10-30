import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const connection=process.env.DATABASE_MIGRATION_URL||process.env.DATABASE_URL;
if(!connection){console.error('Set DATABASE_MIGRATION_URL (direct Neon connection) before migrating.');process.exit(2);}
const psql=process.env.PSQL_BIN||'psql';
const run=(args)=>{
  const result=spawnSync(psql,['--no-psqlrc','-v','ON_ERROR_STOP=1',...args],{encoding:'utf8',stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`psql exited with status ${result.status}`);
};
run([connection,'-c','CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())']);
const directory=path.join(root,'database','migrations');
const files=(await readdir(directory)).filter((name)=>/^\d+_[a-z0-9_]+\.sql$/i.test(name)).sort();
for(const name of files){
  const check=spawnSync(psql,['--no-psqlrc','-A','-t','-v','ON_ERROR_STOP=1',connection,'-c',`SELECT 1 FROM public.schema_migrations WHERE name='${name}'`],{encoding:'utf8'});
  if(check.error)throw check.error;
  if(check.status!==0)throw new Error(`Could not check migration ${name}`);
  if(check.stdout.trim()==='1'){console.info(`skip ${name}`);continue;}
  const file=path.join(directory,name);
  const original=await readFile(file,'utf8');
  const sql=original.replace(/^\s*BEGIN;\s*/i,'').replace(/\s*COMMIT;\s*$/i,'');
  if(sql===original)throw new Error(`Migration ${name} must have one outer BEGIN/COMMIT pair.`);
  const temp=path.join(root,'.migration-current.sql');
  await writeFile(temp,`BEGIN;\n${sql}\nINSERT INTO public.schema_migrations(name) VALUES ('${name}');\nCOMMIT;\n`,'utf8');
  try{console.info(`apply ${name}`);run([connection,'-f',temp]);}finally{await unlink(temp).catch(()=>{});}
}
console.info('Database migrations applied.');
