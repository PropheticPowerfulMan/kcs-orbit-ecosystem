import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ??= 'postgresql://unit:unit@127.0.0.1:5432/unused_unit_database'
process.env.JWT_SECRET ??= 'unit-only-jwt-secret-with-more-than-32-characters'
process.env.JWT_REFRESH_SECRET ??= 'unit-only-refresh-secret-with-more-than-32-characters'
const { attendanceWithSuspensions, attendanceWindowForCalendar, shouldRefreshReportCardAttendance, hasReportCardAttendanceOverride, attendanceSummarySnapshotKey } = await import('./reportAttendance.service.js')
import { summarizeAttendanceStatuses } from '../utils/attendancePolicy.js'
const window = { gte: new Date('2026-10-01T00:00:00Z'), lte: new Date('2026-10-31T23:59:59Z') }
test('a corrected day after a section transfer counts once using the latest official record', () => {
 const date = new Date('2026-10-05T00:00:00Z')
 const rows = attendanceWithSuspensions([{date,status:'ABSENT',updatedAt:new Date('2026-10-05T08:00:00Z')},{date,status:'PRESENT',updatedAt:new Date('2026-10-05T09:00:00Z')}],[],window)
 assert.equal(rows.length,1); assert.equal(rows[0].status,'PRESENT')
 assert.equal(summarizeAttendanceStatuses(rows.map(row=>row.status)).attendanceRate,100)
})
test('a daily register has precedence over individual lesson records', () => {
 const date = new Date('2026-10-05T00:00:00Z')
 assert.equal(attendanceWithSuspensions([{date,status:'PRESENT',period:'Daily'},{date,status:'ABSENT',period:'French'}],[],window)[0].status,'PRESENT')
})
test('an official suspension replaces a prior present mark and does not add weekends', () => {
 const rows = attendanceWithSuspensions([{date:new Date('2026-10-09T00:00:00Z'),status:'PRESENT'}],[{suspensionStart:new Date('2026-10-09'),suspensionEnd:new Date('2026-10-12')}],window)
 assert.equal(rows.length,2); assert.ok(rows.every(row=>row.status==='SUSPENDED'))
 assert.equal(summarizeAttendanceStatuses(rows.map(row=>row.status)).absent,2)
})
test('attendance records from another reporting period cannot affect the result', () => {
 const rows=attendanceWithSuspensions([{date:new Date('2025-10-05'),status:'ABSENT'},{date:new Date('2026-10-05'),status:'PRESENT'},{date:new Date('2026-11-05'),status:'ABSENT'}],[],window)
 assert.equal(rows.length,1);assert.equal(rows[0].status,'PRESENT')
})
test('published calendar boundaries determine the semester and quarter', () => {
 const calendar={name:'2027-2028',startDate:'2027-09-06',endDate:'2028-06-10',periods:[{type:'QUARTER',sequence:1,startDate:'2027-09-06',endDate:'2027-11-05'},{type:'SEMESTER',sequence:1,startDate:'2027-09-06',endDate:'2028-01-28'}]}
 assert.equal(attendanceWindowForCalendar('2027-2028','Semester 1 · Quarter 1',calendar).lte.toISOString(),'2027-11-05T23:59:59.999Z')
 assert.equal(attendanceWindowForCalendar('2027-2028','Semester 1',calendar).lte.toISOString(),'2028-01-28T23:59:59.999Z')
})
test('draft and review queues refresh while approved records and manual corrections retain their summary', () => {
 const base={attendanceSummary:{present:1},publicationStatus:'DRAFT'}
 assert.equal(shouldRefreshReportCardAttendance(base),true)
 assert.equal(shouldRefreshReportCardAttendance({...base,publicationStatus:'READY_FOR_REVIEW'}),true)
 for(const publicationStatus of ['APPROVED','EMAILED','POSTED_TO_PORTAL'])assert.equal(shouldRefreshReportCardAttendance({...base,publicationStatus}),false)
 assert.equal(shouldRefreshReportCardAttendance({...base,academicCorrections:{correctedBy:'admin',attendanceOverride:true}}),false)
 assert.equal(shouldRefreshReportCardAttendance({...base,academicCorrections:{correctedBy:'admin',attendanceOverride:false}}),true)
 assert.equal(shouldRefreshReportCardAttendance({...base,academicCorrections:{correctedBy:'admin'}}),false)
 assert.equal(shouldRefreshReportCardAttendance({...base,attendanceSummary:null,publicationStatus:'APPROVED'}),true)
})

test('polishing an approved record does not mistake its frozen state for a manual attendance override', () => {
 assert.equal(hasReportCardAttendanceOverride({academicCorrections:{attendanceOverride:false}}),false)
 assert.equal(hasReportCardAttendanceOverride({academicCorrections:{correctedBy:'admin',attendanceOverride:true}}),true)
 assert.equal(attendanceSummarySnapshotKey({present:1,total:1,attendanceRate:100}),attendanceSummarySnapshotKey({attendanceRate:100,total:1,present:1}))
})
