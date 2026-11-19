import {test} from 'node:test'
import assert from 'node:assert/strict'
import {isVerifiedInstitutionalStudentAlias as valid} from './institutionalStudentAlias.js'
const local={role:'STUDENT',orbitUserId:'official-student',email:'learner@example.invalid'}
const external={provider:'SAVANEX',role:'STUDENT',email:local.email,institutionalStudentNumber:'KCS-STU-ABCDEF012345'}
const official={id:local.orbitUserId,studentNumber:external.institutionalStudentNumber,email:local.email,status:'ACTIVE'}
test('canonical student matricule, linked Orbit ID and verified provider email allow a secondary code',()=>assert.equal(valid(local,official.studentNumber,external,[official]),true))
test('case and boundary whitespace normalize consistently',()=>assert.equal(valid({...local,email:' Learner@example.invalid '},official.studentNumber.toLowerCase(),{...external,institutionalStudentNumber:' '+official.studentNumber.toLowerCase()+' '},[official]),true))
test('email alone never proves ownership',()=>assert.equal(valid(local,official.studentNumber,{...external,institutionalStudentNumber:undefined},[official]),false))
test('different or missing Orbit identity is rejected',()=>{for(const orbitUserId of ['other',null])assert.equal(valid({...local,orbitUserId},official.studentNumber,external,[official]),false)})
test('different local or official matricule is rejected',()=>{assert.equal(valid(local,'KCS-STU-OTHER00',external,[official]),false);assert.equal(valid(local,official.studentNumber,external,[{...official,studentNumber:'KCS-STU-OTHER00'}]),false)})
test('same-name, different-email and shared family accounts are rejected',()=>assert.equal(valid(local,official.studentNumber,{...external,email:'other@example.invalid'},[official]),false))
test('ambiguous official matricule is rejected',()=>assert.equal(valid(local,official.studentNumber,external,[official,{...official,id:'second'}]),false))
test('untrusted provider and role escalation are rejected',()=>{for(const provider of [undefined,'EDUPAY'])assert.equal(valid(local,official.studentNumber,{...external,provider},[official]),false);assert.equal(valid(local,official.studentNumber,{...external,role:'ADMIN'},[official]),false);assert.equal(valid({...local,role:'ADMIN'},official.studentNumber,external,[official]),false)})
test('inactive, archived or unknown status cannot activate an alias',()=>{for(const status of [undefined,'ARCHIVED','GRADUATED','DISMISSED','INACTIVE'])assert.equal(valid(local,official.studentNumber,external,[{...official,status}]),false)})
