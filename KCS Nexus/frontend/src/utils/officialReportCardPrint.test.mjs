import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const source=readFileSync(new URL('./officialReportCardPrint.ts',import.meta.url),'utf8').match(/export const teacherDisplayName =[\s\S]*?\n}/)[0]
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {teacherDisplayName}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
test('browser report-card teacher names use proper case for every part',()=>{
 for(const [input,expected] of [['NKOTE FANNY','Nkote Fanny'],['  nkote   fanny  ','Nkote Fanny'],['ÉMANGO grâce','Émango Grâce'],['jean-pierre d’angelo','Jean-Pierre D’Angelo'],["O'NEILL","O'Neill"],['',''],['—','—'],[undefined,''],[null,'']])assert.equal(teacherDisplayName(input),expected)
})

const courseSource = readFileSync(new URL('./officialReportCardPrint.ts',import.meta.url),'utf8').match(/export const courseDisplayName =[\s\S]*?\n}/)[0]
const courseCode = ts.transpileModule(courseSource,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {courseDisplayName} = await import('data:text/javascript;base64,'+Buffer.from(courseCode).toString('base64'))
test('report-card course names preserve spelling and normalize presentation',()=>{
 for(const [input,expected] of [['wRITTING and GRAMMAR','Writting and Grammar'],['ALGEBRA 2','Algebra 2'],['éducation physique et SPORTIVE','Éducation Physique et Sportive'],[undefined,''],[null,'']])assert.equal(courseDisplayName(input),expected)
})
