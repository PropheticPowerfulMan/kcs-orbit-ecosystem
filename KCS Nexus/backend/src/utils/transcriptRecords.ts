import {aggregateReportCardResults} from '../services/annualReportCard.service.js'
type Course={id:string;code:string;name:string;credits:number;grade?:string}
type Grade={id:string;studentId:string;courseId:string;percentage:number;letterGrade:string;period:string;createdAt:Date;course:Course}
type Legacy={id:string;studentId:string;academicYear:string;gradeLevel:string;term:string;courseCode:string;courseName:string;credits:number;percentage:number;letterGrade:string;verificationStatus:string;sourceSchool:string;sourceDocument:string;updatedAt:Date}
export type TranscriptRow={id:string;studentId:string;gradeLevel:string;percentage:number;letterGrade:string;credits:number;qualityPoints:number;cycle:{academicYear:string;term:string;status:string};course:Course;source:string;sourceSchool?:string;sourceDocument?:string}
const level=(value:string|undefined)=>{const match=/^(?:grade\s*)?(9|10|11|12)(?:\s*[a-z])?$/i.exec((value||'').trim());return match?'Grade '+match[1]:null}
const term=(value:string)=>value.replace(/Trimester/gi,'Quarter').trim()
const points=(percentage:number)=>percentage>=90?4:percentage>=80?3:percentage>=70?2:percentage>=60?1:0
const periodOrder=(value:string)=>({'Semester 1 · Quarter 1':1,'Semester 1 · Quarter 2':2,'Semester 1':3,'Semester 2 · Quarter 3':4,'Semester 2 · Quarter 4':5,'Semester 2':6,'Annual final':7}[value]??8)
export function buildTranscriptRecords(input:{studentGrade:string;activeAcademicYear:string|null;grades:Grade[];legacy:Legacy[];gradeSnapshots?:Record<string,string>}){
 const legacy=input.legacy.filter(row=>row.verificationStatus==='VERIFIED'&&level(row.gradeLevel))
 const gradeByYear=new Map<string,Set<string>>()
 for(const row of legacy){const values=gradeByYear.get(row.academicYear)??new Set();values.add(level(row.gradeLevel)!);gradeByYear.set(row.academicYear,values)}
 const rows=new Map<string,{row:TranscriptRow;time:number;priority:number}>();let unclassifiedRecords=0
 const add=(row:TranscriptRow,time:number,priority:number)=>{const key=[row.cycle.academicYear,row.cycle.term,row.course.code.trim().toLowerCase()].join('::');const old=rows.get(key);if(!old||priority>old.priority||priority===old.priority&&time>old.time)rows.set(key,{row,time,priority})}
 for(const row of legacy){add({id:row.id,studentId:row.studentId,gradeLevel:level(row.gradeLevel)!,percentage:row.percentage,letterGrade:row.letterGrade,credits:row.credits,qualityPoints:points(row.percentage)*row.credits,cycle:{academicYear:row.academicYear,term:term(row.term),status:'VERIFIED_LEGACY'},course:{id:'legacy-'+row.id,code:row.courseCode,name:row.courseName,credits:row.credits},source:'QUICKSCHOOLS_VERIFIED',sourceSchool:row.sourceSchool,sourceDocument:row.sourceDocument},row.updatedAt.getTime(),0)}
 for(const row of input.grades){
  const[year,rawTerm,status]=row.period.split('::');if(status!=='APPROVED')continue
  const snapshot=input.gradeSnapshots?.[year+'::'+term(rawTerm)]
  // A current class transfer must not turn an elementary course result into high-school credit.
  if(!snapshot&&/^(?:K[345]|Kindergarten(?:\s*K?[345])?|Grade\s*[1-8])(?:\s*[a-z])?$/i.test((row.course.grade??'').trim()))continue
  const imported=gradeByYear.get(year);const knownYearGrade=imported?.size===1?[...imported][0]:null
  // Never project the learner's current class backwards into previous years.
  const authoritative=snapshot??(year===input.activeAcademicYear?input.studentGrade:knownYearGrade)
  const grade=authoritative?level(authoritative):level(row.course.grade)
  if(!grade){if(!/^(?:K[345]|Kindergarten|Grade\s*[1-8])(?:\s*[a-z])?$/i.test(String(authoritative??row.course.grade??'').trim()))unclassifiedRecords++;continue}
  add({id:row.id,studentId:row.studentId,gradeLevel:grade,percentage:row.percentage,letterGrade:row.letterGrade,credits:row.course.credits,qualityPoints:points(row.percentage)*row.course.credits,cycle:{academicYear:year,term:term(rawTerm),status},course:row.course,source:'NEXUS_APPROVED'},row.createdAt.getTime(),1)
 }
 const detailed=[...rows.values()].map(value=>value.row).sort((a,b)=>a.cycle.academicYear.localeCompare(b.cycle.academicYear)||periodOrder(a.cycle.term)-periodOrder(b.cycle.term)||a.course.code.localeCompare(b.course.code))
 const groups=new Map<string,TranscriptRow[]>()
 for(const row of detailed){const key=row.cycle.academicYear+'::'+row.course.code.trim().toLowerCase();groups.set(key,[...(groups.get(key)??[]),row])}
 let credits=0,qualityPoints=0,weightedTotal=0
 for(const group of groups.values()){
  const annual=group.find(row=>row.cycle.term==='Annual final')
  const source=group.map(row=>({studentId:row.studentId,courseId:group[0].course.code,percentage:row.percentage,period:row.cycle.academicYear+'::'+row.cycle.term+'::APPROVED'}))
  const aggregate=[...aggregateReportCardResults(source,group[0].cycle.academicYear,'Annual final').values()][0]
  // Use the same quarter / semester fallback rules as the official report card.
  const percentage=annual?.percentage??aggregate?.percentage??group.reduce((sum,row)=>sum+row.percentage,0)/group.length
  const credit=Math.max(0,annual?.credits??group[0].credits);credits+=credit;qualityPoints+=points(percentage)*credit;weightedTotal+=percentage*credit
 }
 const represented=new Set(detailed.map(row=>row.gradeLevel));const levels=['Grade 9','Grade 10','Grade 11','Grade 12']
 return{rows:detailed,summary:{credits,cumulativeGpa:credits?Number((qualityPoints/credits).toFixed(2)):null,cumulativeAverage:credits?Number((weightedTotal/credits).toFixed(2)):null,officialRecords:detailed.length,legacyRecords:detailed.filter(row=>row.source==='QUICKSCHOOLS_VERIFIED').length,representedCourses:groups.size,gradeCoverage:levels.map(gradeLevel=>({gradeLevel,records:detailed.filter(row=>row.gradeLevel===gradeLevel).length})),missingGradeLevels:levels.filter(grade=>!represented.has(grade)),unclassifiedRecords}}
}
