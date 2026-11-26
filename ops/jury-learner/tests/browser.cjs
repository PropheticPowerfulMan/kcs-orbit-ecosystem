
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
 const browser=await chromium.launch({args:['--ignore-certificate-errors']}),checks=[];
 const tc=await browser.newContext({ignoreHTTPSErrors:true}),teacher=await login(tc,'teacher',secrets.teacher),title='SYNTHETIC learner dashboard '+crypto.randomUUID().slice(0,8);
 const project=await call(tc,teacher,'/projects',{title,academicYear:'2026-2027',quarter:2,maximum:100,courseIds:['jury-qa-course-science'],description:'Research our local environment.',instructions:'Prepare a report and explain your evidence.',objectives:'Communicate evidence clearly.',submissionDeadline:new Date(Date.now()+86400000*3).toISOString(),presentationAt:new Date(Date.now()+86400000*7).toISOString()});
 await call(tc,teacher,'/projects/'+project.id+'/participants/import',{revision:project.revision,studentIds:['jury-qa-student-profile-1','jury-qa-student-profile-2']});
 let detail=await call(tc,teacher,'/projects/'+project.id);
 await call(tc,teacher,'/projects/'+project.id+'/rubric',{revision:detail.project.revision,title:'Clear scientific evidence',criteria:[{key:'evidence',name:'Evidence and reasoning',maximum:10,weight:100}]});
 detail=await call(tc,teacher,'/projects/'+project.id);await call(tc,teacher,'/projects/'+project.id+'/transition',{revision:detail.project.revision,status:'REGISTRATION_OPEN'});
 const sc=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),student=await login(sc,'student1',secrets.student);
 const own=await call(sc,student,'/projects/'+project.id);assert.equal(own.permissions.manage,false);assert.equal(own.permissions.judge,false);assert.equal(own.candidates.length,1);assert.equal(own.members.length,0);
 const other=detail.candidates.find(c=>c.id!==own.candidates[0].id);
 assert.equal((await request(sc,student,'/candidates/'+other.id+'/portfolio')).status,403);
 assert.equal((await request(sc,student,'/dashboard')).status,403);
 assert.equal((await request(sc,student,'/projects',{title:'forged',academicYear:'2026-2027',quarter:2,maximum:100,courseIds:['jury-qa-course-science']})).status,403);
 const page=await sc.newPage(),errors=[];page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});page.on('requestfailed',r=>console.log('REQUEST_FAILED',new URL(r.url()).pathname,r.failure()?.errorText));page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});page.on('response',async r=>{if(r.url().includes('/jury/api/')&&r.status()>=400){const j=await r.json().catch(()=>({}));console.log('API_ERROR',new URL(r.url()).pathname,r.status(),j.code)}});
 const navigation=await page.goto(base+'/jury/');assert.equal(navigation.status(),200,'Staging frontend must be healthy');await page.waitForTimeout(500);console.log('START_STATE',page.url(),(await page.locator('body').innerText()).slice(0,1600));await page.locator('[data-learner-home]').waitFor({timeout:60000}).catch(async e=>{console.log('FAILED_STATE',(await page.locator('body').innerText()).slice(0,2500));throw e});
 assert.ok(await page.locator('a.learner-project-card').count()<=6);assert.equal(await page.getByRole('link',{name:'My evaluations',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'New project',exact:true}).count(),0);
 await page.locator('.learner-search input').fill(title);await page.locator('a.learner-project-card').filter({hasText:title}).click();
 await page.locator('[data-learner-project]').waitFor();await page.getByRole('tab',{name:'My submission',exact:true}).click();
 await page.getByLabel('Project title',{exact:true}).fill('Student research evidence');
 await page.getByLabel(/Description/).fill('A saved synthetic evidence summary.');
 await page.locator('.topbar-right>button.icon').first().click();await page.locator('.topbar-right>button.icon').first().click();assert.equal(await page.getByLabel(/Description/).inputValue(),'A saved synthetic evidence summary.');
 await page.getByRole('button',{name:'Save portfolio draft',exact:true}).click();await page.locator('.modal[open]').waitFor();
 await page.locator('.modal[open]').getByRole('button',{name:'Close',exact:true}).last().click();
 await page.locator('.learner-submission-receipt').waitFor();
 let stored=await call(sc,student,'/candidates/'+own.candidates[0].id+'/portfolio');assert.equal(stored[0].title,'Student research evidence');assert.equal(stored[0].submittedAt,null);
 await page.reload();await page.locator('[data-learner-project]').waitFor();await page.getByRole('tab',{name:'My submission',exact:true}).click();assert.equal(await page.getByLabel('Project title',{exact:true}).inputValue(),'Student research evidence');
 await page.getByRole('button',{name:'Submit portfolio',exact:true}).click();await page.locator('.modal[open]').waitFor();await page.locator('.modal[open]').getByRole('button',{name:'Close',exact:true}).last().click();
 stored=await call(sc,student,'/candidates/'+own.candidates[0].id+'/portfolio');assert.ok(stored[0].submittedAt);const rev=stored[0].revision;
 await page.getByLabel(/Description/).fill('An improved synthetic summary.');
 await page.getByRole('button',{name:'Resubmit my updated work',exact:true}).click();await page.locator('.modal[open]').waitFor();await page.locator('.modal[open]').getByRole('button',{name:'Close',exact:true}).last().click();
 stored=await call(sc,student,'/candidates/'+own.candidates[0].id+'/portfolio');assert.ok(stored[0].revision>rev);assert.equal(stored[0].description,'An improved synthetic summary.');assert.ok(stored[0].submittedAt);
 await page.getByRole('tab',{name:'My results',exact:true}).click();await page.locator('[data-learner-results]').waitFor();assert.equal(await page.locator('.learner-result-card').count(),0);assert.match(await page.locator('[data-learner-results]').innerText(),/not available yet/);
 await page.goto(base+'/jury/#/evaluations/forged-assignment');await page.locator('[data-learner-home]').waitFor();assert.equal(await page.locator('[data-learner-project]').count(),0);
 assert.deepEqual(errors,[]);
 checks.push({realServer:true,ownProjectOnly:true,otherPortfolioDenied:true,managementDenied:true,savedDraftSurvivesReload:true,submissionAndResubmissionPersisted:true,unreleasedResultsHidden:true,forgedJudgeRouteBlocked:true});

 // Published-result and group presentation fixtures exercise only rendering;
 // ownership and persistence have already been checked against the real API.
 const fakeGroup={id:'qa-own-group-candidate',participantId:null,position:1,topic:'Shared research',group:{name:'My research team',juryGroupMember_group:[{participantId:own.self.participantId,participant:{displayNameSnapshot:student.name}},{participantId:'team-peer',participant:{displayNameSnapshot:'Same group peer'}}]}};
 const outside={id:'qa-outside-candidate',participantId:'outside-participant',participant:{displayNameSnapshot:'OUTSIDE TEAM'},group:null};
 const model={...own,project:{...own.project,status:'PUBLISHED',submissionDeadline:new Date(Date.now()-86400000).toISOString()},candidates:[fakeGroup,...own.candidates,outside]};
 await sc.route('**/jury/api/projects/'+project.id,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:model})}));
 await sc.route('**/jury/api/candidates/qa-own-group-candidate/portfolio',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})}));
 await sc.route('**/jury/api/projects/'+project.id+'/results',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{released:true,run:{version:4,status:'APPROVED'},students:[{participantId:'outside-participant',percentage:12.34,rank:2},{participantId:own.self.participantId,percentage:93.21,rank:null}]}})}));
 await sc.route('**/jury/api/projects/'+project.id+'/certificates',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})}));
 await page.goto(base+'/jury/#/projects/'+project.id);await page.locator('[data-learner-project]').waitFor();
 assert.match(await page.locator('.learner-team').first().innerText(),/Same group peer/);assert.ok(!(await page.locator('[data-learner-project]').innerText()).includes('OUTSIDE TEAM'));
 await page.getByRole('tab',{name:'My submission',exact:true}).click();await page.getByRole('combobox',{name:/My work or group/}).selectOption('qa-own-group-candidate');
 assert.equal(await page.getByRole('button',{name:'Submit portfolio',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Save portfolio draft',exact:true}).count(),0);
 await page.getByRole('tab',{name:'My results',exact:true}).click();await page.locator('.learner-result-card').waitFor();assert.match(await page.locator('.learner-result-card').innerText(),/93.21%/);assert.ok(!(await page.locator('[data-learner-results]').innerText()).includes('12.34'));
 let targetChecked=false;await sc.route('**/jury/api/projects/'+project.id+'/reports?**',route=>{const url=new URL(route.request().url());assert.equal(url.searchParams.get('targetId'),own.self.participantId);targetChecked=true;return route.fulfill({status:200,contentType:'application/pdf',headers:{'Content-Disposition':'attachment; filename="Synthetic-own-assessment.pdf"'},body:Buffer.from('%PDF-1.4\n% Synthetic UI target test only\n%%EOF')})});
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download my assessment PDF',exact:true}).click();await(await downloaded).cancel();assert.ok(targetChecked);
 checks.push({groupRosterScoped:true,unrelatedCandidateExcluded:true,closedSubmissionsReadOnly:true,onlyOwnPublishedScoreShown:true,assessmentDownloadTargetsOwnParticipant:true});
 await sc.unrouteAll({behavior:'wait'});
 const storage=await sc.storageState();const bootstrap=await call(sc,student,'/bootstrap');
 for(const width of [390,768,1440])for(const theme of ['light','dark'])for(const lang of ['fr','en']){
  console.log('VARIANT',width,theme,lang);
  const c=await browser.newContext({ignoreHTTPSErrors:true,storageState:storage,viewport:{width,height:1000}});
  await c.addInitScript(({theme,lang})=>{localStorage.setItem('jury-theme',theme);localStorage.setItem('jury-language',lang)},{theme,lang});
  const p=await c.newPage();await p.goto(base+'/jury/');await p.locator('[data-learner-home]').waitFor();
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Learner page overflow');
  assert.equal(await p.getByRole('button',{name:lang==='fr'?'Nouveau projet':'New project',exact:true}).count(),0);
  await p.locator('.learner-search input').fill(title);await p.locator('a.learner-project-card').filter({hasText:title}).click();await p.locator('[data-learner-project]').waitFor();
  await p.getByRole('tab',{name:lang==='fr'?'Critères d’évaluation':'Assessment criteria',exact:true}).click();assert.match(await p.locator('.learner-criterion').innerText(),/Evidence and reasoning/);
  if(width===1440&&theme==='dark'&&lang==='en'){await p.goto(base+'/jury/');await p.locator('[data-learner-home]').waitFor();await p.screenshot({path:'/evidence/learner-desktop.png',fullPage:true})}
  if(width===390&&theme==='light'&&lang==='fr'){await p.goto(base+'/jury/');await p.locator('[data-learner-home]').waitFor();await p.screenshot({path:'/evidence/learner-mobile.png',fullPage:true})}
  checks.push({width,theme,lang,learnerNavigation:true,noOverflow:true,realCriteria:true});await c.close();
 }
 const managerPage=await tc.newPage();await managerPage.goto(base+'/jury/');await managerPage.getByRole('button',{name:'New project',exact:true}).waitFor();assert.equal(await managerPage.locator('[data-learner-home]').count(),0);
 checks.push({teacherWorkspacePreserved:true});
 fs.writeFileSync('/evidence/browser-results.json',JSON.stringify({passed:true,checks,syntheticProjectId:project.id},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
 await sc.close();await tc.close();await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
