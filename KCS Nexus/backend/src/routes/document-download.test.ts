import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocumentDownloadHandler, documentDownloadRouter, pdfSnapshot } from './document-download.routes.js'
const html = '<!doctype html><html><head><style>@page{size:A4 landscape}body{color:#073b70}</style></head><body><h1>QA document</h1><img src="data:image/png;base64,aGVsbG8="><a href="https://kinshasachristianschool.org/verify">Verify</a></body></html>'
test('preserves static layout, embedded images and verification links', () => {
 assert.equal(pdfSnapshot({html,filename:'KCS-élève.pdf'}).html,html)
 assert.equal(pdfSnapshot({html,filename:'../report\r\n.pdf'}).filename,'..-report--.pdf')
 assert.equal(pdfSnapshot({html:html.replace('body{','body{background:url("data:image/png;base64,aGVsbG8=");'),filename:'test'}).filename,'test.pdf')
})
test('rejects scripts, external images/styles, extra fields and oversized documents', () => {
 for(const content of ['<script>alert(1)</script>','<iframe src="data:text/html,hi"></iframe>','<img src="file:///etc/passwd">','<img src="https://other.invalid/image">','<style>@import "https://other.invalid"</style>','<style>body{background:url("https://other.invalid")}</style>','<img src="data:image/png;base64,AAAA" onerror="alert(1)">'])assert.throws(()=>pdfSnapshot({html:html.replace('</body>',content+'</body>'),filename:'test'}))
 assert.throws(()=>pdfSnapshot({html,filename:'test',studentId:'other-student'}))
 assert.throws(()=>pdfSnapshot({html:'<!doctype html>'+'x'.repeat(6*1024*1024),filename:'test'}))
})
const call=(handler:ReturnType<typeof createDocumentDownloadHandler>,user='qa-user')=>new Promise<{headers:Record<string,string>;body?:Buffer;error?:any}>(resolve=>{
 const headers:Record<string,string>={}
 handler({user:user?{sub:user}:undefined,body:{html,filename:'KCS-élève'}} as any,{setHeader:(name:string,value:string)=>{headers[name]=value},send:(body:Buffer)=>resolve({headers,body})} as any,(error:any)=>resolve({headers,error}))
})
test('returns authenticated real PDF attachment without academic writes',async()=>{
 const handler=createDocumentDownloadHandler(async source=>{assert.equal(source,html);return Buffer.from('%PDF-1.7\nQA')})
 const result=await call(handler)
 assert.equal(result.headers['Content-Type'],'application/pdf')
 assert.match(result.headers['Content-Disposition'],/attachment;.*filename\*=UTF-8''KCS-%C3%A9l%C3%A8ve.pdf/)
 assert.equal(result.headers['Cache-Control'],'no-store, private')
 assert.ok(result.body?.subarray(0,5).equals(Buffer.from('%PDF-')))
 assert.equal((await call(handler,'')).error?.statusCode,401)
 assert.equal(documentDownloadRouter.stack[0].name,'authenticate')
})
test('limits simultaneous conversion and releases slots after failures',async()=>{
 let release:()=>void=()=>{}
 const handler=createDocumentDownloadHandler(()=>new Promise<Buffer>((_resolve,reject)=>{release=()=>reject(new Error('renderer unavailable'))}))
 const first=call(handler);assert.equal((await call(handler)).error?.statusCode,429)
 release();assert.match((await first).error?.message,/unavailable/)
 const retry=call(handler);release();assert.notEqual((await retry).error?.statusCode,429)
})
