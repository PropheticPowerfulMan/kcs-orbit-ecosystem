
const {chromium}=require('/runtime/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({args:['--unsafely-treat-insecure-origin-as-secure=http://election-scope-qa','--ignore-certificate-errors']});
 const results=[];
 for(const path of ['/login/','/student-government/login/','/admin/login/']){
  for(const theme of ['light','dark'])for(const lang of ['fr','en']){
   const c=await browser.newContext({viewport:{width:390,height:844}});
   await c.addInitScript(({theme,lang})=>{localStorage.setItem('kcs-theme',theme);sessionStorage.setItem('kcs-lang-session',lang)}, {theme,lang});
   const p=await c.newPage();console.log('CASE',path,theme,lang);p.on('pageerror',e=>console.log('PAGEERROR',e.message));await p.goto('http://election-scope-qa'+path);await p.locator('.ev-install-panel').waitFor();
   const panel=p.locator('.ev-install-panel');
   assert.equal(await panel.count(),1);assert.equal(await p.locator('.install-app-button').count(),0);
   const text=await panel.innerText();assert.match(text,lang==='fr'?/Installer l’application/:/Install app/);
   const manifest=await p.locator('link[rel=manifest]').last().getAttribute('href');
   assert.equal(manifest,path.startsWith('/student-government')?'/student-government/manifest.webmanifest':'/manifest.webmanifest');
   await panel.locator('button.ev-button').click();await p.locator('dialog[open]').waitFor();
   assert.match(await p.locator('dialog').innerText(),lang==='fr'?/Déjà installée/:/Already installed/);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.keyboard.press('Escape');await p.locator('dialog').waitFor({state:'detached'});
   if(theme==='light'&&lang==='en'&&path==='/login/')await p.screenshot({path:'/evidence/parent-mobile.png',fullPage:true});
   results.push({path,theme,lang,inlineInstall:true,dialog:true,noOverflow:true});await c.close();
  }
 }
 // Foreign standalone context must not remove the explicit install action.
 const c=await browser.newContext();
 await c.addInitScript(()=>{
  const original=window.matchMedia.bind(window);
  window.matchMedia=q=>q==='(display-mode: standalone)'?{...original(q),matches:true,addEventListener(){},removeEventListener(){}}:original(q);
  Object.defineProperty(navigator,'getInstalledRelatedApps',{value:async()=>[{platform:'webapp',id:'https://kinshasachristianschool.org/'}]});
 });
 const p=await c.newPage();await p.goto('http://election-scope-qa/login/');
 await p.locator('.ev-install-panel button.ev-button').waitFor();
 assert.match(await p.locator('.ev-install-panel').innerText(),/Installer|Install/);
 // One shared native prompt, no form submission, dismissal and a fresh retry.
 for(const outcome of ['dismissed','accepted']){
  await p.evaluate(outcome=>{
   window.nativeCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});
   event.prompt=async()=>{window.nativeCalls++};event.userChoice=Promise.resolve({outcome});dispatchEvent(event);
  },outcome);
  await p.locator('.ev-install-panel button.ev-button').click();
  await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>window.nativeCalls),1);
  assert.equal(await p.locator('dialog').count(),0);
 }
 await p.evaluate(()=>dispatchEvent(new Event('appinstalled')));
 await p.waitForTimeout(100);assert.match(await p.locator('.ev-install-panel').innerText(),/installée|installed/);
 await c.close();results.push({nativePromptConsumedOnce:true,retryAfterDismissal:true,foreignStandaloneInstallVisible:true});
 // Genuine links from all three leadership workspaces, no tokens and no async popup.
 const actors=JSON.parse(fs.readFileSync('/fixtures/browser-fixtures.private.json'));
 const actor=actors.find(a=>a.id==='jury-qa-teacher');
 for(const path of ['/portal/teacher','/admin','/portal/senior']){
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  const me=await ctx.request.get('https://role-qa/api/auth/me',{headers:{authorization:'Bearer '+actor.token}});
  assert.equal(me.status(),200);
  await ctx.addInitScript(actor=>{
   sessionStorage.setItem('kcs-auth',JSON.stringify({state:{user:actor.user,token:actor.token,refreshToken:'qa'},version:0}));
   localStorage.setItem('kcs-ui',JSON.stringify({state:{theme:'dark',language:'en',sidebarCollapsed:false},version:0}));
  },{...actor,user:(await me.json()).data});
  await ctx.route('https://kcsparentelection.kinshasachristianschool.org/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>QA target</title>'}));
  const page=await ctx.newPage();await page.goto('https://role-qa'+path);const link=page.locator('a[data-election-launch]').first();await link.waitFor();
  assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);
  const href=new URL(await link.getAttribute('href'));assert.equal(href.pathname,'/admin/login/');assert.equal(href.searchParams.get('nexusReturn'),path);assert.ok(!/token|ticket|password/i.test(href.search));
  const promised=ctx.waitForEvent('page');await link.click();const popup=await promised;await popup.waitForLoadState();assert.equal(new URL(popup.url()).pathname,'/admin/login/');
  results.push({nexus:path,realAnchor:true,loginFirst:true,noCredentialsInUrl:true});await ctx.close();
 }
 fs.writeFileSync('/evidence/browser-results.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,checks:results.length,results}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
