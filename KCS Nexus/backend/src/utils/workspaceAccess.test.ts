import test from 'node:test'
import assert from 'node:assert/strict'
import {selectedWorkspacePermissions,toggleWorkspacePermissions,workspaceAccessView,workspaceAccessVersion} from './workspaceAccess.js'
import {STAFF_WORKSPACE_PERMISSION as staff,PRINCIPAL_WORKSPACE_PERMISSION as principal,SENIOR_WORKSPACE_PERMISSION as senior,mergeStaffWorkspacePermission,hasSeniorWorkspaceAccess} from './staffWorkspace.js'
test('Teacher can hold Staff, Principal and ST together without losing teaching or other rights',()=>{
 const account={role:'TEACHER',permissions:['academic_calendar_manage','ecosystem:savanex']}
 const permissions=selectedWorkspacePermissions(account,['staff','principal','senior']),view=workspaceAccessView({...account,permissions})
 assert.deepEqual(view.workspaces,['staff','principal','senior']);assert.equal(account.role,'TEACHER');assert.ok(permissions.includes('academic_calendar_manage'));assert.ok(permissions.includes('ecosystem:savanex'))
})
test('revoking one workspace preserves all other selected rights',()=>{
 const account={role:'TEACHER',permissions:[staff,principal,senior,'custom:retained']}
 assert.deepEqual(workspaceAccessView({...account,permissions:selectedWorkspacePermissions(account,['staff','senior'])}).workspaces,['staff','senior'])
 assert.ok(selectedWorkspacePermissions(account,['staff','senior']).includes('custom:retained'))
})
test('legacy single-workspace updates never erase other grants',()=>{
 const account={role:'TEACHER',permissions:[principal,senior]}
 assert.deepEqual(toggleWorkspacePermissions(account,'staff',true),[principal,senior,staff])
 assert.deepEqual(toggleWorkspacePermissions(account,'principal',false),[senior])
})
test('primary role workspaces remain included when extra grants are cleared',()=>{
 assert.deepEqual(workspaceAccessView({role:'ADMIN',permissions:[]}).workspaces,['staff','principal'])
 assert.deepEqual(workspaceAccessView({role:'STAFF',permissions:[]}).includedWorkspaces,['staff'])
 assert.deepEqual(workspaceAccessView({role:'PARENT',permissions:[]}).workspaces,[])
})
test('concurrent grant changes alter the revision while unrelated permissions do not',()=>{
 assert.notEqual(workspaceAccessVersion({role:'TEACHER',permissions:[staff]}),workspaceAccessVersion({role:'TEACHER',permissions:[staff,senior]}))
 assert.equal(workspaceAccessVersion({role:'TEACHER',permissions:[staff]}),workspaceAccessVersion({role:'TEACHER',permissions:[staff,'custom:other']}))
})
test('federation retains local combined grants but cannot introduce any',()=>{
 assert.deepEqual(mergeStaffWorkspacePermission([staff,principal,senior],['ecosystem:savanex',senior]),['ecosystem:savanex',staff,principal,senior])
 assert.deepEqual(mergeStaffWorkspacePermission([],[staff,principal,senior]),[])
 assert.equal(hasSeniorWorkspaceAccess({role:'STAFF',permissions:['nexus:media-only',senior]}),false)
})
