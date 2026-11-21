import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileSubmissionRoster}from './gradeSubmissionRoster.js'
test('resubmission includes withdrawn learners without overwriting explicitly ungraded current learners',()=>{
 assert.deepEqual(reconcileSubmissionRoster(['graded','ungraded'],['graded'],['graded','ungraded','withdrawn','withdrawn']),{withdrawnIds:['withdrawn'],affectedIds:['graded','withdrawn']})
})
test('unchanged enrollment is idempotent and lock order is deterministic',()=>{
 assert.deepEqual(reconcileSubmissionRoster(['b','a'],['b','a'],['a','b']),{withdrawnIds:[],affectedIds:['a','b']})
})
