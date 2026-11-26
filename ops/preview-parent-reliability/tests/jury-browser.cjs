
const{chromium}=require('/runtime/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict');
const base='https://staging.kinshasachristianschool.org',secrets=JSON.parse(fs.readFileSync('/qa/synthetic-secrets.json'));
async function launch(c,name,password){
 const r=await c.request.post(base+'/jury-nexus/api/auth/login',{data:{identifier:name+'@jury.staging.invalid',password},headers:{Origin:base}});assert.equal(r.status(),200);
 const v=(await r.json()).data,jwt=v.tokens?.accessToken||v.accessToken||v.token;
 const launch=await c.request.post(base+'/jury-nexus/api/jury/launch',{data:{},headers:{Origin:base,Authorization:'Bearer '+jwt}});assert.equal(launch.status(),200);
 return(await launch.json()).data.url;
}
(async()=>{const browser=await chromium.launch({args:['--ignore-certificate-errors']}),checks=[];
for(const width of [390,768,1024]){
 const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:800}});
 await c.addInitScript(()=>{Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true})});
 const url=await launch(c,'teacher',secrets.teacher);let draftRequests=0;
 await c.route('**/jury/api/session/draft-key',async route=>{draftRequests++;await new Promise(r=>setTimeout(r,2500));await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'TEST_DEVICE_STORAGE_UNAVAILABLE'})})});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/jury/'+new URL(url).hash);await p.getByRole('button',{name:'Continue as this account',exact:true}).click();
 await p.locator('.shell').waitFor();assert.equal(await p.getByRole('heading',{name:'Operation could not be completed',exact:true}).count(),0);
 await p.getByText('Online saving is available.',{exact:false}).waitFor();assert.equal(draftRequests,1);
 const position=await p.locator('.topbar').evaluate(e=>e.getBoundingClientRect().top);
 await p.evaluate(()=>window.scrollTo(0,1000));await p.waitForTimeout(100);const after=await p.locator('.topbar').evaluate(e=>e.getBoundingClientRect().top);
 assert.ok(Math.abs(after-position)<2,'Top menu must remain fixed while scrolling');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(await p.locator('.topbar button.mobile-only').isVisible()){await p.locator('.topbar button.mobile-only').click();await p.locator('.sidebar.open').waitFor();await p.locator('.sidebar-backdrop').click({position:{x:width-10,y:200}});}
 await p.screenshot({path:'/evidence/jury-topbar-'+width+'.png'});
 assert.deepEqual(errors,[]);checks.push({width,oldBrowserCompatibility:true,realTicketPreviewConfirmationExchange:true,optionalDraftFailureNonBlocking:true,stickyTopbar:true});await c.close();
}
const c=await browser.newContext({ignoreHTTPSErrors:true}),url=await launch(c,'student1',secrets.student);let previews=0,drafts=0;
await c.route('**/jury/api/session/preview',async route=>{previews++;if(previews===1){await route.abort('failed');return}await route.continue()});
await c.route('**/jury/api/session/draft-key',async route=>{drafts++;await route.continue()});
const p=await c.newPage();await p.goto(base+'/jury/'+new URL(url).hash);await p.getByRole('button',{name:'Retry connection',exact:true}).click();await p.getByRole('button',{name:'Continue as this account',exact:true}).click();await p.locator('[data-learner-home]').waitFor();
assert.equal(previews,2);assert.equal(drafts,0);assert.ok(!p.url().includes('ticket='));
checks.push({realStudentRetryWithoutReload:true,capabilityRemovedFromUrl:true,studentDoesNotUnlockJudgeDrafts:true});await c.close();await browser.close();
fs.writeFileSync('/evidence/jury-browser-results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
})().catch(e=>{console.error(e);process.exit(1)});
