import test from 'node:test';import assert from 'node:assert/strict';import{academicWorkspaceFor,academyRoleFor,academicNexusHome}from'./academicApplicationAccess.js';
const account=(role:string,permissions:string[]=[])=>({role,permissions});
for(const [name,user,root,workspace,role,home]of[
 ['SuperAdmin',account('ADMIN'),true,'superadmin','SUPER_ADMIN','/admin'],
 ['Principal',account('TEACHER',['nexus:principal-workspace']),false,'principal','ADMIN','/admin'],
 ['Senior Teacher',account('TEACHER',['nexus:senior-teacher-workspace']),false,'senior','ADMIN','/portal/senior'],
 ['Native administrator',account('ADMIN'),false,'principal','ADMIN','/admin'],
 ['Teacher',account('TEACHER'),false,'teacher','TEACHER','/portal/teacher'],
 ['Student',account('STUDENT'),false,'student','STUDENT','/portal/student'],
 ['Principal who also has ST access',account('TEACHER',['nexus:principal-workspace','nexus:senior-teacher-workspace']),false,'principal','ADMIN','/admin'],
]as const)test(name+' receives only its scoped app role and native Nexus return',()=>{const before=JSON.stringify(user),actual=academicWorkspaceFor(user,root);assert.equal(actual,workspace);assert.equal(academyRoleFor(actual!),role);assert.equal(academicNexusHome(actual!),home);assert.equal(JSON.stringify(user),before)});
test('Media, parents and unassigned staff do not become academic administrators',()=>{for(const u of[account('PARENT',['nexus:principal-workspace']),account('STAFF'),account('ADMIN',['nexus:media-only'])])assert.equal(academicWorkspaceFor(u),null);assert.equal(academicWorkspaceFor(null),null)});
test('revoking a local leadership grant removes administration without changing teaching identity',()=>{const u=account('TEACHER',['nexus:senior-teacher-workspace']);assert.equal(academicWorkspaceFor(u),'senior');u.permissions=[];assert.equal(academicWorkspaceFor(u),'teacher');assert.equal(u.role,'TEACHER')});
