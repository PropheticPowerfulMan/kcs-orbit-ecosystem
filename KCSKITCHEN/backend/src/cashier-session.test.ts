import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import {cashierSessionMatches} from './cashier-session.js'
import {hashLocalPassword,verifyLocalPassword} from './local-password.js'
const account={id:'primary',isActive:true,version:2},session={userId:'kitchen-cashier:primary',role:'CASHIER',credentialScope:'KITCHEN_CASHIER_LOCAL',credentialVersion:2}
test('local cashier sessions retain their own identity and credential version',()=>assert.equal(cashierSessionMatches(session,account),true))
test('Nexus identities and legacy unversioned sessions cannot impersonate a local cashier',()=>{assert.equal(cashierSessionMatches({...session,userId:'configured-superadmin'},account),false);assert.equal(cashierSessionMatches({...session,credentialScope:undefined},account),false);assert.equal(cashierSessionMatches({...session,role:'KITCHEN_ADMIN'},account),false)})
test('reset, deactivation and deletion invalidate existing cashier sessions',()=>{assert.equal(cashierSessionMatches(session,{...account,version:3}),false);assert.equal(cashierSessionMatches(session,{...account,isActive:false}),false);assert.equal(cashierSessionMatches(session,null),false)})
test('a recovered bcrypt hash is verified locally and cannot follow changes to Nexus',()=>{const old='SyntheticOld!Cashier984',next='SyntheticNew!Nexus648';let nexusHash=bcrypt.hashSync(old,8);const kitchen='bcrypt:'+nexusHash;nexusHash=bcrypt.hashSync(next,8);assert.equal(verifyLocalPassword(old,kitchen),true);assert.equal(verifyLocalPassword(next,kitchen),false);assert.equal(bcrypt.compareSync(next,nexusHash),true);assert.equal(bcrypt.compareSync(old,nexusHash),false)})
test('Kitchen resets keep scrypt and never redefine a Nexus credential',()=>{const kitchen=hashLocalPassword('CashierOnly!Password875');assert.ok(kitchen.startsWith('scrypt:'));assert.equal(verifyLocalPassword('CashierOnly!Password875',kitchen),true);assert.equal(verifyLocalPassword('Other!Password875',kitchen),false);assert.equal(verifyLocalPassword('x','bcrypt:invalid'),false);assert.equal(verifyLocalPassword('x','bcrypt:$2b$31$'+'.'.repeat(53)),false)})
