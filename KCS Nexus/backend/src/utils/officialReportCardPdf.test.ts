import assert from 'node:assert/strict'
import test from 'node:test'
import { teacherDisplayName } from './officialReportCardPdf.js'
test('report-card teacher names capitalize every part and preserve accents and separators', () => {
  for (const [input, expected] of [['NKOTE FANNY','Nkote Fanny'],['  nkote   fanny  ','Nkote Fanny'],['ÉMANGO grâce','Émango Grâce'],['jean-pierre d’angelo','Jean-Pierre D’Angelo'],["O'NEILL","O'Neill"],['',''],['—','—'],[undefined,''],[null,'']]) assert.equal(teacherDisplayName(input), expected)
})
