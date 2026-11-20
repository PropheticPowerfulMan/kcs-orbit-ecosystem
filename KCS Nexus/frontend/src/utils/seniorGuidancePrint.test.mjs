import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import QRCode from 'qrcode'
const source = readFileSync(new URL('./seniorGuidancePrint.ts', import.meta.url), 'utf8').replace(/^import .*$/gm, '')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const { guidanceStatistics, buildSeniorGuidanceDocument } = new Function('QRCode', 'getAssetUrl', 'showOfficialDocument', js.replace(/export /g, '') + ';return { guidanceStatistics, buildSeniorGuidanceDocument }')(QRCode, v => '/'+v, () => {})
globalThis.location = { origin: 'https://kinshasachristianschool.org' }
const learner = (readiness, applications = []) => ({ name: 'Learner <script>alert(1)</script>', studentNumber: 'QA-ONLY', section: 'A', intendedStudy: 'Science & Technology', destinations: 'DRC', readiness, nextMeeting: '—', advisorNote: '<img src=x onerror=alert(1)>', checklist: [{ label: 'Reference', status: 'Done' }], applications })
test('readiness mean excludes missing plans and keeps them visible in the distribution', () => {
 const s = guidanceStatistics([learner(0),learner(50),learner(100),learner(null)])
 assert.equal(s.mean,50);assert.equal(s.scored,3);assert.deepEqual(s.readiness,[1,1,1,1]);assert.equal(s.count,4)
})
test('application pipeline includes interview and all terminal states without inventing offers', () => {
 const states=['SHORTLISTED','PREPARING','SUBMITTED','INTERVIEW','OFFER','ENROLLED','DECLINED','WITHDRAWN']
 const s=guidanceStatistics([learner(null,states.map(state=>({state})))])
 assert.equal(s.activeApplications,8);assert.equal(s.offers,2);assert.equal(s.pipeline.reduce((n,v)=>n+v.count,0),8);assert.equal(s.mean,null)
})
test('individual and cohort documents retain accents, escape data, use a vector QR and identify snapshot limitations', async () => {
 for(const language of ['fr','en']) {
  const d=await buildSeniorGuidanceDocument({language,academicYear:'2026-2027',schoolDate:'2026-11-20',advisor:'Équipe KCS',individual:true,learners:[learner(71.4)]})
  assert.match(d.html,/<svg[^>]*viewBox=/);assert.match(d.html,/Snapshot SHA-256: [a-f0-9]{64}/)
  assert.match(d.html,/&lt;script&gt;alert/);assert.doesNotMatch(d.html,/<img src=x/);assert.match(d.html,/Équipe KCS/)
  assert.match(d.html,language==='fr'?/ne constitue pas une signature électronique/:/not an electronic signature/)
  assert.match(d.html,/table-header-group/);assert.match(d.html,/counter\(pages\)/)
  assert.doesNotMatch(d.html,/<script>/)
 }
})
const presentationSource=readFileSync(new URL('./seniorAcademicPresentation.ts',import.meta.url),'utf8')
const presentationJs=ts.transpileModule(presentationSource,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText
const {seniorAcademicPresentation}=new Function(presentationJs.replace(/export /g,'')+';return {seniorAcademicPresentation}')()
test('ST academic polish changes only a stylesheet, preserving every result and authenticity element',()=>{
 const document='<!doctype html><html><head><title>Official</title></head><body><main class="sheet"><img src="data:image/png;base64,qr" alt="QR"><p>Student · 84.92%</p><a href="/verify/report?token=proof">ID-123</a></main></body></html>'
 const after=seniorAcademicPresentation(document)
 assert.equal(after.replace(/<style data-senior-document-presentation>[\s\S]*?<\/style>/,''),document)
})
