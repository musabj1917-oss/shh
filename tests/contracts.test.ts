import test from 'node:test';
import assert from 'node:assert/strict';
import { emailSchema,groupCreateSchema,locationPinSchema,locationUpdateSchema,meetsMinimumAge,passwordSchema,profilePatchSchema,pushTokenRegisterSchema,pushTokenUnregisterSchema,registerSchema,reportSchema,sendMessageSchema,usernameSchema } from '../packages/contracts/src/index.ts';

test('13-year eligibility uses calendar dates and rejects invalid/future dates',()=>{
 const today=new Date('2026-06-15T12:00:00.000Z');
 assert.equal(meetsMinimumAge('2013-06-15',today),true);
 assert.equal(meetsMinimumAge('2013-06-16',today),false);
 assert.equal(meetsMinimumAge('2027-01-01',today),false);
 assert.equal(meetsMinimumAge('2013-02-29',today),false);
});

test('registration input is normalized and requires a strong password and valid age date',()=>{
 const result=registerSchema.safeParse({email:' Person@Example.COM ',password:'correct horse battery staple',username:'Sky_7',displayName:'Sky',dateOfBirth:'2000-04-30'});
 assert.equal(result.success,true);
 if(result.success){assert.equal(result.data.email,'person@example.com');assert.equal(result.data.username,'sky_7');}
 assert.equal(registerSchema.safeParse({email:'p@example.com',password:'short',username:'abc',displayName:'P',dateOfBirth:'2000-02-30'}).success,false);
});

test('username, email, and password constraints reject malformed values',()=>{
 assert.equal(usernameSchema.safeParse('a_9').success,true);
 assert.equal(usernameSchema.safeParse('Bad Name').success,false);
 assert.equal(emailSchema.safeParse('person@example.com').success,true);
 assert.equal(emailSchema.safeParse('not-an-email').success,false);
 assert.equal(passwordSchema.safeParse('twelve chars').success,true);
 assert.equal(passwordSchema.safeParse('too-short').success,false);
});

test('profile birthday fields must be updated as a valid pair',()=>{
 assert.equal(profilePatchSchema.safeParse({birthdayMonth:2,birthdayDay:29}).success,true);
 assert.equal(profilePatchSchema.safeParse({birthdayMonth:2,birthdayDay:30}).success,false);
 assert.equal(profilePatchSchema.safeParse({birthdayMonth:4}).success,false);
});

test('message, group, and report contracts reject empty or malformed requests',()=>{
 assert.equal(sendMessageSchema.safeParse({text:'  hello  '}).success,true);
 assert.equal(sendMessageSchema.safeParse({text:'   '}).success,false);
 assert.equal(sendMessageSchema.safeParse({}).success,false);
 assert.equal(sendMessageSchema.safeParse({text:'later',expiresInHours:24}).success,true);
 assert.equal(sendMessageSchema.safeParse({text:'later',expiresInHours:2}).success,false);
 assert.equal(sendMessageSchema.safeParse({text:'later',expiresInHours:null}).success,true);
 assert.equal(groupCreateSchema.safeParse({name:'Weekend plans',memberIds:[]}).success,true);
 assert.equal(reportSchema.safeParse({category:'harassment',targetUserId:'78d82d70-3329-4515-ae20-4bfef3f7c4f2'}).success,true);
 assert.equal(reportSchema.safeParse({category:'harassment'}).success,false);
});

test('push token registration and unregistration contracts validate FCM tokens',()=>{
 assert.equal(pushTokenRegisterSchema.safeParse({token:'fcm_sample_device_registration_token_123',platform:'android'}).success,true);
 assert.equal(pushTokenRegisterSchema.safeParse({token:'fcm_sample_device_registration_token_123',platform:'web'}).success,true);
 assert.equal(pushTokenRegisterSchema.safeParse({token:'fcm_sample_device_registration_token_123'}).success,true);
 assert.equal(pushTokenRegisterSchema.safeParse({token:'short'}).success,false);
 assert.equal(pushTokenRegisterSchema.safeParse({token:'fcm_sample_device_registration_token_123',platform:'windows'}).success,false);
 assert.equal(pushTokenUnregisterSchema.safeParse({token:'fcm_sample_device_registration_token_123'}).success,true);
 assert.equal(pushTokenUnregisterSchema.safeParse({token:'short'}).success,false);
});

test('location contracts validate live coordinates and pins',()=>{
 assert.equal(locationUpdateSchema.safeParse({latitude:9.03,longitude:38.74,sharingMode:'friends'}).success,true);
 assert.equal(locationUpdateSchema.safeParse({latitude:9.03,longitude:38.74,durationMinutes:120}).success,true);
 assert.equal(locationUpdateSchema.safeParse({latitude:91.0,longitude:38.74}).success,false);
 assert.equal(locationUpdateSchema.safeParse({latitude:9.03,longitude:185.0}).success,false);
 assert.equal(locationPinSchema.safeParse({latitude:9.03,longitude:38.74,title:'Bole Medhanealem'}).success,true);
 assert.equal(locationPinSchema.safeParse({latitude:-45.1,longitude:12.3}).success,true);
 assert.equal(locationPinSchema.safeParse({latitude:100.0,longitude:0}).success,false);
});
