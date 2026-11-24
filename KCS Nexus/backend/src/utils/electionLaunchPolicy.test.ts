import test from 'node:test'
import assert from 'node:assert/strict'
import {electionManagementAccess,electionReturnPath,electionLaunchUrl,electionSessionAllows} from './electionLaunchPolicy.js'
test('only the configured SuperAdmin manages; Principal and ST retain a read-only ceiling',()=>{
 assert.equal(electionManagementAccess('configured-superadmin',{role:'ADMIN'}),'MANAGE')
 for(const user of [{role:'ADMIN'},{role:'TEACHER',permissions:['nexus:principal-workspace','nexus:elections-manage']},{role:'TEACHER',permissions:['nexus:senior-teacher-workspace','nexus:elections-manage']}])assert.equal(electionManagementAccess('person',user),'OBSERVE')
 assert.equal(electionManagementAccess('person',{role:'TEACHER'}),null)
 assert.equal(electionManagementAccess('person',{role:'STAFF',permissions:['nexus:media-only','nexus:elections-manage']}),null)
 assert.equal(electionManagementAccess('person',{role:'STAFF',permissions:['nexus:elections-manage']}),'MANAGE')
})
test('handoff URLs contain only a one-time fragment and returns stay in the original workspace',()=>{
 for(const audience of ['PARENT','STUDENT','ADMIN'] as const){
  const url=new URL(electionLaunchUrl(audience,'random-ticket'));assert.equal(url.search,'');assert.equal(url.hash,'#launch=random-ticket')
  const own=audience==='ADMIN'?'/admin':'/portal/'+audience.toLowerCase()
  assert.equal(electionReturnPath(audience,own+'/settings'),own+'/settings')
  for(const value of ['https://attacker.invalid/admin','//attacker.invalid','/portal/student/../../admin','/admin\\evil','javascript:alert(1)'])assert.ok(electionReturnPath(audience,value).startsWith(own))
 }
})
test('electoral tokens cannot act in Nexus, switch electorate, launch another session or mutate as an observer',()=>{
 assert.equal(electionSessionAllows('PARENT','GET','/api/elections/PARENT/session'),true)
 assert.equal(electionSessionAllows('STUDENT','POST','/api/elections/STUDENT/vote'),true)
 assert.equal(electionSessionAllows('STUDENT','POST','/api/elections/STUDENT/applications/id/photo'),true)
 for(const url of ['/api/elections/PARENT/vote','/api/elections/admin/people','/api/elections/launch','/api/messages','/api/auth/change-password'])assert.equal(electionSessionAllows('STUDENT','POST',url),false)
 assert.equal(electionSessionAllows('ADMIN','GET','/api/elections/admin/elections?audience=STUDENT',true),true)
 assert.equal(electionSessionAllows('ADMIN','POST','/api/elections/admin/elections',true),false)
 assert.equal(electionSessionAllows('ADMIN','POST','/api/elections/admin/elections',false),true)
 assert.equal(electionSessionAllows('ADMIN','GET','/api/admin/students'),false)
 assert.equal(electionSessionAllows('ADMIN','GET','/api/elections/admin/%2e%2e/launch'),false)
 assert.equal(electionSessionAllows('OTHER','GET','/api/elections/admin/access'),false)
})
