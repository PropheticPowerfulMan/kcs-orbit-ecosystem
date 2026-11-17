import assert from 'node:assert/strict'
import test from 'node:test'
import { reportCardFilename } from './reportCardFilename.js'
test('report-card download name contains class, period, year and learner in order',()=>{
 assert.equal(reportCardFilename({grade:'Grade 11 A',term:'2026-2027 · Semester 1 · Quarter 1',studentName:'Lokala Lomboto Lévana'}),'RC - Grade 11 A - Semester 1 Quarter 1 - 2026-2027 - Lokala Lomboto Lévana.pdf')
 assert.ok(!reportCardFilename({grade:'Grade 1',term:'2026-2027 · Semester 1',studentName:'Name/\\<bad>:?'}).match(/[<>:"|?*\\/]/))
})
