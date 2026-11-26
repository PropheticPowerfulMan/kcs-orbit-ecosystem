
const{chromium}=require('/runtime/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict');
const a=JSON.parse(fs.readFileSync('/fixtures/browser-fixtures.private.json')).find(a=>a.role==='parent'),user={...a.user,role:'parent',accessRoles:['parent']};
const children=Array.from({length:25},(_,i)=>({id:'child-'+i,studentNumber:'KCS-'+i,grade:'Grade '+(i%12+1),user:{lastName:i===0?'Éléonore':'Family '+i,firstName:'Child'},academicVisibility:{enabled:true,grades:true},academicAccess:{allowed:true},academicSummary:{average:80,attendanceRate:100}}));
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors']}),checks=[];
for(const width of [390,768,1440]){
 const c=await b.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900}});
 await c.addInitScript(({user})=>{sessionStorage.setItem('kcs-auth',JSON.stringify({state:{user,token:'synthetic',refreshToken:'synthetic'},version:0}));localStorage.setItem('kcs-ui',JSON.stringify({state:{theme:'dark',language:'en'},version:0}))},{user});
 let failed=false,retry=false,secondary=0;
 await c.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let data=[];
 if(path.endsWith('/auth/me'))data=user;
 else if(path.endsWith('/students/me/children')){if(failed&&!retry){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Connection interrupted'})});return}data=children}
 else if(/\/(events|notifications|messages\/contacts|messages\/history)/.test(path)){await new Promise(r=>setTimeout(r,6000));secondary++}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})}).catch(()=>{});
 });
 const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const start=Date.now();
 await page.goto('https://role-qa/portal/parent/dashboard');await page.locator('.parent-child-trigger').waitFor();assert.equal(secondary,0,'Children must not await secondary services');const ms=Date.now()-start;
 await page.locator('.parent-child-trigger').click();const input=page.locator('.parent-child-menu').getByRole('combobox');
 await input.fill('eleonore');assert.equal(await page.locator('.parent-child-menu').getByRole('option').count(),1);
 await input.press('Enter');assert.match(await page.locator('.parent-child-trigger').innerText(),/Éléonore/);
 await page.locator('.parent-child-trigger').click();await input.fill('KCS-24');assert.equal(await page.locator('.parent-child-menu').getByRole('option').count(),1);await input.press('Enter');assert.match(await page.locator('.parent-child-trigger').innerText(),/Family 24/);
 await page.locator('.parent-child-trigger').click();await input.fill('no-match');await input.press('ArrowDown');await input.press('Enter');assert.equal(await page.locator('.parent-child-menu').getByRole('option').count(),0);await input.press('Escape');assert.equal(await page.locator('.parent-child-menu').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'/evidence/parent-picker-'+width+'.png'});
 failed=true;await page.reload();await page.getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(await page.getByText('No child is linked to this parent account',{exact:true}).count(),0);
 retry=true;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('.parent-child-trigger').waitFor();
 assert.deepEqual(errors,[]);checks.push({width,initialMs:ms,independentChildren:true,searchNameGradeNumber:true,keyboard:true,networkFailureRetry:true,noFalseMissingFamily:true});await c.close();
}await b.close();fs.writeFileSync('/evidence/parent-loading-results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}))})().catch(e=>{console.error(e);process.exit(1)});
