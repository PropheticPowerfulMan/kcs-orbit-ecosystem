
const{chromium}=require('/runtime/node_modules/playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base='https://staging.kinshasachristianschool.org',secrets=JSON.parse(fs.readFileSync('/qa/synthetic-secrets.json'));
async function login(context,name,password){
 const r=await context.request.post(base+'/jury-nexus/api/auth/login',{data:{identifier:name+'@jury.staging.invalid',password},headers:{Origin:base}});
 assert.equal(r.status(),200,'Synthetic login failed');const v=(await r.json()).data,jwt=v.tokens?.accessToken||v.accessToken||v.token;
 const launch=await context.request.post(base+'/jury-nexus/api/jury/launch',{data:{},headers:{Origin:base,Authorization:'Bearer '+jwt}});if(launch.status()!==200){const error=await launch.json();throw Error('JURY_LAUNCH '+launch.status()+' '+error.code)}
 const ticket=new URLSearchParams((await launch.json()).data.url.split('?')[1]).get('ticket');
 const preview=await context.request.post(base+'/jury/api/session/preview',{data:{ticket},headers:{Origin:base}});if(preview.status()!==200){const error=await preview.json();throw Error('SESSION_PREVIEW '+preview.status()+' '+error.code)}
 const identity=(await preview.json()).data;
 const exchange=await context.request.post(base+'/jury/api/session/exchange',{data:{ticket,confirmedReference:identity.reference},headers:{Origin:base}});
 if(exchange.status()!==200){const error=await exchange.json();throw Error('SESSION_EXCHANGE '+exchange.status()+' '+error.code)}return(await exchange.json()).data;
}
async function request(c,s,path,body,method=body===undefined?'GET':'POST'){
 const r=await c.request.fetch(base+'/jury/api'+path,{method,headers:{Origin:base,'X-Jury-CSRF':s.csrfToken,'X-Jury-Actor':s.reference},...(body===undefined?{}:{data:body})});return{status:r.status(),body:await r.json()};
}
async function call(c,s,path,body,method){const r=await request(c,s,path,body,method);assert.equal(r.status,200,path+' '+r.body.code);return r.body.data}
(async()=>{
 const browser=await chromium.launch({args:['--ignore-certificate-errors']});
 const auth=await browser.newContext({ignoreHTTPSErrors:true});await login(auth,'student1',secrets.student);const storage=await auth.storageState();const checks=[];
 for(const width of [390,768,1440])for(const theme of ['light','dark'])for(const lang of ['fr','en']){
  const c=await browser.newContext({ignoreHTTPSErrors:true,storageState:storage,viewport:{width,height:1000}});
  await c.addInitScript(({theme,lang})=>{localStorage.setItem('jury-theme',theme);localStorage.setItem('jury-language',lang)},{theme,lang});
  const p=await c.newPage();const response=await p.goto(base+'/jury/');assert.equal(response.status(),200);await p.locator('[data-learner-home]').waitFor();
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const styles=await p.locator('.learner-filters>select').first().evaluate(el=>{const c=getComputedStyle(el);return{height:el.getBoundingClientRect().height,radius:c.borderRadius,color:c.color,background:c.backgroundColor}});
  assert.ok(styles.height>=40);assert.equal(styles.radius,'12px');assert.notEqual(styles.color,styles.background);
  assert.ok(await p.locator('a.learner-project-card').count()<=6);
  if(width===1440&&theme==='dark'&&lang==='en')await p.screenshot({path:'/evidence/learner-desktop.png',fullPage:true});
  if(width===390&&theme==='light'&&lang==='fr')await p.screenshot({path:'/evidence/learner-mobile.png',fullPage:true});
  checks.push({width,theme,lang,filtersStyled:true,noOverflow:true});await c.close();
 }
 await auth.close();await browser.close();fs.writeFileSync('/evidence/visual-results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,variants:checks.length}));
})().catch(e=>{console.error(e);process.exit(1)});
