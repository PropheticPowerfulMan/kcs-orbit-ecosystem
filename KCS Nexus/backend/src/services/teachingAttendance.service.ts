import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { ApiError } from '../utils/api.js'
import { academicCalendars, attendanceWindowForCalendar, type Calendar } from './reportAttendance.service.js'
import { nonSchoolSettings } from './attendanceCalendarSettings.service.js'
import { coursePeriodStates } from './courseTeachingPeriods.service.js'
import { courseMatchesPeriod } from '../utils/courseTeachingPeriods.js'
import { schoolDayDecision } from '../utils/schoolDayPolicy.js'
import { protectAcademicPeriod } from './academicPeriodAccess.service.js'
import { splitClassName } from '../utils/className.js'
import { canonicalTeachingDay, coursePresenceStatistics, dayOfSchool, normalizeTeachingLabel, sameTeacherName, teachingAliasMatches, normalizedTeachingSubject, uniquelyAssignedCourse, schoolInstant, teachingStatistics, teachingTiming, TEACHING_TIMEZONE, weekdayOfSchool } from '../utils/teachingAttendance.js'

type Database = Prisma.TransactionClient | typeof prisma
type Filters = { from: string; to: string; teacherUserId?: string; courseId?: string }
type Session = Prisma.TeachingSessionGetPayload<{ include: { students: true } }>
export const teachingCourseInclude = {
  teacher: { include: { user: { select: { id: true, firstName: true, middleName: true, lastName: true } } } },
  schedules: true,
  enrollments: { where: { student: { status: { in: ['active','ACTIVE'] } } }, include: { student: { include: { user: { select: { firstName: true, middleName: true, lastName: true } } } } } },
} satisfies Prisma.CourseInclude
export type TeachingCourse = Prisma.CourseGetPayload<{ include: typeof teachingCourseInclude }>
const fullName = (user: { firstName: string; middleName?: string | null; lastName: string }) => [user.lastName, user.middleName, user.firstName].filter(Boolean).join(' ')
const keyOf = (course: string, schedule: string, day: string) => [course,schedule,day].join('|')
export async function teachingServerTime(db: Database = prisma) {
  const rows = await db.$queryRaw<Array<{ now: Date }>>(Prisma.sql(['SELECT clock_timestamp() AS now']))
  if (!rows[0]?.now) throw new ApiError(503, 'TEACHING_CLOCK_UNAVAILABLE')
  return new Date(rows[0].now)
}
export function validTeachingDate(value: string) {
  const date = new Date(value+'T00:00:00Z')
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value
}
function cycleOn(day: string, calendars: Calendar[]) {
  const calendar = calendars.find(row => row.status !== 'PLANNED' && day >= row.startDate.slice(0,10) && day <= row.endDate.slice(0,10))
  if (!calendar) return null
  const within = (row: NonNullable<Calendar['periods']>[number]) => day >= row.startDate.slice(0,10) && day <= row.endDate.slice(0,10)
  const quarter = calendar.periods?.find(row => ['QUARTER','TRIMESTER'].includes(row.type) && within(row))
  const semester = calendar.periods?.find(row => row.type === 'SEMESTER' && within(row))?.sequence || (quarter && quarter.sequence > 2 ? 2 : 1)
  return { calendar, academicYear: calendar.name, semester, term: 'Semester '+semester+(quarter ? ' · Quarter '+quarter.sequence : '') }
}
type Planned = {
  id: string | null; courseReference: string; teacherUserId: string; teacherId: string | null; courseId: string | null
  scheduleKey: string; schoolDate: string; academicYear: string; semester: number; term: string
  courseName: string; courseCode: string; className: string; teacherName: string; room: string
  expectedStartAt: Date; expectedEndAt: Date
  checkInAt: Date | null; checkOutAt: Date | null; teacherNote: string | null
  reviewStatus: string; reviewNote: string | null; reviewedAt: Date | null; rosterRevision: number
  rosterSize: number; studentSummary: ReturnType<typeof coursePresenceStatistics>; source: string
}
function snapshot(record: Session, rosterSize: number): Planned {
  const {students,...data}=record
  return { ...data, rosterSize, studentSummary: coursePresenceStatistics(students.map(row => row.status)), source: 'SAVED_SESSION' }
}
export function teachingCourseMatchesClass(course: TeachingCourse, grade: string, group: string | null) {
  const section = group?.match(/\d\s*([a-z])$/i)?.[1] || ''
  const target = splitClassName(grade)
  const placements = [splitClassName(course.grade), ...course.enrollments.map(row => row.student)]
  return placements.some(value => normalizeTeachingLabel(value.grade) === normalizeTeachingLabel(target.grade) && (!section || normalizeTeachingLabel(value.section) === normalizeTeachingLabel(section)))
}
export function teachingStudentMatchesClass(student:{grade:string;section?:string|null},className:string){
  if(normalizeTeachingLabel(className)==='multi class')return true
  const target=splitClassName(className)
  return normalizeTeachingLabel(student.grade)===normalizeTeachingLabel(target.grade)&&(!target.section||normalizeTeachingLabel(student.section)===normalizeTeachingLabel(target.section))
}
export async function teachingPlan(filters: Filters, options: { strictCalendar?: boolean } = {}) {
  const now = await teachingServerTime()
  if (!validTeachingDate(filters.from) || !validTeachingDate(filters.to) || filters.from > filters.to ||
      Date.parse(filters.to)-Date.parse(filters.from) > 366*86400000) throw new ApiError(400, 'TEACHING_INVALID_RANGE')
  const calendars = await academicCalendars({ strict: options.strictCalendar })
  if (!calendars.length) throw new ApiError(503, 'TEACHING_CALENDAR_UNAVAILABLE')
  const activation = await prisma.auditLog.findUnique({ where: { id: 'course-attendance-tracking-start' }, select: { metadata: true, createdAt: true } })
  const trackingSince = (activation?.metadata as { startsOn?: string } | null)?.startsOn
  if (!trackingSince || !validTeachingDate(trackingSince)) throw new ApiError(503, 'TEACHING_REGISTER_NOT_READY')
  const courses = await prisma.course.findMany({ where: {
    ...(filters.teacherUserId ? { teacher: { userId: filters.teacherUserId } } : {}),
    ...(filters.courseId ? { id: filters.courseId } : {}),
  }, include: teachingCourseInclude, orderBy: { name: 'asc' } })
  // Resolve short official names against all candidates, not only this teacher.
  const mappingCourses = await prisma.course.findMany({include:teachingCourseInclude})
  const periods = await coursePeriodStates(mappingCourses.map(row => row.id))
  const years = calendars.filter(row => filters.to >= row.startDate.slice(0,10) && filters.from <= row.endDate.slice(0,10)).map(row => row.name)
  const [official, saved, settings] = await Promise.all([
    prisma.academicScheduleEntry.findMany({ where: { active: true, academicYear: { in: years } } }),
    prisma.teachingSession.findMany({ where: {
      schoolDate: { gte: filters.from, lte: filters.to },
      ...(filters.teacherUserId ? { teacherUserId: filters.teacherUserId } : {}),
      ...(filters.courseId ? { courseReference: filters.courseId } : {}),
    }, include: { students: true } }),
    Promise.all(calendars.map(async row => [row.name,(await nonSchoolSettings(row.name)).ranges] as const)),
  ])
  const ranges = new Map(settings)
  // Resolve the school timetable once. Do not repeat the school-wide owner
  // search for every subject on every day of an annual report.
  const manualScopes=new Set(official.filter(row=>row.sourceDocument.startsWith('Principal course schedule · ')).map(row=>row.academicYear+'|'+row.semester+'|'+row.sourceDocument.slice('Principal course schedule · '.length)))
  const mappedOfficial=new Map<string,typeof official>()
  for(const entry of official){
    const scope=entry.academicYear+'|'+entry.semester+'|'
    const manualId=entry.sourceDocument.startsWith('Principal course schedule · ')?entry.sourceDocument.slice('Principal course schedule · '.length):null
    const candidates=manualId?mappingCourses.filter(candidate=>candidate.id===manualId):mappingCourses.filter(candidate=>
      !manualScopes.has(scope+candidate.id)&&
      courseMatchesPeriod(periods.get(candidate.id)?.periods||[],entry.academicYear,'Semester '+entry.semester)&&
      [candidate.name,candidate.code].some(name=>normalizedTeachingSubject(name)===normalizedTeachingSubject(entry.subject))&&
      teachingAliasMatches(entry.teacherName,fullName(candidate.teacher.user))&&
      teachingCourseMatchesClass(candidate,entry.grade,entry.classGroup))
    const owner=uniquelyAssignedCourse(candidates)
    if(owner){const key=scope+owner.id;mappedOfficial.set(key,[...(mappedOfficial.get(key)||[]),entry])}
  }
  const sessions = new Map<string, Planned>()
  for (let day=filters.from; day<=filters.to;) {
    const cycle = cycleOn(day,calendars)
    if (day >= trackingSince && cycle && schoolDayDecision(day,calendars,ranges.get(cycle.academicYear) || []).allowed) {
      const weekday = weekdayOfSchool(day)
      for (const course of courses) {
        if (!courseMatchesPeriod(periods.get(course.id)?.periods || [],cycle.academicYear,cycle.term)) continue
        const teacherName = fullName(course.teacher.user)
        const exact=mappedOfficial.get(cycle.academicYear+'|'+cycle.semester+'|'+course.id)||[]
        const entries = exact.length ? exact.filter(row => canonicalTeachingDay(row.day) === weekday).map(row => ({
          key: 'official-period:'+row.grade+':'+(row.classGroup||'')+':'+row.period, start: row.startTime, end: row.endTime, room: row.room || '', source: 'OFFICIAL_TIMETABLE', className:[row.grade,row.classGroup?.match(/[A-Z]$/)?.[0]].filter(Boolean).join(' '),
        })) : course.schedules.filter(row => canonicalTeachingDay(row.day) === weekday).map(row => ({
          key: 'course-schedule:'+row.id, start: row.startTime, end: row.endTime, room: row.room, source: 'MY_COURSES', className:course.grade,
        }))
        for (const entry of entries) {
          if (!/^\d{2}:\d{2}$/.test(entry.start) || !/^\d{2}:\d{2}$/.test(entry.end)) continue
          const start=schoolInstant(day,entry.start),end=schoolInstant(day,entry.end)
          if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end<=start || (activation && start<activation.createdAt)) continue
          const value: Planned = {
            id:null, courseId:course.id, courseReference:course.id, teacherId:course.teacherId, teacherUserId:course.teacher.userId,
            scheduleKey:entry.key, schoolDate:day, academicYear:cycle.academicYear, semester:cycle.semester, term:cycle.term,
            courseName:course.name, courseCode:course.code, className:entry.className, teacherName, room:entry.room,
            expectedStartAt:start, expectedEndAt:end, checkInAt:null, checkOutAt:null, teacherNote:null,
            reviewStatus:'PENDING', reviewNote:null, reviewedAt:null, rosterRevision:0,
            rosterSize:course.enrollments.filter(enrollment=>teachingStudentMatchesClass(enrollment.student,entry.className)).length, studentSummary:coursePresenceStatistics([]), source:entry.source,
          }
          sessions.set(keyOf(course.id,entry.key,day),value)
        }
      }
    }
    const next=new Date(day+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);day=next.toISOString().slice(0,10)
  }
  for (const record of saved) {
    const course=courses.find(row=>row.id===record.courseReference)
    sessions.set(keyOf(record.courseReference,record.scheduleKey,record.schoolDate),snapshot(record,course?.enrollments.filter(enrollment=>teachingStudentMatchesClass(enrollment.student,record.className)).length || record.students.length))
  }
  const rows=[...sessions.values()].sort((a,b)=>a.expectedStartAt.getTime()-b.expectedStartAt.getTime() || a.teacherName.localeCompare(b.teacherName)).map(row=>({...row,timing:teachingTiming(row,now)}))
  return { now, trackingSince, calendars, courses, rows, saved }
}
export async function teachingBoard(filters: Filters) {
  const plan=await teachingPlan(filters)
  const byTeacher=new Map<string,typeof plan.rows>(), byDay=new Map<string,typeof plan.rows>()
  for(const row of plan.rows) {
    byTeacher.set(row.teacherUserId,[...(byTeacher.get(row.teacherUserId)||[]),row])
    byDay.set(row.schoolDate,[...(byDay.get(row.schoolDate)||[]),row])
  }
  const learnerGroups=new Map<string,{studentId:string;name:string;className:string;courseId:string;courseName:string;statuses:string[]}>()
  for(const session of plan.saved)for(const mark of session.students){
    const key=session.courseReference+'|'+mark.studentReference
    const entry=learnerGroups.get(key)||{studentId:mark.studentReference,name:mark.studentName,className:mark.className,courseId:session.courseReference,courseName:session.courseName,statuses:[]}
    entry.statuses.push(mark.status);learnerGroups.set(key,entry)
  }
  const learners=[...learnerGroups.values()].map(({statuses,...identity})=>({...identity,...coursePresenceStatistics(statuses)}))
  return {
    learners, learnerSummary:coursePresenceStatistics(plan.saved.flatMap(row=>row.students.map(mark=>mark.status))),
    serverUtc:plan.now.toISOString(),schoolTimezone:TEACHING_TIMEZONE,clockAuthority:'PostgreSQL clock_timestamp',
    trackingSince:plan.trackingSince,range:{from:filters.from,to:filters.to},
    calendars:plan.calendars.map(row=>({name:row.name,startDate:row.startDate,endDate:row.endDate,isCurrent:row.isCurrent})),
    courses:plan.courses.map(row=>({id:row.id,name:row.name,code:row.code,className:row.grade,teacherUserId:row.teacher.userId,teacherName:fullName(row.teacher.user),scheduleCount:row.schedules.length})),
    sessions:plan.rows,summary:teachingStatistics(plan.rows,plan.now),
    teachers:[...byTeacher].map(([id,rows])=>({id,name:rows[0].teacherName,...teachingStatistics(rows,plan.now)})),
    trend:[...byDay].map(([day,rows])=>({day,...teachingStatistics(rows,plan.now)})),
  }
}
export type Locator={courseId:string;scheduleKey:string;date:string}
async function resolvePlanned(locator:Locator,teacherUserId?:string) {
  const plan=await teachingPlan({from:locator.date,to:locator.date,courseId:locator.courseId,...(teacherUserId?{teacherUserId}:{})},{strictCalendar:true})
  const row=plan.rows.find(row=>row.scheduleKey===locator.scheduleKey)
  if(!row)throw new ApiError(404,'TEACHING_SESSION_NOT_SCHEDULED')
  return {plan,row}
}
const createSnapshot=(row:Planned)=>({
  courseId:row.courseId,courseReference:row.courseReference,teacherId:row.teacherId,teacherUserId:row.teacherUserId,
  scheduleKey:row.scheduleKey,schoolDate:row.schoolDate,academicYear:row.academicYear,semester:row.semester,term:row.term,
  courseName:row.courseName,courseCode:row.courseCode,className:row.className,teacherName:row.teacherName,room:row.room,
  expectedStartAt:row.expectedStartAt,expectedEndAt:row.expectedEndAt,
})
export async function markTeachingTime(userId:string,locator:Locator,action:'ENTRY'|'EXIT',note?:string) {
  const {plan,row}=await resolvePlanned(locator,userId)
  if(action==='ENTRY' && !schoolDayDecision(row.schoolDate,plan.calendars,(await nonSchoolSettings(row.academicYear)).ranges).allowed)throw new ApiError(409,'TEACHING_SCHOOL_DAY_CLOSED')
  const course=plan.courses.find(course=>course.id===row.courseReference && course.teacher.userId===userId)
  if(!course)throw new ApiError(403,'TEACHING_COURSE_NOT_OWNED')
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw(Prisma.sql(['SELECT 1 FROM pg_advisory_xact_lock(hashtext(', '))'],'teaching-entry:'+userId))
    const currentCourse=await tx.course.findUnique({where:{id:row.courseReference},select:{teacher:{select:{userId:true}}}})
    if(currentCourse?.teacher.userId!==userId)throw new ApiError(403,'TEACHING_COURSE_NOT_OWNED')
    const now=await teachingServerTime(tx)
    if(dayOfSchool(now)!==row.schoolDate)throw new ApiError(409,'TEACHING_TODAY_ONLY')
    const previous=await tx.teachingSession.findUnique({where:{courseReference_scheduleKey_schoolDate:{courseReference:row.courseReference,scheduleKey:row.scheduleKey,schoolDate:row.schoolDate}}})
    if(previous && previous.teacherUserId!==userId)throw new ApiError(403,'TEACHING_COURSE_NOT_OWNED')
    if((action==='ENTRY'&&previous?.checkInAt)||(action==='EXIT'&&previous?.checkOutAt))return previous
    await protectAcademicPeriod(tx,row.academicYear,row.term,userId)
    if(action==='ENTRY') {
      if(now.getTime()<row.expectedStartAt.getTime()-30*60000 || now>=row.expectedEndAt)throw new ApiError(409,'TEACHING_ENTRY_WINDOW')
      const open=await tx.teachingSession.findFirst({where:{teacherUserId:userId,checkInAt:{not:null},checkOutAt:null,schoolDate:row.schoolDate}})
      if(open && open.id!==previous?.id)throw new ApiError(409,'TEACHING_OTHER_SESSION_OPEN')
    } else if(!previous?.checkInAt)throw new ApiError(409,'TEACHING_ENTRY_REQUIRED')
    const saved=await tx.teachingSession.upsert({
      where:{courseReference_scheduleKey_schoolDate:{courseReference:row.courseReference,scheduleKey:row.scheduleKey,schoolDate:row.schoolDate}},
      create:{...createSnapshot(row),checkInAt:now,...(note?{teacherNote:note}:{})},
      update:{...(action==='ENTRY'?{checkInAt:now}:{checkOutAt:now}),...(note?{teacherNote:note}:{})},
    })
    await tx.auditLog.create({data:{actorId:userId,action:'TEACHING_SESSION_'+action,targetType:'TeachingSession',targetId:saved.id,metadata:{schoolTimezone:TEACHING_TIMEZONE,serverUtc:now.toISOString(),scheduledStart:row.expectedStartAt.toISOString(),scheduledEnd:row.expectedEndAt.toISOString()}}})
    return saved
  },{maxWait:10000,timeout:20000})
}
export async function sessionRegister(id:string,userId:string,manager:boolean) {
  const session=await prisma.teachingSession.findUnique({where:{id},include:{students:true}})
  if(!session)throw new ApiError(404,'TEACHING_SESSION_NOT_FOUND')
  if(!manager && session.teacherUserId!==userId)throw new ApiError(403,'TEACHING_COURSE_NOT_OWNED')
  const course=session.courseId?await prisma.course.findUnique({where:{id:session.courseId},include:teachingCourseInclude}):null
  const marks=new Map(session.students.map(row=>[row.studentReference,row]))
  const roster=(course?.enrollments || []).filter(enrollment=>teachingStudentMatchesClass(enrollment.student,session.className)).map(({student})=>{
    const mark=marks.get(student.id);marks.delete(student.id)
    return {studentId:student.id,name:fullName(student.user),studentNumber:student.studentNumber,className:[student.grade,student.section].filter(Boolean).join(' '),status:mark?.status||null,note:mark?.note||'',eligible:course?.teacher.userId===session.teacherUserId}
  })
  for(const mark of marks.values())roster.push({studentId:mark.studentReference,name:mark.studentName,studentNumber:mark.studentNumber,className:mark.className,status:mark.status,note:mark.note||'',eligible:false})
  return {session,roster,summary:coursePresenceStatistics(session.students.map(row=>row.status))}
}
export async function saveSessionStudents(id:string,userId:string,revision:number,entries:Array<{studentId:string;status:'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'|'SICK'|'SUSPENDED';note?:string}>) {
  if(new Set(entries.map(row=>row.studentId)).size!==entries.length)throw new ApiError(400,'TEACHING_DUPLICATE_STUDENT')
  const register=await sessionRegister(id,userId,false)
  if(!register.session.checkInAt)throw new ApiError(409,'TEACHING_ENTRY_REQUIRED')
  const eligible=new Map(register.roster.filter(row=>row.eligible).map(row=>[row.studentId,row]))
  if(entries.some(row=>!eligible.has(row.studentId)))throw new ApiError(403,'TEACHING_STUDENT_NOT_ENROLLED')
  return prisma.$transaction(async tx=>{
    const now=await teachingServerTime(tx)
    if(dayOfSchool(now)!==register.session.schoolDate)throw new ApiError(409,'TEACHING_TODAY_ONLY')
    await protectAcademicPeriod(tx,register.session.academicYear,register.session.term,userId)
    const changed=await tx.teachingSession.updateMany({where:{id,rosterRevision:revision,teacherUserId:userId},data:{rosterRevision:{increment:1}}})
    if(changed.count!==1)throw new ApiError(409,'TEACHING_REGISTER_CHANGED')
    const current=await tx.enrollment.findMany({where:{courseId:register.session.courseReference,studentId:{in:entries.map(row=>row.studentId)},course:{teacher:{userId}},student:{status:{in:['active','ACTIVE']}}},select:{studentId:true,student:{select:{grade:true,section:true}}}})
    if(current.length!==entries.length || current.some(row=>!teachingStudentMatchesClass(row.student,register.session.className)))throw new ApiError(409,'TEACHING_ROSTER_CHANGED')
    for(const entry of entries) {
      const pupil=eligible.get(entry.studentId)!
      const data={studentId:pupil.studentId,studentReference:pupil.studentId,studentName:pupil.name,studentNumber:pupil.studentNumber,className:pupil.className,status:entry.status,note:entry.note?.trim()||null,markedById:userId,markedAt:now}
      await tx.studentCoursePresence.upsert({where:{sessionId_studentReference:{sessionId:id,studentReference:pupil.studentId}},create:{sessionId:id,...data},update:data})
    }
    await tx.auditLog.create({data:{actorId:userId,action:'COURSE_LEARNER_ATTENDANCE_SAVED',targetType:'TeachingSession',targetId:id,metadata:{count:entries.length,revision:revision+1,reportCardImpact:false,gradeImpact:false}}})
    return {saved:entries.length,revision:revision+1,serverUtc:now.toISOString()}
  },{maxWait:10000,timeout:20000})
}
export async function reviewTeachingSession(actorId:string,locator:Locator,status:string,note:string) {
  const {row}=await resolvePlanned(locator)
  return prisma.$transaction(async tx=>{
    const now=await teachingServerTime(tx)
    const session=await tx.teachingSession.upsert({
      where:{courseReference_scheduleKey_schoolDate:{courseReference:row.courseReference,scheduleKey:row.scheduleKey,schoolDate:row.schoolDate}},
      create:{...createSnapshot(row),reviewStatus:status,reviewNote:note,reviewedById:actorId,reviewedAt:now},
      update:{reviewStatus:status,reviewNote:note,reviewedById:actorId,reviewedAt:now},
    })
    await tx.auditLog.create({data:{actorId,action:'TEACHING_SESSION_PRINCIPAL_REVIEW',targetType:'TeachingSession',targetId:session.id,metadata:{previousStatus:row.reviewStatus,status,note,serverUtc:now.toISOString()}}})
    return session
  })
}
export async function courseRegularity(userId:string,courseId:string,year:string,term:string) {
  const course=await prisma.course.findUnique({where:{id:courseId},include:teachingCourseInclude})
  if(!course || course.teacher.userId!==userId)throw new ApiError(403,'TEACHING_COURSE_NOT_OWNED')
  const calendar=(await academicCalendars()).find(row=>row.name===year)
  if(!calendar)throw new ApiError(400,'TEACHING_INVALID_YEAR')
  const window=attendanceWindowForCalendar(year,term,calendar)
  const from=window.gte.toISOString().slice(0,10),to=window.lte.toISOString().slice(0,10)
  const sessions=await prisma.teachingSession.findMany({where:{courseReference:courseId,teacherUserId:userId,academicYear:year,schoolDate:{gte:from,lte:to},checkInAt:{not:null}},include:{students:true}})
  const rows=course.enrollments.map(({student,createdAt})=>{
    const possible=sessions.filter(row=>(row.expectedEndAt>=createdAt && teachingStudentMatchesClass(student,row.className)) || row.students.some(mark=>mark.studentReference===student.id))
    const statuses=possible.flatMap(row=>row.students.filter(mark=>mark.studentReference===student.id).map(mark=>mark.status))
    return {studentId:student.id,name:fullName(student.user),studentNumber:student.studentNumber,expected:possible.length,unmarked:possible.length-statuses.length,...coursePresenceStatistics(statuses)}
  })
  return {courseId,academicYear:year,term,sessionCount:sessions.length,students:rows,gradeImpact:false,reportCardImpact:false,summary:coursePresenceStatistics(sessions.flatMap(row=>row.students.map(mark=>mark.status)))}
}
