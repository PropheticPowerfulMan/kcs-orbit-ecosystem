import type {Learner} from './model'
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
export const schoolGrades=['K3','K4','K5',...Array.from({length:12},(_,i)=>'Grade '+(i+1))]
function classParts(grade:string,section=''){
 const n=grade.match(/^(?:grade|g)\s*(\d{1,2})(?:\s*([a-z]))?$/i)
 return n?{grade:'Grade '+Number(n[1]),section:(section||n[2]||'').toUpperCase()}:{grade:grade.replace(/^k\s*/i,'K'),section:section.toUpperCase()}
}
export function disciplineClasses(students:Learner[]){
 const sections=students.flatMap(s=>{const c=classParts(s.grade,s.section);return c.section&&schoolGrades.includes(c.grade)?[c.grade+' '+c.section]:[]})
 return [...new Set([...schoolGrades,...sections])].sort((a,b)=>{
  const x=classParts(a),y=classParts(b),ix=schoolGrades.indexOf(x.grade),iy=schoolGrades.indexOf(y.grade)
  return ix-iy||x.section.localeCompare(y.section)
 })
}
export function learnerMatchesClass(student:Pick<Learner,'grade'|'section'>,selected:string){
 if(!selected)return true
 const a=classParts(student.grade,student.section),b=classParts(selected)
 return a.grade===b.grade&&(!b.section||a.section===b.section)
}
export function filterDisciplineLearners(students:Learner[],query:string,selected:string){
 const tokens=fold(query).split(/\s+/).filter(Boolean)
 return students.filter(s=>learnerMatchesClass(s,selected)&&tokens.every(t=>fold([s.name,s.grade,s.section,s.studentNumber].join(' ')).includes(t))).sort((a,b)=>a.name.localeCompare(b.name,['fr','en'],{sensitivity:'base',numeric:true}))
}
