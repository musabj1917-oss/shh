import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_BYTES = 64;

type ScryptOptions={N:number;r:number;p:number;maxmem:number};
function derive(password:string,salt:Buffer,length:number,options:ScryptOptions):Promise<Buffer>{
  return new Promise((resolve,reject)=>{
    scryptCallback(password,salt,length,options,(error,key)=>error?reject(error):resolve(key as Buffer));
  });
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derive(password, salt, SCRYPT_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algorithm, nText, rText, pText, saltText, hashText] = stored.split('$');
  if (algorithm !== 'scrypt' || !nText || !rText || !pText || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, 'base64url');
  try {
    const actual = await derive(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(nText), r: Number(rText), p: Number(pText), maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function constantTimeTokenMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
