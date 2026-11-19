import test from 'node:test'

import assert from 'node:assert/strict'

import {isFinalYear,readiness,duplicateApplication} from './seniorTeacherPolicy.js'

import {SENIOR_WORKSPACE_PERMISSION,hasSeniorWorkspaceAccess,hasPrincipalWorkspaceAccess,mergeStaffWorkspacePermission,requestedWorkspaceRole} from './staffWorkspace.js'

test('senior workspace is a local capability and never Principal authority',()=>{const u={role:'TEACHER',permissions:[SENIOR_WORKSPACE_PERMISSION]};assert.ok(hasSeniorWorkspaceAccess(u));assert.equal(hasPrincipalWorkspaceAccess(u),false);assert.equal(requestedWorkspaceRole(u,'admin'),null);assert.equal(requestedWorkspaceRole(u,'staff'),null);assert.equal(requestedWorkspaceRole(u,'teacher'),'teacher');assert.equal(hasSeniorWorkspaceAccess({role:'ADMIN',permissions:[]}),false)})

test('ordinary teachers, Media and revoked sessions have no ST capability',()=>{assert.equal(hasSeniorWorkspaceAccess({role:'TEACHER',permissions:[]}),false);assert.equal(hasSeniorWorkspaceAccess({permissions:[SENIOR_WORKSPACE_PERMISSION,'nexus:media-only']}),false);assert.equal(hasSeniorWorkspaceAccess(null),false)})

test('Orbit preserves local ST grants but cannot grant them',()=>{assert.deepEqual(mergeStaffWorkspacePermission([SENIOR_WORKSPACE_PERMISSION],['ecosystem:savanex']),['ecosystem:savanex',SENIOR_WORKSPACE_PERMISSION]);assert.deepEqual(mergeStaffWorkspacePermission([],[SENIOR_WORKSPACE_PERMISSION]),[])})

test('cohort is restricted to final year',()=>{for(const g of ['Grade 12','GRADE12','G12'])assert.ok(isFinalYear(g));for(const g of ['Grade 1','Grade 11','12','Grade 12A','Grade 120'])assert.equal(isFinalYear(g),false)})

test('readiness is checklist completion, not a fabricated grade',()=>{assert.equal(readiness({goals:'DONE'}),14);assert.equal(readiness({goals:'DONE',shortlist:'NOT_APPLICABLE'}),17);const all=Object.fromEntries(['goals','shortlist','requirements','documents','statement','references','funding'].map(k=>[k,'NOT_APPLICABLE']));assert.equal(readiness(all),null)})

test('duplicate active applications are blocked while archived ones are retained',()=>{const a={university:' Université A ',program:'Science',intake:'2027',archived:false},b={...a,university:'universite a'};assert.ok(duplicateApplication([a,b]));assert.equal(duplicateApplication([a,{...b,archived:true}]),false);assert.equal(duplicateApplication([a,{...b,intake:'2028'}]),false)})
