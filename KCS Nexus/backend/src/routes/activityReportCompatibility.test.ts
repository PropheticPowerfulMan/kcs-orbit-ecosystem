import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {prisma} from '../config/prisma.js'
import {teachersRouter} from './teachers.routes.js'
const model=prisma.teacherActivityReport as any,original=model.findMany
after(()=>{model.findMany=original})
test('older activity reports with no kind remain visible; conferences stay in their own workspace',async()=>{
 model.findMany=async(query:any)=>{assert.deepEqual(query.where,{teacher:{userId:'own-teacher'}});return[{id:'legacy',evidence:{courses:2}},{id:'conference',evidence:{kind:'PARENT_PERIOD_MEETING'}},{id:'old-empty',evidence:null}]}
 const layer:any=teachersRouter.stack.find((entry:any)=>entry.route?.path==='/me/activity-reports'&&entry.route.methods.get);assert.ok(layer)
 const data:any=await new Promise((resolve,reject)=>layer.route.stack.at(-1).handle({user:{sub:'own-teacher',role:'teacher'}},{status(){return this},json(value:any){resolve(value.data);return this}},reject))
 assert.deepEqual(data.map((row:any)=>row.id),['legacy','old-empty'])
})
