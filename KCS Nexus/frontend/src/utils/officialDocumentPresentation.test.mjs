import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const path=new URL('./officialDocumentPresentation.ts',import.meta.url)
const source=readFileSync(path,'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText
const {enhanceOfficialDocument}=new Function(js.replace(/export /g,'')+';return {enhanceOfficialDocument}')()
test('presentation retains all content, signatures, QR and document identity exactly',()=>{
 const html='<!doctype html><html><head><style>@page{size:A4;margin:10mm}.sheet{height:277mm}</style></head><body><main class="sheet"><p>Élève · 81.24%</p><img src="data:image/png;base64,qr" alt="QR"><a href="/verify?id=ABC">ABC</a><img src="data:image/png;base64,signature" alt="Signature"></main></body></html>'
 const after=enhanceOfficialDocument(html)
 assert.equal(after.replace(/<style data-kcs-academic-finish>[\s\S]*?<\/style>/,''),html)
 assert.equal(enhanceOfficialDocument(after),after)
 assert.doesNotMatch(after.match(/<style data-kcs-academic-finish>([\s\S]*?)<\/style>/)[1],/font-size|padding|margin|height:|width:|@page|display:|position:/)
})
test('preview and mail renderer use identical finishing rules',()=>{
 assert.equal(source,readFileSync(new URL('../../../backend/src/utils/officialDocumentPresentation.ts',import.meta.url),'utf8'))
})
