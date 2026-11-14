import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {authRouter} from './auth.routes.js'
import {prisma} from '../config/prisma.js'
import {officialStudentPortrait} from '../services/officialPortrait.service.js'

const users=prisma.user as any
const original={findUnique:users.findUnique,update:users.update}
after(()=>{Object.assign(users,original)})
const layer=authRouter.stack.find((layer:any)=>layer.route?.path==='/profile'&&layer.route.methods.put) as any
assert.ok(layer)
const handler=layer.route.stack.at(-1).handle
const photo='data:image/png;base64,aGVsbG8='
const invoke=(id:string,role:string,body:any)=>new Promise<any>((resolve,reject)=>handler({user:{sub:id,role},body},{status(){return this},json(value:any){resolve(value);return this}},reject))
test('personal photos are saved on the signed-in Nexus account only for every role',async()=>{
 for(const role of ['student','parent','teacher','staff','admin']){
  const id='own-'+role,writes:any[]=[]
  users.findUnique=async(args:any)=>args.select?{teacherProfile:null,staffProfile:null}:{id,email:role+'@example.invalid',firstName:'QA',lastName:'Member',role:role.toUpperCase(),avatar:'previous-personal',permissions:[]}
  users.update=async(args:any)=>{writes.push(args);return{id,email:role+'@example.invalid',firstName:'QA',lastName:'Member',role:role.toUpperCase(),permissions:[],...args.data}}
  const response=await invoke(id,role,{avatar:photo})
  assert.equal(response.data.avatar,photo)
  assert.deepEqual(writes,[{where:{id},data:{avatar:photo}}])
  writes.length=0
  await assert.rejects(invoke(id,role,{avatar:photo,photoData:'official-overwrite'}),(error:any)=>error.name==='ZodError')
  await assert.rejects(invoke(id,role,{avatar:photo,officialAvatar:'official-overwrite'}),(error:any)=>error.name==='ZodError')
  assert.equal(writes.length,0,'Official portrait fields must not reach the write path')
 }
})
test('the configured SuperAdmin receives its local avatar immediately without modifying a different account',async()=>{
 const account={id:'actual-admin',email:'qa-admin@example.invalid',role:'ADMIN',firstName:'QA',lastName:'Admin',permissions:[],avatar:null}
 const writes:any[]=[]
 users.findUnique=async()=>account
 users.update=async(args:any)=>{writes.push(args);return{...account,...args.data}}
 const response=await invoke('configured-superadmin','admin',{avatar:photo})
 assert.equal(response.data.avatar,photo)
 assert.deepEqual(writes,[{where:{id:'actual-admin'},data:{avatar:photo}}])
})
test('an official learner portrait never falls back to the personal dashboard photo',async()=>{
 const user={orbitUserId:null,avatar:photo}
 assert.equal(await officialStudentPortrait({studentNumber:'QA',officialAvatar:'official-portrait',user}), 'official-portrait')
 assert.equal(await officialStudentPortrait({studentNumber:'QA',officialAvatar:null,user}),null)
})
