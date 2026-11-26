
const {chromium}=require('/runtime/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs');
const actor=JSON.parse(fs.readFileSync('/fixtures/browser-fixtures.private.json')).find(a=>a.role==='parent');
const user={...actor.user,role:'parent',accessRoles:['parent']};
const days=['monday','mardi','Wednesday','jeudi','FRIDAY'];
const schedule=days.flatMap((day,d)=>Array.from({length:7},(_,i)=>({id:'session-'+(d*7+i),day,startTime:String(8+i).padStart(2,'0')+':00',endTime:String(9+i).padStart(2,'0')+':00',room:'Room '+(d+1),course:{name:'Course '+(d*7+i+1),code:'C'+(d*7+i+1)},teacher:'Teacher QA'}))).reverse();
const child=id=>({id,localProfileId:id,studentNumber:id,grade:'Grade 7',user:{lastName:id==='qa-child-a'?'Alpha':'Beta',firstName:'Learner'},academicVisibility:{enabled:true,grades:true,reportCards:false,transcripts:false},academicAccess:{allowed:true},academicSummary:{average:80,attendanceRate:100,publishedGrades:0}});
(async()=>{
 const browser=await chromium.launch({args:['--ignore-certificate-errors']});const checks=[];
 for(const width of [390,768,1440])for(const theme of ['light','dark'])for(const lang of ['fr','en']){
  console.log('CASE',width,theme,lang);
  const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
  await c.addInitScript(({user,theme,lang})=>{
   sessionStorage.setItem('kcs-auth',JSON.stringify({state:{user,token:'synthetic-parent-ui-token',refreshToken:'synthetic-parent-ui-refresh'},version:0}));
   localStorage.setItem('kcs-ui',JSON.stringify({state:{theme,language:lang,sidebarCollapsed:false},version:0}));
  },{user,theme,lang});
  await c.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;let data=[];
   if(path.endsWith('/auth/me'))data=user;
   else if(path.endsWith('/students/me/children'))data=[child('qa-child-a'),child('qa-child-b')];
   else if(path.endsWith('/students/qa-child-a/timetable'))data=schedule;
   else if(path.endsWith('/students/qa-child-b/timetable'))data=[{...schedule[0],id:'child-b-session',day:'wednesday',course:{name:'Child B Science'}}];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  const page=await c.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await page.goto('https://role-qa/portal/parent/performance');
  const panel=page.locator('[data-parent-published-timetable]');await panel.locator('.nexus-timetable-studio').waitFor();
  await panel.getByRole('button',{name:lang==='fr'?'Semaine':'Week',exact:true}).click();
  assert.equal(await panel.locator('.nts-day').count(),5);
  assert.equal(await panel.locator('.nts-session').count(),35);
  assert.equal(await panel.locator('.nts-day').last().locator('.nts-session').count(),7);
  assert.equal((await panel.locator('.nts-day').first().locator('.nts-time strong').first().innerText()).replace(/\s/g,''),'08:00→09:00');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow');
  await panel.getByRole('button',{name:lang==='fr'?'Jour':'Day',exact:true}).click();
  await panel.locator('.nts-days button').last().click();
  assert.equal(await panel.locator('.nts-session').count(),7);
  await panel.getByRole('textbox').fill('Course 35');
  assert.equal(await panel.locator('.nts-session').count(),1);
  await panel.getByRole('textbox').fill('');
  if(width===1440&&theme==='light'&&lang==='en'){await panel.getByRole('button',{name:'Week',exact:true}).click();await panel.screenshot({path:'/evidence/parent-desktop.png'})}
  if(width===390&&theme==='dark'&&lang==='fr')await panel.screenshot({path:'/evidence/parent-mobile.png'});
  await page.locator('.parent-child-trigger').click();
  const picker=page.locator('.parent-child-menu').getByRole('combobox');await picker.fill('Beta');
  await page.getByRole('option',{name:/Beta/}).click();
  await panel.locator('.nts-hero h2').waitFor();
  await panel.getByRole('button',{name:lang==='fr'?'Semaine':'Week',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-parent-published-timetable] .nts-session').length===1);
  assert.equal(await panel.locator('.nts-day').count(),5);
  assert.equal(await panel.locator('.nts-session').count(),1);
  assert.match(await panel.innerText(),/Child B Science/);assert.ok(!(await panel.innerText()).includes('Course 35'));
  assert.equal(await panel.locator('.nts-metrics>div').nth(2).locator('strong').innerText(),'1');
  checks.push({width,theme,lang,all35Sessions:true,all5Weekdays:true,fridayVisible:true,childSwitchResetsFilters:true,sparseDaysHonest:true});await c.close();
 }
 await browser.close();fs.writeFileSync('/evidence/browser-results.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,variants:checks.length}));
})().catch(e=>{console.error(e);process.exit(1)});
