import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpaqueToken,hashPassword,sha256,verifyPassword} from '../apps/api/src/security.ts';
import {verifyMediaSignature} from '../apps/api/src/services/storage.ts';

test('opaque tokens are unguessable-looking and SHA-256 hashes are deterministic',()=>{
 const first=createOpaqueToken(),second=createOpaqueToken();
 assert.notEqual(first,second);
 assert.ok(first.length>=40);
 assert.equal(sha256('haiku'),sha256('haiku'));
 assert.notEqual(sha256('haiku'),sha256('not-haiku'));
});

test('password hashes verify the original password and reject a different one',async()=>{
 const hash=await hashPassword('a long secure sample password');
 assert.equal(hash.startsWith('scrypt$32768$8$1$'),true);
 assert.equal(await verifyPassword('a long secure sample password',hash),true);
 assert.equal(await verifyPassword('incorrect password',hash),false);
 assert.equal(await verifyPassword('anything',null),false);
});

test('media signature checks reject MIME spoofing',()=>{
 const jpeg=new Uint8Array([0xff,0xd8,0xff,0xe0,0x00,0x10]);
 const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
 const fake=new Uint8Array([0x00,0x01,0x02,0x03]);
 assert.equal(verifyMediaSignature('image','image/jpeg',jpeg),true);
 assert.equal(verifyMediaSignature('image','image/png',png),true);
 assert.equal(verifyMediaSignature('image','image/jpeg',fake),false);
 assert.equal(verifyMediaSignature('video','video/mp4',fake),false);
});
