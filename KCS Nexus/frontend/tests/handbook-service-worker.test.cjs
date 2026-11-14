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
 return {cached,writes,offline(){network=()=>Promise.reject(new Error('offline'))},respondWith(response){network=()=>Promise.resolve(response)},async request(path,headers={}){let result;const pending=[];handlers.fetch({request:{url:'https://kcs.example'+path,method:'GET',mode:'navigate',headers:new Headers(headers)},respondWith:value=>result=value,waitUntil:value=>pending.push(value)});if(!result)return undefined;const response=await result;await Promise.all(pending);return response}}
}
const pdf='/documents/handbooks/handbook.pdf'
test('PDF navigation never replaces the application shell; previously read PDFs remain available offline',async()=>{const h=harness();assert.equal(await (await h.request(pdf)).text(),'%PDF-test-handbook');assert.deepEqual(h.writes,['https://kcs.example'+pdf]);assert.equal(await h.cached.get('./').clone().text(),'<html>KCS application</html>');h.offline();assert.equal(await (await h.request(pdf)).text(),'%PDF-test-handbook');assert.equal(await (await h.request('/school-handbook')).text(),'<html>KCS application</html>')})
test('missing PDFs and accidental HTML responses cannot enter the PDF cache',async()=>{for(const response of [new Response('Not found',{status:404}),new Response('<html>fallback</html>',{headers:{'Content-Type':'text/html'}})]){const h=harness();h.respondWith(response);await h.request(pdf);assert.deepEqual(h.writes,[])}})
test('API calls, sibling applications and partial PDF requests are left to their existing handlers',async()=>{const h=harness();for(const route of ['/api/parents','/kitchen/menu','/sentinel/registry'])assert.equal(await h.request(route),undefined);assert.equal(await h.request(pdf,{Range:'bytes=0-100'}),undefined);assert.deepEqual(h.writes,[])})
test('an uncached offline PDF reports failure without impersonating the application shell',async()=>{const h=harness();h.offline();const response=await h.request(pdf);assert.equal(response.status,503);assert.deepEqual(h.writes,[])})
