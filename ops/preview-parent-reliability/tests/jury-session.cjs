
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('/source/KCS Nexus Jury/frontend/node_modules/typescript');
async function load(routes,hash='#/sso?ticket=synthetic-ticket'){
 const context=vm.createContext({URLSearchParams,location:{hash,pathname:'/jury/',search:''},history:{replaceState(_s,_t,url){context.location.hash=url.slice(url.indexOf('#'))}},crypto:crypto.webcrypto,console});
 const mocked=new vm.SyntheticModule(['api','send','ApiError'],function(){class ApiError extends Error{constructor(status,code){super(code);this.status=status;this.code=code}}this.setExport('ApiError',ApiError);this.setExport('api',async p=>routes.api(p,ApiError));this.setExport('send',(p,b)=>routes.send(p,b,ApiError))},{context});
 const source=ts.transpileModule(fs.readFileSync('/source/KCS Nexus Jury/frontend/src/launchSession.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(source,{context});await mod.link(()=>mocked);await mod.evaluate();return{mod:mod.namespace,context};
}
(async()=>{let preview=0,exchange=0,confirm=0;
let x=await load({api:()=>({reference:'other'}),send:async(p,b)=>{if(p.endsWith('preview')){preview++;return{reference:'own',name:'Teacher'}}exchange++;assert.equal(b.confirmedReference,'own');return{reference:'own'}}});
const one=x.mod.initialSession(async()=>{confirm++;return true}),two=x.mod.initialSession(()=>{throw Error('duplicate confirm')});assert.equal(one,two);assert.equal((await one).reference,'own');assert.equal(preview,1);assert.equal(exchange,1);assert.equal(confirm,1);assert.equal(x.context.location.hash,'#/');
let fail=true; x=await load({api:()=>({reference:'unrelated'}),send:async(p,b,Err)=>{if(p.endsWith('preview')){if(fail){fail=false;throw new Err(0,'NETWORK_UNAVAILABLE')}return{reference:'own'}}return{reference:'own'}}});
await assert.rejects(x.mod.initialSession(async()=>true));assert.equal((await x.mod.initialSession(async()=>true)).reference,'own');
x=await load({api:()=>({reference:'own'}),send:async(p,b,Err)=>{if(p.endsWith('preview'))return{reference:'own'};throw new Err(0,'NETWORK_UNAVAILABLE')}});
assert.equal((await x.mod.initialSession(async()=>true)).reference,'own');
x=await load({api:()=>({reference:'another-account'}),send:async(p,b,Err)=>{if(p.endsWith('preview'))return{reference:'own'};throw new Err(0,'NETWORK_UNAVAILABLE')}});
await assert.rejects(x.mod.initialSession(async()=>true));
const idSource=ts.transpileModule(fs.readFileSync('/source/KCS Nexus Jury/frontend/src/secureId.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const ctx=vm.createContext({crypto:{getRandomValues:v=>crypto.webcrypto.getRandomValues(v)}}),idMod=new vm.SourceTextModule(idSource,{context:ctx});await idMod.link(()=>{});await idMod.evaluate();const ids=new Set();for(let n=0;n<100;n++){const id=idMod.namespace.secureId();assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);ids.add(id)}assert.equal(ids.size,100);
console.log(JSON.stringify({passed:true,coalescedSingleUseExchange:true,previewRetryKeepsTokenInMemory:true,lostResponseRecoversSameIdentity:true,otherIdentityNeverAccepted:true,secureUuidFallback:true}));
})().catch(e=>{console.error(e);process.exit(1)});
