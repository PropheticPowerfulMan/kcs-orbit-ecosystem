import {test} from 'node:test'
import assert from 'node:assert/strict'
import {aggregateReportCardSubmissionHistory} from './reportCardSubmissionHistory.js'
test('durable receipts retain the first send and every resubmission while drafts do not count',()=>{
 const make=(id:string,targetId:string,action:string,date:string)=>({id,targetId,action,createdAt:new Date(date)})
 const rows=[
  make('second','q1','MAIN_TEACHER_REPORT_CARD_RESUBMITTED','2026-11-14T09:00:00Z'),
  make('draft','q1','MAIN_TEACHER_REPORT_CARD_DRAFT_SAVED','2026-11-14T10:00:00Z'),
  make('first','q1','MAIN_TEACHER_REPORT_CARD_SUBMITTED','2026-11-13T08:00:00Z'),
  make('other-cycle','q2','MAIN_TEACHER_REPORT_CARD_SUBMITTED','2026-12-13T08:00:00Z'),
  make('other-learner','other','MAIN_TEACHER_REPORT_CARD_SUBMITTED','2026-11-13T08:00:00Z'),
 ]
 const histories=aggregateReportCardSubmissionHistory(rows,['q1','q2','unsent'])
 assert.equal(histories.get('q1')?.count,2)
 assert.equal(histories.get('q1')?.firstSubmittedAt,'2026-11-13T08:00:00.000Z')
 assert.equal(histories.get('q1')?.lastSubmittedAt,'2026-11-14T09:00:00.000Z')
 assert.deepEqual(histories.get('q1')?.receipts.map(row=>row.id),['first','second'])
 assert.equal(histories.get('q2')?.count,1)
 assert.deepEqual(histories.get('unsent'),{count:0,firstSubmittedAt:null,lastSubmittedAt:null,receipts:[]})
 assert.equal(histories.has('other'),false)
})
