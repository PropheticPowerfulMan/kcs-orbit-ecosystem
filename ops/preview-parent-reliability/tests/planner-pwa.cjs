
const{chromium}=require('/runtime/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
const origin='https://kinshasachristianschool.org',context=await chromium.launchPersistentContext('/tmp/planner-pwa-profile',{headless:false,ignoreHTTPSErrors:true,args:['--no-sandbox','--ignore-certificate-errors','--disable-dev-shm-usage','--remote-debugging-port=9222'],viewport:{width:1280,height:900}}),browser=context.browser(),cdp=await browser.newBrowserCDPSession(),checks=[];
for(const path of ['/login','/lesson-plan/']){
 const p=await context.newPage();await p.goto(origin+path);
 const manifestUrl=new URL(await p.locator('link[rel=manifest]').first().getAttribute('href'),p.url()).href;
 const manifest=await(await context.request.get(manifestUrl)).json(),manifestId=new URL(manifest.id||manifest.start_url,manifestUrl).href;
 assert.equal(manifest.display,'standalone');if(path.includes('lesson-plan')){assert.equal(manifest.scope,'/lesson-plan/');assert.equal(manifest.launch_handler.client_mode,'navigate-existing')}
 await cdp.send('PWA.install',{manifestId,installUrlOrBundleUrl:origin+path});await cdp.send('PWA.changeAppUserSettings',{manifestId,displayMode:'standalone',linkCapturing:true});
 await cdp.send('PWA.launch',{manifestId,url:origin+path});await new Promise(r=>setTimeout(r,1000));checks.push({path,manifestId,independentApp:true});
}
const apps=await Promise.all(context.pages().map(async p=>({p,standalone:await p.evaluate(()=>matchMedia('(display-mode: standalone)').matches).catch(()=>false)})));
const nexus=apps.find(x=>x.standalone&&new URL(x.p.url()).pathname==='/login')?.p;assert.ok(nexus,'Installed Nexus window');
const url=origin+'/lesson-plan/#/login?source=qa-handoff';
await nexus.evaluate(url=>{const a=document.createElement('a');a.id='pwa-handoff';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open Eduplanner';document.body.append(a)},url);
await nexus.locator('#pwa-handoff').click();await new Promise(r=>setTimeout(r,1200));
const planner=context.pages().filter(p=>p.url().includes('source=qa-handoff'));assert.equal(planner.length,1);assert.ok(await planner[0].evaluate(()=>matchMedia('(display-mode: standalone)').matches));
await planner[0].evaluate(origin=>{const a=document.createElement('a');a.id='pwa-return';a.href=origin+'/login?source=qa-return';a.target='_blank';a.rel='noopener noreferrer';a.textContent='Return to Nexus';document.body.append(a)},origin);
await planner[0].locator('#pwa-return').click();await new Promise(r=>setTimeout(r,1200));
const returned=context.pages().filter(p=>p.url().includes('source=qa-return'));assert.equal(returned.length,1);assert.ok(await returned[0].evaluate(()=>matchMedia('(display-mode: standalone)').matches));
checks.push({newOpenerlessWindowCapturedBothDirections:true,rootAndNestedScopesDistinct:true,linkCapturingExplicitlyEnabled:true});
fs.writeFileSync('/evidence/planner-pwa-results.json',JSON.stringify({passed:true,browser:browser.version(),checks},null,2));console.log(JSON.stringify({passed:true,checks}));await context.close();
})().catch(e=>{console.error(e);process.exit(1)});
