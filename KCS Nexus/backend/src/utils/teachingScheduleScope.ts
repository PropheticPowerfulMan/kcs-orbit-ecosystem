import {canonicalTeachingDay,normalizeTeachingLabel,schoolInstant,teachingAliasMatches,weekdayOfSchool} from './teachingAttendance.js'
import {splitClassName} from './className.js'
import {teachingSubjectScore} from './teachingTimetable.js'
type Course={id:string;name:string;grade:string;teacher:{user:{firstName:string;middleName?:string|null;lastName:string}};enrollments:Array<{student:{grade:string;section?:string|null}}>}
type Entry={grade:string;classGroup:string|null;sourceDocument:string;subject:string;teacherName:string|null;day:string;startTime:string;endTime:string;academicYear?:string;semester?:number}
export const multiClassCourse=(course:Pick<Course,'grade'>)=>/^multi\s*class$/.test(normalizeTeachingLabel(course.grade))
export const electiveTimetableEntry=(entry:Pick<Entry,'sourceDocument'|'subject'>)=>/electiv|optionnel/i.test(entry.sourceDocument)||/\((?:o|optional|elective|optionnel)\)\s*$/i.test(entry.subject)
export function teachingCourseClassMatches(course:Pick<Course,'grade'|'enrollments'>,grade:string,group:string|null){
 const section=group?.match(/\d\s*([a-z])$/i)?.[1]||'',target=splitClassName(grade)
 return [splitClassName(course.grade),...course.enrollments.map(e=>e.student)].some(p=>normalizeTeachingLabel(p.grade)===normalizeTeachingLabel(target.grade)&&(!section||normalizeTeachingLabel(p.section)===normalizeTeachingLabel(section)))
}
/** Elective sheets use a host classroom header; that header is not an enrollment restriction. */
export function teachingCourseScheduleMatches(course:Course,entry:Entry){
 const prefix='Principal course schedule · '
 if(entry.sourceDocument.startsWith(prefix))return entry.sourceDocument.slice(prefix.length)===course.id
 return teachingCourseClassMatches(course,entry.grade,entry.classGroup)||(multiClassCourse(course)&&electiveTimetableEntry(entry))
}
export function teachingRosterClass(course:Course,entry:Entry,fallback:string){
 return multiClassCourse(course)&&electiveTimetableEntry(entry)?'Multi-class':fallback
}
/** Reconstruct the learner scope without rewriting the historical room, class, timestamp or marks. */
export function recordedTeachingRosterClass(course:Course,session:{academicYear:string;semester:number;schoolDate:string;expectedStartAt:Date;expectedEndAt:Date;className:string},entries:Entry[]){
 if(!multiClassCourse(course))return session.className
 const teacher=[course.teacher.user.lastName,course.teacher.user.middleName,course.teacher.user.firstName].filter(Boolean).join(' ')
 const elective=entries.some(e=>e.academicYear===session.academicYear&&e.semester===session.semester&&electiveTimetableEntry(e)&&canonicalTeachingDay(e.day)===weekdayOfSchool(session.schoolDate)&&
  (e.teacherName||'').split('/').some(label=>teachingAliasMatches(label,teacher))&&e.subject.split('/').some(subject=>teachingSubjectScore(subject,course.name)>0)&&
  schoolInstant(session.schoolDate,e.startTime)>=session.expectedStartAt&&schoolInstant(session.schoolDate,e.endTime)<=session.expectedEndAt)
 return elective?'Multi-class':session.className
}
