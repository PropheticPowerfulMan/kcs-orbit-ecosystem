import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {lessonPlanRouter} from './lesson-plan.routes.js'
import {prisma} from '../config/prisma.js'
const users=prisma.user as any,find=users.findUnique,network=globalThis.fetch
const layer=(lessonPlanRouter as any).stack.find((x:any)=>x.route?.path==='/dashboard-avatar'&&x.route.methods.get)
const handler=layer.route.stack.at(-1).handle
const bearer='Bearer '+'a'.repeat(40),avatar='data:image/png;base64,aGVsbG8='
after(()=>{users.findUnique=find;globalThis.fetch=network})
const invoke=()=>new Promise<any>((resolve,reject)=>handler({header:(key:string)=>key==='authorization'?bearer:undefined,query:{id:'victim'},body:{userId:'victim'}},{set(){return this},vary(){return this},status(){return this},json(value:any){resolve(value)}},reject))
test('the actual route ignores requested identities and reads the linked personal field only',async()=>{const reads:any[]=[];globalThis.fetch=async(url:any,options:any)=>{assert.equal(new URL(url).pathname,'/api/ecosystem/session-check');assert.equal(options.headers.authorization,bearer);return new Response(JSON.stringify({allowed:true,nexusUserId:'verified-teacher'}),{status:200})};users.findUnique=async(args:any)=>{reads.push(args);return args.select?.avatar?{avatar}:{id:'verified-teacher',role:'TEACHER',permissions:[],accountBlockedAt:null}};const result=await invoke();assert.equal(result.data.avatar,avatar);assert.ok(reads.every(x=>x.where.id==='verified-teacher'));assert.deepEqual(reads.at(-1).select,{avatar:true})})
test('rejected verification does not query any Nexus account',async()=>{let reads=0;users.findUnique=async()=>{reads++;throw Error('must not query')};globalThis.fetch=async()=>new Response('{}',{status:401});await assert.rejects(invoke(),(e:any)=>e.statusCode===401||e.status===401);assert.equal(reads,0)})
