import {inviteTokenFromUrl} from '../src/invites';

const token='A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0t1U2v';

test('group invitation links accept the custom scheme and a trailing query',()=>{
 expect(inviteTokenFromUrl(`haikumessenger://join/${token}`)).toBe(token);
 expect(inviteTokenFromUrl(`haikumessenger://join/${token}?source=share`)).toBe(token);
});

test('an HTTPS universal-link style URL can carry the same token',()=>{
 expect(inviteTokenFromUrl(`https://haiku.example/join/${token}`)).toBe(token);
});

test('unrelated or malformed URLs do not produce a token',()=>{
 expect(inviteTokenFromUrl('haikumessenger://join/short')).toBeNull();
 expect(inviteTokenFromUrl('https://haiku.example/profile/123')).toBeNull();
});
