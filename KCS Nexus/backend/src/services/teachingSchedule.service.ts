import {teachingCourseScheduleMatches,electiveTimetableEntry,multiClassCourse} from '../utils/teachingScheduleScope.js'
import {Prisma} from '@prisma/client'
import {prisma} from '../config/prisma.js'
import {ApiError} from '../utils/api.js'
import {academicCalendars} from './reportAttendance.service.js'
import {teachingCourseInclude} from './teachingAttendance.service.js'
import {resolveTeachingSubjects} from '../utils/teachingTimetable.js'
import {coursePeriodStates} from './courseTeachingPeriods.service.js'
import {courseMatchesPeriod} from '../utils/courseTeachingPeriods.js'
import {splitClassName} from '../utils/className.js'

type Entry={day:string;startTime:string;endTime:string;room:string;className:string;period:number}
const source=(id:string)=>'Principal course schedule · '+id
export async function teachingScheduleEditor(courseId:string,academicYear:string,semester:number){
 const [calendar,courses,rows]=await Promise.all([
  academicCalendars(),
  prisma.course.findMany({include:teachingCourseInclude}),
  prisma.academicScheduleEntry.findMany({where:{academicYear,semester,active:true},orderBy:[{day:'asc'},{startTime:'asc'}]}),
 ])
 if(!calendar.some(row=>row.name===academicYear&&row.status!=='PLANNED'))throw new ApiError(400,'TEACHING_INVALID_YEAR')
 const course=courses.find(row=>row.id===courseId)
 if(!course)throw new ApiError(404,'TEACHING_COURSE_NOT_OWNED')
 const periods=await coursePeriodStates(courses.map(row=>row.id))
 const name=(row:typeof course)=>[row.teacher.user.lastName,row.teacher.user.middleName,row.teacher.user.firstName].filter(Boolean).join(' ')
 const manual=rows.filter(row=>row.sourceDocument===source(courseId))
 const existingIds:string[]=manual.map(row=>row.id)
 const matched=manual.length?manual:rows.filter(row=>{
  if(row.sourceDocument.startsWith('Principal course schedule · '))return false
  const owners=resolveTeachingSubjects(row,courses.filter(candidate=>
   courseMatchesPeriod(periods.get(candidate.id)?.periods||[],academicYear,'Semester '+semester)&&
   teachingCourseScheduleMatches(candidate,row)),name).owners
  const belongs=owners.some(owner=>owner.id===courseId)
  if(belongs&&owners.length===1)existingIds.push(row.id)
  return belongs
 })
 const classes=(course.enrollments.length?course.enrollments.map(row=>[row.student.grade,row.student.section].filter(Boolean).join(' ')):[course.grade])
  .filter(value=>/^(?:Grade\s+\d{1,2}|K[345])(?:\s+[A-Z])?$/i.test(value))
 return {course,crossClassRoster:multiClassCourse(course)&&matched.some(electiveTimetableEntry),classes:[...new Set([...classes,...matched.filter(electiveTimetableEntry).map(row=>[row.grade,row.classGroup?.match(/[A-Z]$/)?.[0]].filter(Boolean).join(' '))])],entries:matched.map(row=>({id:row.id,day:row.day,startTime:row.startTime,endTime:row.endTime,room:row.room||'',className:[row.grade,row.classGroup?.match(/[A-Z]$/)?.[0]].filter(Boolean).join(' '),period:row.period})),existingIds}
}
export async function publishTeachingSchedule(actorId:string,courseId:string,academicYear:string,semester:number,entries:Entry[]){
 const current=await teachingScheduleEditor(courseId,academicYear,semester)
 if(entries.some(entry=>!current.classes.includes(entry.className)||entry.endTime<=entry.startTime))throw new ApiError(400,'TEACHING_SCHEDULE_INVALID')
 const slots=entries.map(entry=>[entry.day,entry.className,entry.period].join('|'))
 if(new Set(slots).size!==slots.length)throw new ApiError(400,'TEACHING_SCHEDULE_INVALID')
 // An individual teacher cannot be scheduled for overlapping classes.
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(entries[i].day===entries[j].day&&entries[i].startTime<entries[j].endTime&&entries[j].startTime<entries[i].endTime)throw new ApiError(409,'TEACHING_SCHEDULE_OVERLAP')
 const teacherName=[current.course.teacher.user.lastName,current.course.teacher.user.middleName,current.course.teacher.user.firstName].filter(Boolean).join(' ')
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql(['SELECT 1 FROM pg_advisory_xact_lock(hashtext(', '))'],'teaching-publish:'+current.course.teacherId))
  const others=await tx.academicScheduleEntry.findMany({where:{academicYear,semester,active:true,id:{notIn:current.existingIds}}})
  const allCourses=await tx.course.findMany({include:teachingCourseInclude})
  const periods=await coursePeriodStates(allCourses.map(row=>row.id),tx)
  const assignedToTeacher=others.filter(row=>{
   const explicit=row.sourceDocument.startsWith('Principal course schedule · ')?row.sourceDocument.slice('Principal course schedule · '.length):null
   const eligible=allCourses.filter(course=>
    courseMatchesPeriod(periods.get(course.id)?.periods||[],academicYear,'Semester '+semester)&&teachingCourseScheduleMatches(course,row))
   const owners=explicit?eligible.filter(course=>course.id===explicit):
    resolveTeachingSubjects(row,eligible,course=>[course.teacher.user.lastName,course.teacher.user.middleName,course.teacher.user.firstName].filter(Boolean).join(' ')).owners
   return owners.some(owner=>owner.id!==courseId&&owner.teacherId===current.course.teacherId)
  })
  const conflict=entries.some(entry=>assignedToTeacher.some(row=>row.day===entry.day&&entry.startTime<row.endTime&&row.startTime<entry.endTime))
  const personalConflict=allCourses.some(course=>course.id!==courseId&&course.teacherId===current.course.teacherId&&courseMatchesPeriod(periods.get(course.id)?.periods||[],academicYear,'Semester '+semester)&&course.schedules.some(slot=>entries.some(entry=>entry.day===slot.day&&entry.startTime<slot.endTime&&slot.startTime<entry.endTime)))
  if(conflict||personalConflict)throw new ApiError(409,'TEACHING_SCHEDULE_OVERLAP')
  await tx.academicScheduleEntry.updateMany({where:{id:{in:current.existingIds}},data:{active:false}})
  const saved=[]
  for(const entry of entries){
   const placement=splitClassName(entry.className)
   const sourceKey=['teaching-course',courseId,academicYear,semester,entry.day,entry.period,placement.grade,placement.section].join(':')
   const data={academicYear,semester,grade:placement.grade,classGroup:placement.section?placement.grade.replace('Grade ','G')+placement.section:null,day:entry.day,period:entry.period,startTime:entry.startTime,endTime:entry.endTime,subject:current.course.name+(current.crossClassRoster?' (O)':''),teacherName,room:entry.room||null,sourceDocument:source(courseId),active:true}
   saved.push(await tx.academicScheduleEntry.upsert({where:{sourceKey},create:{sourceKey,...data},update:data}))
  }
  await tx.auditLog.create({data:{actorId,action:'TEACHING_COURSE_SCHEDULE_PUBLISHED',targetType:'Course',targetId:courseId,metadata:{academicYear,semester,previous:current.entries,next:entries,preservesRecordedSessions:true}}})
  return {saved:saved.length,academicYear,semester}
 },{maxWait:10000,timeout:20000})
}
