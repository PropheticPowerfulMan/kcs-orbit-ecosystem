import test from 'node:test'
import assert from 'node:assert/strict'
import {closedVisibilityPolicy,canViewAcademic,type VisibilityPolicy,type VisibilityRule} from './academicVisibilityPolicy.js'
const ctx={audience:'student' as const,studentNumber:'KCS-STU-1',grade:'Grade 9',section:'B',academicYear:'2026-2027',term:'Semester 1 · Quarter 2',courseId:'math'}
const rule:VisibilityRule={id:'a',audience:'both',effect:'ALLOW',grade:'Grade 9',section:'B',permissions:{grades:true,reportCards:false,transcripts:false}}
test('every academic feature is closed by default for students and parents',()=>{
 const p=closedVisibilityPolicy();for(const audience of ['student','parent']as const)for(const f of ['grades','reportCards','transcripts']as const)assert.equal(canViewAcademic(p,f,{...ctx,audience}),false)
 p.defaults.student.grades=true;p.rules=[rule];assert.equal(canViewAcademic(p,'grades',ctx),false)
})
test('targeted release respects sections, learners, parents, academic years and courses',()=>{
 const p:VisibilityPolicy={...closedVisibilityPolicy(),enabled:true,rules:[{...rule,studentNumbers:['KCS-STU-1'],academicYear:'2026-2027',term:ctx.term,courseIds:['math']}]}
 assert.equal(canViewAcademic(p,'grades',ctx),true)
 for(const change of [{section:'A'},{studentNumber:'KCS-STU-2'},{academicYear:'2025-2026'},{term:'Semester 1 · Quarter 1'},{courseId:'science'}])assert.equal(canViewAcademic(p,'grades',{...ctx,...change}),false)
 assert.equal(canViewAcademic(p,'reportCards',ctx),false)
 p.rules=[{...rule,audience:'parent',parentIds:['parent-1']}]
 assert.equal(canViewAcademic(p,'grades',{...ctx,audience:'parent',parentIds:['parent-1']}),true)
 assert.equal(canViewAcademic(p,'grades',{...ctx,audience:'parent',parentIds:['parent-2']}),false)
 assert.equal(canViewAcademic(p,'grades',ctx),false)
})
test('targeted restrictions override general grants and hide aggregates of a restricted course',()=>{
 const p={...closedVisibilityPolicy(),enabled:true};p.defaults.student.grades=true;p.rules=[{...rule,effect:'DENY',courseIds:['math']}]
 assert.equal(canViewAcademic(p,'grades',ctx),false)
 assert.equal(canViewAcademic(p,'grades',{...ctx,courseId:'science'}),true)
 assert.equal(canViewAcademic(p,'grades',{...ctx,courseId:undefined}),false)
})
test('document and grade release remain independent',()=>{
 const p={...closedVisibilityPolicy(),enabled:true};p.defaults.parent.reportCards=true
 assert.equal(canViewAcademic(p,'reportCards',{...ctx,audience:'parent'}),true)
 assert.equal(canViewAcademic(p,'grades',{...ctx,audience:'parent'}),false)
 assert.equal(canViewAcademic(p,'transcripts',{...ctx,audience:'parent'}),false)
})


test('removing a targeted grant denies subsequent requests using the same student or parent session',()=>{
 const p:VisibilityPolicy={...closedVisibilityPolicy(),enabled:true,rules:[{...rule,permissions:{grades:true,reportCards:true,transcripts:true}}]}
 const contexts=[ctx,{...ctx,audience:'parent' as const,parentIds:['family']}]
 for(const context of contexts)for(const feature of ['grades','reportCards','transcripts'] as const)assert.equal(canViewAcademic(p,feature,context),true)
 const saved={...p,revision:p.revision+1,rules:p.rules.filter(r=>r.id!==rule.id)}
 for(const context of contexts)for(const feature of ['grades','reportCards','transcripts'] as const)assert.equal(canViewAcademic(saved,feature,context),false)
 // Deletion removes only its own permission; independent deliberate grants survive.
 saved.defaults.parent.grades=true
 assert.equal(canViewAcademic(saved,'grades',contexts[1]),true)
 assert.equal(canViewAcademic(saved,'reportCards',contexts[1]),false)
})
