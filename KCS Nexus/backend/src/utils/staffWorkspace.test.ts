import test from 'node:test'
import assert from 'node:assert/strict'
import {hasStaffWorkspaceAccess,STAFF_WORKSPACE_PERMISSION,mergeStaffWorkspacePermission} from './staffWorkspace.js'
test('an ordinary teacher does not inherit the administrative workspace from employment',()=>assert.equal(hasStaffWorkspaceAccess({role:'TEACHER',permissions:[]}),false))
test('an explicit workspace grant preserves the teacher role',()=>{const account={role:'TEACHER',permissions:[STAFF_WORKSPACE_PERMISSION]};assert.equal(hasStaffWorkspaceAccess(account),true);assert.equal(account.role,'TEACHER')})
test('revoking the grant removes administrative access',()=>assert.equal(hasStaffWorkspaceAccess({role:'TEACHER',permissions:['academic_calendar_manage']}),false))
test('existing primary administrators and staff retain their workspace',()=>{assert.equal(hasStaffWorkspaceAccess({role:'STAFF'}),true);assert.equal(hasStaffWorkspaceAccess({role:'ADMIN'}),true);assert.equal(hasStaffWorkspaceAccess(null),false)})
test('the local grant survives a federated profile refresh',()=>assert.deepEqual(mergeStaffWorkspacePermission([STAFF_WORKSPACE_PERMISSION],['ecosystem:savanex']),['ecosystem:savanex',STAFF_WORKSPACE_PERMISSION]))
test('external providers cannot create a local administrative grant',()=>assert.deepEqual(mergeStaffWorkspacePermission([],[STAFF_WORKSPACE_PERMISSION,'ecosystem:savanex']),['ecosystem:savanex']))

import {hasPrincipalWorkspaceAccess, PRINCIPAL_WORKSPACE_PERMISSION, requestedWorkspaceRole} from './staffWorkspace.js'
test('Staff capability does not grant Principal authority',()=>assert.equal(hasPrincipalWorkspaceAccess({role:'TEACHER',permissions:[STAFF_WORKSPACE_PERMISSION]}),false))
test('Principal capability retains primary teaching identity',()=>{const a={role:'TEACHER',permissions:[PRINCIPAL_WORKSPACE_PERMISSION]};assert.equal(hasPrincipalWorkspaceAccess(a),true);assert.equal(hasStaffWorkspaceAccess(a),true);assert.equal(a.role,'TEACHER')})
test('Principal works as Teacher when the request selects Teacher',()=>assert.equal(requestedWorkspaceRole({role:'TEACHER',permissions:[PRINCIPAL_WORKSPACE_PERMISSION]},'teacher'),'teacher'))
test('Staff cannot select Principal through a forged header',()=>assert.equal(requestedWorkspaceRole({role:'TEACHER',permissions:[STAFF_WORKSPACE_PERMISSION]},'admin'),null))
test('a Principal grant allows Principal requests',()=>assert.equal(requestedWorkspaceRole({role:'TEACHER',permissions:[PRINCIPAL_WORKSPACE_PERMISSION]},'admin'),'admin'))
test('revoked Principal grants cannot use existing sessions in Principal mode',()=>assert.equal(requestedWorkspaceRole({role:'TEACHER',permissions:[]},'admin'),null))
test('native administrators need their own teaching profile to select Teacher',()=>{assert.equal(requestedWorkspaceRole({role:'ADMIN'},'teacher'),null);assert.equal(requestedWorkspaceRole({role:'ADMIN'},'teacher',true),'teacher')})
test('unknown or missing workspace requests do not promote accounts',()=>{assert.equal(requestedWorkspaceRole({role:'ADMIN'},'superadmin'),null);assert.equal(requestedWorkspaceRole(null,'admin'),null)})
test('Media accounts cannot switch into administrative or teaching contexts',()=>{for(const mode of ['admin','staff','teacher'])assert.equal(requestedWorkspaceRole({role:'STAFF',permissions:['nexus:media-only',PRINCIPAL_WORKSPACE_PERMISSION]},mode,true),null)})
test('Principal capabilities remain local during federated refreshes',()=>{assert.deepEqual(mergeStaffWorkspacePermission([PRINCIPAL_WORKSPACE_PERMISSION],['ecosystem:savanex']),['ecosystem:savanex',PRINCIPAL_WORKSPACE_PERMISSION]);assert.deepEqual(mergeStaffWorkspacePermission([],[PRINCIPAL_WORKSPACE_PERMISSION]),[])})

test('Root can delegate Staff to a parent without changing their primary identity',()=>assert.equal(requestedWorkspaceRole({role:'PARENT',permissions:[STAFF_WORKSPACE_PERMISSION]},'staff'),'staff'))
test('Root can delegate Principal to an active student without creating a teaching identity',()=>{const account={role:'STUDENT',permissions:[PRINCIPAL_WORKSPACE_PERMISSION]};assert.equal(requestedWorkspaceRole(account,'admin'),'admin');assert.equal(requestedWorkspaceRole(account,'teacher'),null)})
