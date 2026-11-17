import test from 'node:test'
import assert from 'node:assert/strict'
import {hasStaffWorkspaceAccess,STAFF_WORKSPACE_PERMISSION,mergeStaffWorkspacePermission} from './staffWorkspace.js'
test('an ordinary teacher does not inherit the administrative workspace from employment',()=>assert.equal(hasStaffWorkspaceAccess({role:'TEACHER',permissions:[]}),false))
test('an explicit workspace grant preserves the teacher role',()=>{const account={role:'TEACHER',permissions:[STAFF_WORKSPACE_PERMISSION]};assert.equal(hasStaffWorkspaceAccess(account),true);assert.equal(account.role,'TEACHER')})
test('revoking the grant removes administrative access',()=>assert.equal(hasStaffWorkspaceAccess({role:'TEACHER',permissions:['academic_calendar_manage']}),false))
test('existing primary administrators and staff retain their workspace',()=>{assert.equal(hasStaffWorkspaceAccess({role:'STAFF'}),true);assert.equal(hasStaffWorkspaceAccess({role:'ADMIN'}),true);assert.equal(hasStaffWorkspaceAccess(null),false)})
test('the local grant survives a federated profile refresh',()=>assert.deepEqual(mergeStaffWorkspacePermission([STAFF_WORKSPACE_PERMISSION],['ecosystem:savanex']),['ecosystem:savanex',STAFF_WORKSPACE_PERMISSION]))
test('external providers cannot create a local administrative grant',()=>assert.deepEqual(mergeStaffWorkspacePermission([],[STAFF_WORKSPACE_PERMISSION,'ecosystem:savanex']),['ecosystem:savanex']))
