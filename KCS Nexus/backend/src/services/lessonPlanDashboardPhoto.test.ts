import test from 'node:test'
import assert from 'node:assert/strict'
import {readLessonPlanDashboardPhoto} from './lessonPlanDashboardPhoto.js'
const bearer='Bearer '+ 'a'.repeat(40),photo='data:image/png;base64,aGVsbG8='
test('only the server-verified Nexus identity can supply the personal avatar',async()=>{const reads:string[]=[];const result=await readLessonPlanDashboardPhoto(bearer,{verifySession:async()=>({allowed:true,nexusUserId:'teacher-1'}),readAvatar:async id=>{reads.push(id);return photo}});assert.deepEqual(result,{avatar:photo});assert.deepEqual(reads,['teacher-1'])})
test('anonymous, blocked and unlinked sessions never read a portrait',async()=>{let reads=0;for(const [token,identity]of[['',{}],[bearer,{allowed:false,nexusUserId:'victim'}],[bearer,{allowed:true}]]as const)await assert.rejects(readLessonPlanDashboardPhoto(token,{verifySession:async()=>identity,readAvatar:async()=>{reads++;return photo}}));assert.equal(reads,0)})
test('missing personal photo stays empty and cannot fall back to an official URL',async()=>{for(const value of[null,'https://example.invalid/official.jpg'])assert.deepEqual(await readLessonPlanDashboardPhoto(bearer,{verifySession:async()=>({allowed:true,nexusUserId:'teacher-1'}),readAvatar:async()=>value}),{avatar:null})})
