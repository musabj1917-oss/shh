import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../apps/api/src/app.ts';

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
 const response=await app.request('/v1/admin/me');
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
