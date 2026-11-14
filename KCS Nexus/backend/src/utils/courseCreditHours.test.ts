import {test} from 'node:test'
import assert from 'node:assert/strict'
import {allowsTeacherCourseCredits as allowed} from './courseCreditHours.js'
test('new or changed teacher course credits are limited to 1 and 2',()=>{
 for(const credits of [1,2])assert.equal(allowed(credits,undefined),true)
 for(const credits of [0,3,15,60,1.5])assert.equal(allowed(credits,undefined),false)
 assert.equal(allowed(3,1),false);assert.equal(allowed(2,15),true)
})
test('historical credit weights survive unchanged roster and submission syncs',()=>{
 assert.equal(allowed(undefined,15),true);assert.equal(allowed(15,15),true)
 assert.equal(allowed(3,15),false);assert.equal(allowed(3,15,true),true)
 assert.equal(allowed(3,undefined,true),false)
})
