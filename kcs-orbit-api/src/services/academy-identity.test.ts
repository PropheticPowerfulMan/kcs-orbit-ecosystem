import test from 'node:test';import assert from 'node:assert/strict';import {academySourceIdentity} from './academy-identity';
test('separate Academy user retains its verified registry binding',()=>{assert.equal(academySourceIdentity('login-user',{sourceIdentityId:'registry-teacher'}),'registry-teacher')});
test('unbound or malformed audit metadata never becomes a different identity',()=>{for(const x of [null,[],{},'untrusted',{sourceIdentityId:''},{sourceIdentityId:22},{sourceIdentityId:'x'.repeat(129)}])assert.equal(academySourceIdentity('login-user',x),'login-user')});
