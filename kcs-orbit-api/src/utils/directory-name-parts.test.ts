import test from 'node:test'
import assert from 'node:assert/strict'
import {directoryNameParts} from './directory-name-parts'
const fallback={firstName:'Parent',middleName:'Family Given',lastName:'Compound'}
test('complete structured compound names preserve an intentionally absent middle name',()=>{
 assert.deepEqual(directoryNameParts({firstName:'Given Parent',middleName:null,lastName:'Compound Family'},fallback),{firstName:'Given Parent',middleName:null,lastName:'Compound Family'})
 assert.equal(directoryNameParts({firstName:'Given',middleName:'',lastName:'Family'},fallback).middleName,null)
})
test('explicit middle names are retained and legacy display-only identities retain fallback',()=>{
 assert.equal(directoryNameParts({firstName:'Given',middleName:'Middle',lastName:'Family'},fallback).middleName,'Middle')
 assert.deepEqual(directoryNameParts({},fallback),fallback)
})
