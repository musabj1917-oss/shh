import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.ts';

test('liveness check exposes only non-secret configuration flags',async()=>{
 const response=await app.request('/v1/health');
 assert.equal(response.status,200);
 const body=await response.json() as {status:string;databaseConfigured:boolean;realtimeConfigured:boolean};
 assert.equal(body.status,'ok');
 assert.equal(typeof body.databaseConfigured,'boolean');
 assert.equal(typeof body.realtimeConfigured,'boolean');
 assert.equal(JSON.stringify(body).includes('DATABASE_URL'),false);
});

test('admin endpoints reject anonymous requests before database access',async()=>{
 const me=await app.request('/v1/admin/me');
 assert.equal(me.status,401);
 const versions=await app.request('/v1/admin/app-versions');
 assert.equal(versions.status,401);
 const putVersions=await app.request('/v1/admin/app-versions',{
  method:'PUT',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({platform:'android',latestVersion:'1.0.0',minSupportedVersion:'1.0.0',downloadUrl:'https://example.com'})
 });
 assert.equal(putVersions.status,401);
});

test('public app version check validates parameters and returns update status',async()=>{
 const missing=await app.request('/v1/app/version');
 assert.equal(missing.status,400);

 const badPlatform=await app.request('/v1/app/version?platform=windows&version=1.0.0');
 assert.equal(badPlatform.status,400);

 const check=await app.request('/v1/app/version?platform=android&version=0.0.1');
 // Since database might not be connected in offline test, it will either return 200 or 503 or default version payload
 assert.ok([200, 503].includes(check.status));
 if (check.status === 200) {
  const body=await check.json() as {updateAvailable:boolean;forceUpdate:boolean};
  assert.equal(typeof body.updateAvailable,'boolean');
  assert.equal(typeof body.forceUpdate,'boolean');
 }
});

test('moderator message removal requires an authenticated administrator session',async()=>{
 const response=await app.request('/v1/admin/messages/00000000-0000-4000-8000-000000000001/remove',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reason:'Policy violation'})});
 assert.equal(response.status,401);
 const body=await response.json() as {error:{code:string}};
 assert.equal(body.error.code,'AUTH_REQUIRED');
});

test('group invite listing, creation, and redemption require an authenticated session',async()=>{
 const groupId='00000000-0000-4000-8000-000000000001';
 const listing=await app.request(`/v1/groups/${groupId}/invites`);
 assert.equal(listing.status,401);
 const creation=await app.request(`/v1/groups/${groupId}/invites`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})});
 assert.equal(creation.status,401);
 const redemption=await app.request(`/v1/groups/join/${'a'.repeat(43)}`,{method:'POST'});
 assert.equal(redemption.status,401);
});
