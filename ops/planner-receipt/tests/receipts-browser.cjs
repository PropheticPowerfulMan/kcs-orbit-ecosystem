
const{chromium}=require('/runtime/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict');
const fixture=JSON.parse(fs.readFileSync('/evidence/fixture.private.json'));
(async()=>{const browser=await chromium.launch({args:['--ignore-certificate-errors']}),checks=[];
for(let i=0;i<fixture.variants.length;i++){
 const v=fixture.variants[i];console.log('CASE',v.kind,v.lang,v.width);const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:v.width,height:900}}),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await c.route('https://mail.google.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<h1>SYNTHETIC mailbox return</h1>'}));
 await p.goto(v.url);await p.locator('#receipt-form').waitFor();
 assert.ok((await p.locator('#receipt-token').inputValue()).length===64,'Token must load under the proxy CSP');
 await p.waitForFunction(()=>document.querySelector('header img').naturalWidth>0);
 assert.equal(await p.locator('#receipt-submit').isDisabled(),true);
 await p.locator('input[name=emailReceived]').check();
 if(v.attachment){assert.equal(await p.locator('#receipt-submit').isDisabled(),true);await p.locator('input[name=pdfReceived]').check()}
 else assert.equal(await p.locator('#receipt-attachment').isHidden(),true);
 const response=p.waitForResponse(res=>res.request().method()==='POST'&&new URL(res.url()).pathname===new URL(v.url).pathname);
 await p.locator('#receipt-submit').click();const result=await response;assert.equal(result.status(),200);assert.ok((await result.json()).data.confirmedAt);
 await p.locator('#receipt-overlay:not([hidden])').waitFor();assert.equal(await p.locator('.receipt-modal').getAttribute('data-error'),'false');
 const box=await p.locator('.receipt-modal').boundingBox();assert.ok(Math.abs(box.x+box.width/2-v.width/2)<2);assert.ok(Math.abs(box.y+box.height/2-450)<2);
 if((v.width===390&&v.lang==='fr'&&v.kind==='report-card')||(v.width===1440&&v.lang==='en'&&v.kind==='message'))await p.screenshot({path:'/evidence/receipt-'+v.kind+'-'+v.lang+'-'+v.width+'.png'});
 if(i===0)await p.waitForURL('https://mail.google.com/**',{timeout:12000});
 else await p.locator('#receipt-stay').click();
 const reopened=await c.newPage();await reopened.goto(v.url);await reopened.locator('#receipt-title').filter({hasText:v.lang==='fr'?'Réception déjà confirmée':'Receipt already confirmed'}).waitFor();assert.equal(await reopened.locator('#receipt-form').isHidden(),true);await reopened.locator('#receipt-stay').click();
 const token=new URLSearchParams(new URL(v.url).hash.slice(1)).get('token');
 const repeated=await c.request.post(new URL(v.url).origin+new URL(v.url).pathname,{headers:{Origin:'https://receipt-qa',Accept:'application/json'},data:{token,confirmed:'yes',formVersion:'2',emailReceived:'yes',...(v.attachment?{pdfReceived:'yes'}:{})}});
 assert.equal(repeated.status(),200);assert.equal((await repeated.json()).data.alreadyConfirmed,true);
 assert.deepEqual(errors,[]);checks.push({kind:v.kind,lang:v.lang,width:v.width,cspTokenLoaded:true,logoVisible:true,acknowledged:true,centeredModal:true,repeatedLinkReadOnly:true});await c.close();
}
const c=await browser.newContext({ignoreHTTPSErrors:true}),p=await c.newPage();await p.goto('https://receipt-qa/api/report-card-receipts/qa-receipt-before-20261126?lang=fr#token='+'0'.repeat(64));await p.locator('#receipt-overlay:not([hidden])').waitFor();assert.equal(await p.locator('.receipt-modal').getAttribute('data-error'),'true');assert.equal(await p.locator('#receipt-form').isHidden(),true);await c.close();
await browser.close();fs.writeFileSync('/evidence/receipt-browser-results.json',JSON.stringify({passed:true,checks,invalidLinksNeverConfirm:true,automaticGmailReturn:true},null,2));console.log(JSON.stringify({passed:true,variants:checks.length,automaticGmailReturn:true}));
})().catch(e=>{console.error(e);process.exit(1)});
