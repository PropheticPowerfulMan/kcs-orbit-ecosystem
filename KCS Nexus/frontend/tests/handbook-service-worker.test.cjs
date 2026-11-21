const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
function harness() {
 const handlers = {}, cached = new Map([['./', new Response('<html>KCS application</html>', {headers:{'Content-Type':'text/html'}})]]), writes=[]
 let network=()=>Promise.resolve(new Response('%PDF-test-handbook', {headers:{'Content-Type':'application/pdf'}}))
 const key=request=>typeof request==='string'?request:request.url
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8'), {self:{location:{origin:'https://kcs.example'},addEventListener:(type,fn)=>handlers[type]=fn},URL,Response,console,fetch:request=>network(request),caches:{open:async()=>({put:async(request,response)=>{writes.push(key(request));cached.set(key(request),response.clone())}}),match:async(request)=>cached.get(key(request))?.clone()}})
 return {cached,writes,offline(){network=()=>Promise.reject(new Error('offline'))},respondWith(response){network=()=>Promise.resolve(response)},async request(path,headers={},mode='navigate'){let result;const pending=[];handlers.fetch({request:{url:'https://kcs.example'+path,method:'GET',mode,headers:new Headers(headers)},respondWith:value=>result=value,waitUntil:value=>pending.push(value)});if(!result)return undefined;const response=await result;await Promise.all(pending);return response}}
}
const pdf='/documents/handbooks/handbook.pdf'
test('PDF navigation never replaces the application shell; previously read PDFs remain available offline',async()=>{const h=harness();assert.equal(await (await h.request(pdf)).text(),'%PDF-test-handbook');assert.deepEqual(h.writes,['https://kcs.example'+pdf]);assert.equal(await h.cached.get('./').clone().text(),'<html>KCS application</html>');h.offline();assert.equal(await (await h.request(pdf)).text(),'%PDF-test-handbook');assert.equal(await (await h.request('/school-handbook')).text(),'<html>KCS application</html>')})
test('missing PDFs and accidental HTML responses cannot enter the PDF cache',async()=>{for(const response of [new Response('Not found',{status:404}),new Response('<html>fallback</html>',{headers:{'Content-Type':'text/html'}})]){const h=harness();h.respondWith(response);await h.request(pdf);assert.deepEqual(h.writes,[])}})
test('API calls, sibling applications and partial PDF requests are left to their existing handlers',async()=>{const h=harness();for(const route of ['/api/parents','/kitchen/menu','/sentinel/registry'])assert.equal(await h.request(route),undefined);assert.equal(await h.request(pdf,{Range:'bytes=0-100'}),undefined);assert.deepEqual(h.writes,[])})
test('an uncached offline PDF reports failure without impersonating the application shell',async()=>{const h=harness();h.offline();const response=await h.request(pdf);assert.equal(response.status,503);assert.deepEqual(h.writes,[])})

test('versioned public school PDFs are cached offline, while all private APIs remain untouched',async()=>{
 const h=harness(),url='/api/school-documents/files/11111111-1111-4111-8111-111111111111'
 assert.equal(await(await h.request(url)).text(),'%PDF-test-handbook');h.offline()
 assert.equal(await(await h.request(url)).text(),'%PDF-test-handbook')
 assert.equal(await h.request('/api/student-forum/posts'),undefined)
})
test('public images revalidate online and retain the last complete image offline',async()=>{
 const h=harness(),url='/images/home.jpg';h.cached.set('https://kcs.example'+url,new Response('old image'))
 h.respondWith(new Response('new image',{headers:{'Content-Type':'image/jpeg'}}))
 assert.equal(await(await h.request(url,{},'cors')).text(),'new image');h.offline()
 assert.equal(await(await h.request(url,{},'cors')).text(),'new image')
})

test('activation clears only owned Nexus shell caches and preserves sibling applications',async()=>{
 const handlers={},deleted=[],source=fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8'),current=/const CACHE_NAME = '([^']+)'/.exec(source)[1]
 const names=['kcs-nexus-shell-old','kcs-nexus-senior-teacher-old',current,'kcs-nexus-academy-v1','kcs-kitchen-v2','kcs-sentinel-v3']
 vm.runInNewContext(source,{self:{location:{origin:'https://kcs.example'},clients:{claim:async()=>{}},addEventListener:(key,fn)=>handlers[key]=fn},URL,caches:{keys:async()=>names,open:async()=>({keys:async()=>[],match:async()=>undefined,put:async()=>{}}),delete:async name=>{deleted.push(name)}}})
 let pending;handlers.activate({waitUntil:promise=>pending=promise});await pending
 assert.deepEqual(deleted.sort(),['kcs-nexus-shell-old','kcs-nexus-senior-teacher-old'].sort())
})

test('an application upgrade preserves the offline shell, hashed assets and school PDFs without copying private APIs',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8'),current=/const CACHE_NAME = '([^']+)'/.exec(source)[1],handlers={},origin='https://kcs.example'
 const old=new Map([[origin+'/',new Response('<html>offline shell</html>',{headers:{'Content-Type':'text/html'}})],[origin+'/assets/old.js',new Response('old app',{headers:{'Content-Type':'text/javascript'}})],[origin+'/api/school-documents/files/11111111-1111-4111-8111-111111111111',new Response('%PDF-saved',{headers:{'Content-Type':'application/pdf'}})],[origin+'/api/students',new Response('private records')],[origin+'/kitchen/assets/other.js',new Response('sibling')]])
 const entries=new Map([['kcs-nexus-shell-old',old],['kcs-kitchen-current',new Map()]]),key=value=>typeof value==='string'?value:value.url
 vm.runInNewContext(source,{URL,self:{location:{origin},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn},caches:{keys:async()=>[...entries.keys()],delete:async name=>entries.delete(name),open:async name=>{if(!entries.has(name))entries.set(name,new Map());const values=entries.get(name);return{keys:async()=>[...values.keys()],match:async request=>values.get(key(request)),put:async(request,response)=>values.set(key(request),response)}}}})
 let pending;handlers.activate({waitUntil:value=>pending=value});await pending
 const migrated=entries.get(current);assert.equal(await migrated.get(origin+'/').text(),'<html>offline shell</html>');assert.ok(migrated.has(origin+'/assets/old.js'));assert.ok(migrated.has(origin+'/api/school-documents/files/11111111-1111-4111-8111-111111111111'));assert.equal(migrated.has(origin+'/api/students'),false);assert.equal(migrated.has(origin+'/kitchen/assets/other.js'),false);assert.ok(entries.has('kcs-kitchen-current'))
})
