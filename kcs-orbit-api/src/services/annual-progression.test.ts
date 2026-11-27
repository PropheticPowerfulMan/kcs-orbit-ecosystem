import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {prisma} from '../db'
import {previewAcademicYearRollover,executeAcademicYearRollover} from './academic-year-progression.service'
const db=prisma as any,secret='synthetic-annual-progress-test-key'
const classes=[{id:'g9',name:'Grade 9 A',gradeLevel:'Grade 9',suffix:'A'},{id:'g10',name:'Grade 10 A',gradeLevel:'Grade 10',suffix:'A'},{id:'g12',name:'Grade 12 A',gradeLevel:'Grade 12',suffix:'A'},{id:'k3',name:'K3 A',gradeLevel:'K3',suffix:'A'},{id:'k4',name:'K4 A',gradeLevel:'K4',suffix:'A'}]
const catalog=()=>[{id:'passing',firstName:'Synthetic',lastName:'Passing',classId:'g9',className:'Grade 9 A',status:'ACTIVE',grades:[{score:1,maxScore:100}]},{id:'final',firstName:'Synthetic',lastName:'Final',classId:'g12',className:'Grade 12 A',status:'ACTIVE',grades:[{score:100,maxScore:100}]},{id:'early',firstName:'Synthetic',lastName:'Early',classId:'k3',className:'K3 A',status:'ACTIVE',grades:[{score:100,maxScore:100}]}]
const proof=(decisions:any[]=[])=>{const payload=JSON.stringify({organizationId:'synthetic-school',academicYear:'2026-2027',closed:true,endDate:'2027-06-11',expiresAt:Date.now()+60000,students:[],annualResults:[{id:'passing',average:70,grade:'Grade 9'},{id:'final',average:69.99,grade:'Grade 12'}],earlyYearsDecisions:decisions});return{payload,signature:createHmac('sha256',secret).update(payload).digest('hex')}}
test('actual Orbit preview ignores all-time raw scores and uses signed annual grades; no evidence or Kindergarten decision means HOLD',async()=>{
 const old=process.env.KCS_NEXUS_INTEGRATION_KEY;process.env.KCS_NEXUS_INTEGRATION_KEY=secret
 const original={students:db.student.findMany,classes:db.class.findMany,audit:db.auditLog.findFirst}
 try{db.student.findMany=async()=>catalog();db.class.findMany=async()=>classes;db.auditLog.findFirst=async()=>null
 const plan=await previewAcademicYearRollover({organizationId:'synthetic-school',effectiveDate:new Date('2027-07-15'),graduationApproval:proof()});assert.equal(plan.academicYear,'2026-2027');assert.equal(plan.nextAcademicYear,'2027-2028');assert.equal(plan.items.find(s=>s.studentId==='passing')?.action,'PROMOTE');assert.equal(plan.items.find(s=>s.studentId==='final')?.action,'REPEAT');assert.equal(plan.items.find(s=>s.studentId==='early')?.action,'HOLD')
 const missing=await previewAcademicYearRollover({organizationId:'synthetic-school',effectiveDate:new Date('2027-07-15')});assert.ok(missing.items.every(s=>s.action==='HOLD'))
 }finally{db.student.findMany=original.students;db.class.findMany=original.classes;db.auditLog.findFirst=original.audit;process.env.KCS_NEXUS_INTEGRATION_KEY=old}
})
test('approved complete transition applies once, preserves yearly source and allows safe retry after the canonical classes changed',async()=>{
 const old=process.env.KCS_NEXUS_INTEGRATION_KEY;process.env.KCS_NEXUS_INTEGRATION_KEY=secret
 const original={students:db.student.findMany,classes:db.class.findMany,audit:db.auditLog.findFirst,transaction:db.$transaction};let rows=catalog(),done=false,writes=0
 try{db.student.findMany=async(args:any)=>args.where.id?[]:rows;db.class.findMany=async()=>classes;db.auditLog.findFirst=async()=>done?{id:'already-executed'}:null
 db.$transaction=async(fn:any)=>fn({$queryRaw:async()=>[{ok:1}],auditLog:{findFirst:async()=>done?{id:'already-executed'}:null,create:async()=>{done=true}},student:{update:async({where,data}:any)=>{writes++;const row=rows.find(s=>s.id===where.id)!;row.className=data.className;row.classId=data.class?.connect?.id||row.classId;return row}},syncEvent:{create:async()=>({id:'synthetic-event'})}})
 const decision={studentId:'early',decision:'PROMOTE' as const,reason:'  SuperAdmin readiness approval  '},input={organizationId:'synthetic-school',effectiveDate:new Date('2027-07-15'),graduationApproval:proof([decision]),overrides:[decision]}
 const first=await executeAcademicYearRollover(input);assert.equal(first.applied,3);assert.equal(writes,3);assert.equal(rows.find(s=>s.id==='passing')?.className,'Grade 10 A');assert.equal(rows.find(s=>s.id==='final')?.className,'Grade 12 A');assert.equal(rows.find(s=>s.id==='early')?.className,'K4 A')
 const retry=await executeAcademicYearRollover(input);assert.equal(retry.applied,0);assert.equal(writes,3)
 }finally{db.student.findMany=original.students;db.class.findMany=original.classes;db.auditLog.findFirst=original.audit;db.$transaction=original.transaction;process.env.KCS_NEXUS_INTEGRATION_KEY=old}
})
