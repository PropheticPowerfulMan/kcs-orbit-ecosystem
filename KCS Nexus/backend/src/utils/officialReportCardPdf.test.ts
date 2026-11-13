import assert from 'node:assert/strict'
import test from 'node:test'
import { teacherDisplayName, courseDisplayName } from './officialReportCardPdf.js'
test('report-card teacher names capitalize every part and preserve accents and separators', () => {
  for (const [input, expected] of [['NKOTE FANNY','Nkote Fanny'],['  nkote   fanny  ','Nkote Fanny'],['ÉMANGO grâce','Émango Grâce'],['jean-pierre d’angelo','Jean-Pierre D’Angelo'],["O'NEILL","O'Neill"],['',''],['—','—'],[undefined,''],[null,'']]) assert.equal(teacherDisplayName(input), expected)
})

test('report-card course formatting preserves spelling and only changes presentation', () => {
  for (const [input, expected] of [['wRITTING and GRAMMAR', 'Writting and Grammar'], ['ALGEBRA 2', 'Algebra 2'], ['éducation physique et SPORTIVE', 'Éducation Physique et Sportive'], ['BIBLE', 'Bible'], [undefined, ''], [null, '']]) assert.equal(courseDisplayName(input), expected)
})


test('the canonical document places the official period end after the reporting period in both languages', async () => {
 const { renderReportCardHtml } = await import('./officialReportCardHtml.js')
 const base = { id:'qa-card',studentName:'Synthetic Learner',studentNumber:'QA-001',grade:'Grade 7',term:'2026-2027 · Semester 1 · Quarter 1',periodEndDate:'2026-11-06',average:82,publicationStatus:'DRAFT',subjects:[],principal:{name:'Principal'} }
 const en = await renderReportCardHtml({...base,language:'en'},'QA-DOC','HASH','data:image/png;base64,AA==',new Date('2026-11-13'))
 const fr = await renderReportCardHtml({...base,language:'fr'},'QA-DOC','HASH','data:image/png;base64,AA==',new Date('2026-11-13'))
 assert.ok(en.includes('<p>Date · <b>6 November 2026</b></p>'))
 assert.ok(fr.includes('<p>Date · <b>6 novembre 2026</b></p>'))
 assert.ok(en.indexOf('Reporting period') < en.indexOf('<p>Date ·'))
})
