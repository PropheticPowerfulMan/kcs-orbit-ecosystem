const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const compile=file=>{const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};new Function('exports','module',output)(m.exports,m);return m.exports}
const utils=path.resolve(__dirname,'../src/utils'),policy=compile(path.join(utils,'networkPolicy.ts')),mobile=compile(path.join(utils,'mobileWorkspace.ts'))
test('network policy bounds read retries, honors Retry-After and excludes every mutation',()=>{
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(policy.readRetryDelay({method,attempt:0,elapsed:0}),null)
 assert.equal(policy.readRetryDelay({method:'GET',attempt:2,elapsed:0}),null)
 assert.equal(policy.readRetryDelay({method:'GET',attempt:0,elapsed:0,status:401}),null)
 assert.equal(policy.readRetryDelay({method:'GET',attempt:0,elapsed:0,status:500}),null)
 assert.equal(policy.readRetryDelay({method:'GET',attempt:0,elapsed:0,code:'ERR_CANCELED'}),null)
 assert.equal(policy.readRetryDelay({method:'GET',attempt:0,elapsed:64000}),null)
 assert.equal(policy.readRetryDelay({method:'GET',attempt:0,elapsed:0,status:429,retryAfter:'10'}),10000)
 assert.equal(policy.readRetryDelay({method:'GET',attempt:0,elapsed:0,status:503,retryAfter:'120'}),null)
 assert.equal(policy.readRetryDelay({attempt:0,elapsed:0}),650)
})
test('only an explicit identity rejection can invalidate the session',()=>{
 for(const status of [401,403,410])assert.equal(policy.isSessionRejection({response:{status}}),true)
 for(const error of [{code:'ERR_NETWORK'},{code:'ECONNABORTED'},{response:{status:503}},{response:{status:429}}])assert.equal(policy.isSessionRejection(error),false)
})
test('mobile gradebook panels start closed without replacing desktop preferences',()=>{
 assert.equal(mobile.initialGradebookPanel('task-panel',true,()=>null),false)
 assert.equal(mobile.initialGradebookPanel('task-panel',false,()=>null),true)
 const keys=[];assert.equal(mobile.initialGradebookPanel('task-panel',true,key=>(keys.push(key),'open')),true)
 assert.deepEqual(keys,['kcs:nexus:gradebook:mobile:task-panel'])
 assert.equal(mobile.initialGradebookPanel('task-panel',true,()=>{throw Error('Storage denied')}),false)
})
const root=path.resolve(__dirname,'../../..')
for(const app of ['KCSKITCHEN/frontend','KCS Sentinel/apps/web']){
 const {resilientFetch}=compile(path.join(root,app,'src/resilientFetch.ts')),timing={timeoutMs:100,budgetMs:400,baseDelayMs:1}
 const fake=async(fetcher,fn)=>{const original=global.fetch;global.fetch=fetcher;try{await fn()}finally{global.fetch=original}}
 test(app+': transient reads recover, while rejected access is not retried',async()=>{
  let calls=0;await fake(async()=>{calls++;if(calls<3)throw new TypeError('offline');return new Response('ok')},async()=>assert.equal(await(await resilientFetch('/read',{},undefined,timing)).text(),'ok'));assert.equal(calls,3)
  calls=0;await fake(async()=>{calls++;return new Response('denied',{status:401})},async()=>assert.equal((await resilientFetch('/read',{},undefined,timing)).status,401));assert.equal(calls,1)
 })
 test(app+': payments and attendance writes are never replayed, including a Request object',async()=>{
  for(const method of ['POST','PUT','PATCH','DELETE']){
   let calls=0;await fake(async()=>{calls++;throw new TypeError('Lost response')},async()=>assert.rejects(resilientFetch('/write',{method},undefined,timing)));assert.equal(calls,1)
  }
  let calls=0;await fake(async()=>{calls++;throw new TypeError('Lost response')},async()=>assert.rejects(resilientFetch(new Request('https://kcs.example/write',{method:'POST'}),{},undefined,timing)));assert.equal(calls,1)
 })
 test(app+': explicit cancellation and deadlines abort the actual request',async()=>{
  let calls=0;const controller=new AbortController()
  await fake((_input,options)=>{calls++;return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))))},async()=>{
   const pending=resilientFetch('/read',{signal:controller.signal},undefined,timing);setTimeout(()=>controller.abort(),5);await assert.rejects(pending,{name:'AbortError'})
  });assert.equal(calls,1)
  calls=0;await fake((_input,options)=>{calls++;return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))))},async()=>assert.rejects(resilientFetch('/write',{method:'POST'},undefined,{timeoutMs:5,budgetMs:40,baseDelayMs:1})));assert.equal(calls,1)
 })
 test(app+': retry-after outside the budget and invalid input do not cause repeated requests',async()=>{
  let calls=0;await fake(async()=>{calls++;return new Response('busy',{status:503,headers:{'Retry-After':'1000'}})},async()=>assert.equal((await resilientFetch('/read',{},undefined,timing)).status,503));assert.equal(calls,1)
  calls=0;await fake(async()=>{calls++;throw new Error('programming error')},async()=>assert.rejects(resilientFetch('/read',{},undefined,timing)));assert.equal(calls,1)
 })
}
