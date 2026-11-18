import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalTeachingDay, coursePresenceStatistics, dayOfSchool, sameTeacherName, schoolInstant, teachingStatistics, teachingTiming } from './teachingAttendance.js'
test('school dates and scheduled instants use Kinshasa regardless of device/server timezone',()=>{
 assert.equal(dayOfSchool(new Date('2026-11-18T23:30:00Z')),'2026-11-19')
 assert.equal(schoolInstant('2026-11-18','08:00').toISOString(),'2026-11-18T07:00:00.000Z')
 assert.equal(canonicalTeachingDay('Mercredi'),'Wednesday')
 assert.equal(canonicalTeachingDay('Friday'),'Friday')
 assert.equal(canonicalTeachingDay('Sunday'),null)
})
test('official teacher matching tolerates name order/accents but never a single shared name',()=>{
 assert.equal(sameTeacherName('Nkote Fanny','Fanny Nkote'),true)
 assert.equal(sameTeacherName('Mr. William Offei','Offei William'),true)
 assert.equal(sameTeacherName('William Another','William Offei'),false)
 assert.equal(sameTeacherName('William','William Offei'),false)
})
const lesson={schoolDate:'2026-11-18',expectedStartAt:'2026-11-18T07:00:00Z',expectedEndAt:'2026-11-18T08:00:00Z'}
test('entry delay, early exit and classroom coverage use actual elapsed minutes',()=>{
 const row=teachingTiming({...lesson,checkInAt:'2026-11-18T07:10:00Z',checkOutAt:'2026-11-18T07:50:00Z'},new Date('2026-11-18T09:00:00Z'))
 assert.equal(row.lateMinutes,10);assert.equal(row.earlyExitMinutes,10);assert.equal(row.actualMinutes,40);assert.equal(row.coveredMinutes,40)
 assert.equal(row.status,'COMPLETED');assert.equal(row.onTime,false)
})
test('future sessions and absent timestamps never count as zero-minute punctual arrivals',()=>{
 const now=new Date('2026-11-18T09:00:00Z')
 const stats=teachingStatistics([lesson,{...lesson,checkInAt:'2026-11-18T06:55:00Z'}, {...lesson,expectedStartAt:'2026-11-18T10:00:00Z',expectedEndAt:'2026-11-18T11:00:00Z'}],now)
 assert.equal(stats.due,2);assert.equal(stats.recorded,1);assert.equal(stats.unrecorded,1)
 assert.equal(stats.recordedPresenceRate,50);assert.equal(stats.punctualityRate,100);assert.equal(stats.meanLateMinutes,0)
 assert.equal(teachingStatistics([],now).punctualityRate,null)
})
test('scientific summaries disclose the sample and calculate mean, median and p95 from actual entries only',()=>{
 const rows=[0,5,10,30].map(minutes=>({...lesson,checkInAt:new Date(Date.parse(lesson.expectedStartAt)+minutes*60000)}))
 const stats=teachingStatistics(rows,new Date('2026-11-18T09:00:00Z'))
 assert.equal(stats.recorded,4);assert.equal(stats.meanLateMinutes,11.3);assert.equal(stats.medianLateMinutes,7.5);assert.equal(stats.p95LateMinutes,30)
 assert.equal(stats.punctualityRate,25);assert.ok(stats.punctuality95 && stats.punctuality95[0]<25 && stats.punctuality95[1]>25)
})
test('learner session attendance is explicit: late is present; excused/sick/suspended are absences',()=>{
 assert.deepEqual(coursePresenceStatistics([]),{recorded:0,present:0,late:0,absent:0,attendanceRate:null,presence95:null})
 const stats=coursePresenceStatistics(['PRESENT','LATE','ABSENT','EXCUSED','SICK','SUSPENDED'])
 assert.equal(stats.attendanceRate,33.3);assert.equal(stats.absent,4);assert.equal(stats.recorded,6)
})

test('short timetable aliases are resolved only within one unambiguous subject/class owner',async()=>{
 const {teachingAliasMatches,normalizedTeachingSubject,uniquelyAssignedCourse}=await import('./teachingAttendance.js')
 assert.equal(teachingAliasMatches('Jonathan','Lokala Lomboto Jonathan'),true)
 assert.equal(teachingAliasMatches('Christian','Gassama Christian'),true)
 assert.equal(teachingAliasMatches('David / Didier','Didier Example'),true)
 assert.equal(normalizedTeachingSubject('Algebra 2'),normalizedTeachingSubject('Algebra2'))
 assert.equal(uniquelyAssignedCourse([{id:'first'},{id:'second'}]),null)
 assert.equal(uniquelyAssignedCourse([{id:'first'},{id:'first'}])?.id,'first')
})

test('a forgotten checkout is not an endlessly active class or an invented duration',()=>{
 const row=teachingTiming({...lesson,checkInAt:'2026-11-18T07:00:00Z'},new Date('2026-11-19T09:00:00Z'))
 assert.equal(row.status,'MISSING_EXIT');assert.equal(row.actualMinutes,null);assert.equal(row.coveredMinutes,null)
 const stats=teachingStatistics([{...lesson,checkInAt:'2026-11-18T07:00:00Z'}],new Date('2026-11-19T09:00:00Z'))
 assert.equal(stats.inClass,0);assert.equal(stats.missingExits,1);assert.equal(stats.actualMinutes,0)
})
