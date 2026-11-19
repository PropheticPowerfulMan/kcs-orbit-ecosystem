import {normalizeTeachingLabel, teachingAliasMatches, uniquelyAssignedCourse} from './teachingAttendance.js'

const subject=(value:string)=>normalizeTeachingLabel(value
 .replace(/\s*\((?:o|optional|elective|optionnel)\)\s*$/i,'')
 .replace(/\s*[-·]?\s*grade\s*\d{1,2}(?:\s*[ab])?\s*$/i,''))
 .replace(/([a-z])(\d)/g,'$1 $2').replace(/(\d)([a-z])/g,'$1 $2')
const details=(value:string)=>{
 const label=subject(value),match=label.match(/^(.*?)(?:\s+(\d+))?(?:\s+[ab])?$/)!
 return {label,base:match[1].trim(),level:match[2]||''}
}
const compact=(value:string)=>value.replace(/ /g,'')
const aliases:Record<string,string>={
 kiswahili:'swahili',grammarandwriting:'writingandgrammar',englishlanguagearts:'writingandgrammar',
 totalhealth:'health',physicaleducation:'pe',maths:'math',mathematics:'math',
}
const equivalent=(value:string)=>aliases[compact(value)]||compact(value)
/** Prefer exact subject names. Generic timetable headings are used only when
 * subject + teacher + class + period identify one course. Different explicit
 * levels (Algebra 1/2, Health 2/3) must never be silently interchanged. */
export function teachingSubjectScore(official:string,course:string){
 const a=details(official),b=details(course)
 if(compact(a.label)===compact(b.label))return 4
 if(a.level&&b.level&&a.level!==b.level)return 0
 const x=equivalent(a.base),y=equivalent(b.base)
 if(x===y)return 3
 const family:Record<string,string[]>={
  math:['algebra','prealgebra','precalculus','calculus','geometry','fundamentalsofmath','generalmathematics','math'],
  science:['science','earthscience','physicalscience','lifescience','biology','chemistry','physics'],
  english:['english','writingandgrammar'],
  history:['history','americanhistory','africanhistory','worldhistory','congohistory'],
 }
 return family[x]?.includes(y)?2:0
}
export function resolveTeachingSubjects<T extends {id:string;name:string;code:string}>(
 entry:{subject:string;teacherName:string|null},courses:T[],name:(course:T)=>string,
){
 const subjects=entry.subject.split('/').map(value=>value.trim()).filter(Boolean)
 const teachers=(entry.teacherName||'').split('/').map(value=>value.trim()).filter(Boolean)
 const pairs=subjects.length===teachers.length?subjects.map((value,i)=>({subject:value,teacherName:teachers[i]})):
  teachers.map(value=>({subject:entry.subject,teacherName:value}))
 const owners:T[]=[],unresolved:Array<{subject:string;teacherName:string;reason:'NO_COURSE'|'AMBIGUOUS'}>=[]
 for(const pair of pairs){
  const ranked=courses.filter(course=>teachingAliasMatches(pair.teacherName,name(course)))
   .map(course=>({course,score:Math.max(teachingSubjectScore(pair.subject,course.name),teachingSubjectScore(pair.subject,course.code))}))
   .filter(row=>row.score>0)
  const top=Math.max(0,...ranked.map(row=>row.score))
  const owner=uniquelyAssignedCourse(ranked.filter(row=>row.score===top).map(row=>row.course))
  if(owner)owners.push(owner)
  else unresolved.push({...pair,reason:ranked.length?'AMBIGUOUS':'NO_COURSE'})
 }
 // A slash-separated source may assign different subjects to different teachers.
 // One teacher cannot receive two different subjects from the same source slot.
 return {owners:[...new Map(owners.map(owner=>[owner.id,owner])).values()],unresolved}
}
export function teachingClassParts(value:string){
 const label=normalizeTeachingLabel(value)
 const grade=label.match(/^(?:grade|g)\s*(\d{1,2})(?:\s*([ab]))?$/)
 if(grade)return {base:'Grade '+Number(grade[1]),section:grade[2]?.toUpperCase()||''}
 const kinder=label.match(/^k\s*([345])$/)
 return {base:kinder?'K'+kinder[1]:value.trim(),section:''}
}
export function teachingClassMatches(actual:string,selected?:string){
 if(!selected)return true
 const a=teachingClassParts(actual),b=teachingClassParts(selected)
 return normalizeTeachingLabel(a.base)===normalizeTeachingLabel(b.base)&&(!b.section||a.section===b.section)
}
/** All query terms must match; quoted phrases remain intact. Grade 1 does not
 * accidentally match Grade 11. Accents, punctuation and word order are ignored. */
export function teachingSearchMatches(fields:Array<string|null|undefined>,query?:string){
 if(!query?.trim())return true
 const haystack=' '+normalizeTeachingLabel(fields.filter(Boolean).join(' '))+' '
 const terms=query.match(/"[^"]+"|\S+/g)||[]
 return terms.every(term=>{
  const value=normalizeTeachingLabel(term.replace(/^"|"$/g,''))
  if(!value||haystack.includes(' '+value+' '))return true
  return !term.startsWith('"')&&!/[0-9]/.test(value)&&value.length>=2&&haystack.trim().split(' ').some(word=>word.startsWith(value))
 })
}
