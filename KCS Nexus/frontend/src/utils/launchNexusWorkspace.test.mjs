import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('./launchNexusWorkspace.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {launchNexusWorkspace,workspaceUrl}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function setup(standalone=true){
 const calls=[],listeners=new Set(),child={opener:{},closed:false,close(){this.closed=true},postMessage(data,origin){calls.push({data,origin});if(data.type==='KCS_WORKSPACE_PING')queueMicrotask(()=>dispatch({type:'KCS_WORKSPACE_READY',requestId:data.requestId},origin));if(data.type==='KCS_WORKSPACE_COMMIT')queueMicrotask(()=>dispatch({type:'KCS_WORKSPACE_COMMITTED',requestId:data.requestId},origin))}};
 const dispatch=(data,origin,source=child)=>{for(const cb of listeners)cb({data,origin,source})};
 globalThis.window={location:{origin:'https://kinshasachristianschool.org',assign:value=>calls.push({assigned:value})},matchMedia:()=>({matches:standalone}),open:(...args)=>{calls.push({opened:args});return child},addEventListener:(_,cb)=>listeners.add(cb),removeEventListener:(_,cb)=>listeners.delete(cb)};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{standalone:false}});
 return {calls,child,listeners,dispatch};
}
const options={language:'fr',theme:'dark',isCurrent:()=>true};
test('a standalone launch opens synchronously, isolates opener, hands off to the exact origin and keeps Nexus in place',async()=>{
 const {calls,child,listeners}=setup();let requested=false;
 const pending=launchNexusWorkspace('academy',async()=>{requested=true;return 'https://academy.kinshasachristianschool.org/api/auth/callback?ticket=synthetic'},options);
 assert.equal(calls[0].opened[1],'_blank');assert.ok(calls[0].opened[0].includes('/nexus-launch.html#'));assert.equal(requested,false);assert.equal(child.opener,null);
 await pending;assert.equal(listeners.size,0);assert.equal(calls.some(c=>c.assigned),false);assert.equal(calls.filter(c=>c.data?.type==='KCS_WORKSPACE_COMMIT').length,1);
});
test('normal browser navigation remains in its original tab',async()=>{const {calls}=setup(false);await launchNexusWorkspace('academy',async()=>'https://academy.kinshasachristianschool.org/api/auth/callback?ticket=synthetic',options);assert.equal(calls.length,1);assert.ok(calls[0].assigned.includes('/api/auth/callback'))});
test('blocked popups never create an unusable handoff ticket',async()=>{setup();window.open=()=>null;let requested=false;await assert.rejects(launchNexusWorkspace('academy',async()=>{requested=true;return ''},options),/POPUP_BLOCKED/);assert.equal(requested,false)});
test('wrong origins and callback paths cannot receive a handoff',async()=>{setup();for(const url of ['https://outside.invalid/admin/sso/','https://kcsparentelection.kinshasachristianschool.org/','javascript:alert(1)'])assert.throws(()=>workspaceUrl('elections',url),/INVALID_DESTINATION/);assert.throws(()=>workspaceUrl('academy','https://academy.kinshasachristianschool.org/untrusted'),/INVALID_DESTINATION/)});
test('a changed account closes the reserved window and discards its ticket',async()=>{const {child}=setup();let current=true;await assert.rejects(launchNexusWorkspace('academy',async()=>{current=false;return 'https://academy.kinshasachristianschool.org/api/auth/callback?ticket=synthetic'},{...options,isCurrent:()=>current}),/ACCOUNT_CHANGED/);assert.equal(child.closed,true)});
test('a failed launch closes its reserved window and removes listeners',async()=>{const {child,listeners}=setup();await assert.rejects(launchNexusWorkspace('academy',async()=>{throw Error('network')},options),/network/);assert.equal(child.closed,true);assert.equal(listeners.size,0)});

// Capturing into an installed PWA requires a non-auxiliary (noopener) context.
test('electoral links request an openerless native app navigation without replacing Nexus',async()=>{
 const{calls}=setup();await launchNexusWorkspace('elections',async()=>'https://kcsparentelection.kinshasachristianschool.org/admin/sso/#launch=synthetic',options);
 const opened=calls.find(c=>c.opened)?.opened;assert.equal(opened[1],'_blank');assert.equal(opened[2],'noopener,noreferrer');assert.ok(opened[0].includes('/admin/sso/'));assert.equal(calls.some(c=>c.assigned),false);
});
test('slow electoral handoff offers a real next-click link instead of relying on expired activation',async()=>{
 const{calls}=setup();navigator.userActivation={isActive:false};const result=await launchNexusWorkspace('elections',async()=>'https://kcsparentelection.kinshasachristianschool.org/admin/sso/#launch=synthetic',options);
 assert.ok(result.manualUrl.includes('/admin/sso/'));assert.equal(calls.length,0);
});
test('changed electoral account or wrong destination cannot open any app or return a ticket link',async()=>{
 const{calls}=setup();let current=true;await assert.rejects(launchNexusWorkspace('elections',async()=>{current=false;return 'https://kcsparentelection.kinshasachristianschool.org/admin/sso/#launch=synthetic'},{...options,isCurrent:()=>current}),/ACCOUNT_CHANGED/);assert.equal(calls.length,0);
 await assert.rejects(launchNexusWorkspace('elections',async()=>'https://untrusted.invalid/admin/sso/',options),/INVALID_DESTINATION/);assert.equal(calls.length,0);
});
