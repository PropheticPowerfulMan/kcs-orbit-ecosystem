
const {chromium}=require('/runtime/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const context=await chromium.launchPersistentContext('/tmp/election-pwa-profile',{headless:false,args:['--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=9222'],viewport:{width:1280,height:900}});
 const browser=context.browser(),cdp=await browser.newBrowserCDPSession();
 const checks=[];
 const origin='https://kcsparentelection.kinshasachristianschool.org';
 console.log('VERSION',browser.version());const proto=await(await fetch('http://127.0.0.1:9222/json/protocol')).json();console.log('INSTALL_SCHEMA',JSON.stringify(proto.domains.find(x=>x.domain==='PWA').commands.find(x=>x.name==='install')));
 for(const [id,path] of [['/kcs-parent-election','/login/'],['/student-government/','/student-government/login/']]){
  const manifestId=origin+id;
  try{
   await cdp.send('PWA.install',{manifestId,installUrlOrBundleUrl:origin+path,installUrl:origin+path});
   console.log('INSTALLED',id,await cdp.send('PWA.getOsAppState',{manifestId}));await cdp.send('PWA.changeAppUserSettings',{manifestId,displayMode:'standalone',linkCapturing:true});
   const result=await cdp.send('PWA.launch',{manifestId,url:origin+path});
   await new Promise(r=>setTimeout(r,2000));
   console.log('LAUNCHED',id,result);
   for(const p of context.pages())if(p.url().startsWith(origin+path))console.log('WINDOW',id,p.url(),await p.evaluate(()=>({standalone:matchMedia('(display-mode: standalone)').matches,overlay:matchMedia('(display-mode: window-controls-overlay)').matches})));
   const launched=context.pages().filter(p=>new URL(p.url()).pathname===path);assert.ok(launched.length);assert.ok((await Promise.all(launched.map(p=>p.evaluate(()=>matchMedia('(display-mode: standalone)').matches)))).some(Boolean));checks.push({check:'installed-independent-app',id,passed:true});
  }catch(e){console.log('FAIL',id,e.message);throw e}
 }

 const source=await context.newPage();await source.goto('https://kinshasachristianschool.org/login');
 const manifestPath=await source.locator('link[rel=manifest]').first().getAttribute('href');
 const mf=await(await context.request.get(new URL(manifestPath,source.url()).href)).json();
 const sourceId=new URL(mf.id||mf.start_url,new URL(manifestPath,source.url()).origin).href;
 await cdp.send('PWA.install',{manifestId:sourceId,installUrlOrBundleUrl:source.url()});
 await cdp.send('PWA.changeAppUserSettings',{manifestId:sourceId,displayMode:'standalone'});
 await cdp.send('PWA.launch',{manifestId:sourceId,url:source.url()});await new Promise(r=>setTimeout(r,1200));
 const sourceApp=context.pages().filter(p=>p.url().includes('kinshasachristianschool.org/login')&&!p.url().includes('kcsparentelection')).at(-1);
 for(const path of ['/login/','/student-government/login/']){
  await sourceApp.evaluate(url=>{const a=document.createElement('a');a.id='qa-pwa-link';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='QA PWA link';a.style='position:fixed;top:0;left:0;z-index:2147483647;padding:20px;background:white;color:black';document.body.append(a)},origin+path+'?source=qa-handoff');
  await sourceApp.locator('#qa-pwa-link').click();await new Promise(r=>setTimeout(r,1500));
  const targets=context.pages().filter(p=>p.url().includes(path+'?source=qa-handoff'));
  console.log('CAPTURE',path,await Promise.all(targets.map(async p=>({url:p.url(),standalone:await p.evaluate(()=>matchMedia('(display-mode: standalone)').matches)}))));
  assert.equal(targets.length,1);assert.ok(await targets[0].evaluate(()=>matchMedia('(display-mode: standalone)').matches));checks.push({check:'captured-from-installed-nexus',path,passed:true});
  await sourceApp.locator('#qa-pwa-link').evaluate(el=>el.remove());
 }
 fs.writeFileSync('/evidence/native-results.json',JSON.stringify({passed:true,browser:browser.version(),linkCapturingExplicitlyEnabled:true,checks},null,2));await context.close();

})().catch(e=>{console.error(e);process.exit(1)});
