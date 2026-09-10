import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const YEAR = '2026-2027'
const SEMESTER = 1
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
const MW = ['Monday', 'Wednesday'] as const
const TT = ['Tuesday', 'Thursday'] as const
const MWF = ['Monday', 'Wednesday', 'Friday'] as const
const XLSX = '2026-2027 G6-G12 Schedule 1st Semester.xlsx'
const PDF = '1st semester SCHEDULE OF HS ELECTIVE CLASSES 2026-2027.pdf'
type Row = { grade:string; classGroup?:string; day:string; period:number; startTime:string; endTime:string; subject:string; teacherName?:string; room?:string; sourceDocument:string }
const rows: Row[] = []
const add = (grade:string, days:readonly string[], period:number, startTime:string, endTime:string, subject:string, teacherName:string|undefined, room:string|undefined, sourceDocument=XLSX, classGroup?:string) => {
  for (const day of days) rows.push({ grade, classGroup, day, period, startTime, endTime, subject, teacherName, room, sourceDocument })
}
const assembly = (grade:string, room?:string) => add(grade,DAYS,0,'08:00','08:30','Assembly',undefined,room)
const repeated = (grade:string, subject:string, teacher:string, room:string|undefined, periods:Array<[number,string,string]>) => periods.forEach(([p,s,e])=>add(grade,DAYS,p,s,e,subject,teacher,room))

assembly('Grade 6','Room 18')
repeated('Grade 6','English','Christian','Room 18',[[1,'08:30','09:15'],[2,'09:15','10:00']])
repeated('Grade 6','Science','Hellen','Room 18',[[4,'10:00','10:45'],[5,'10:45','11:30']])
add('Grade 6',MW,6,'11:30','12:15','Math','Hellen','Room 18'); add('Grade 6',TT,6,'11:30','12:15','Reading / Art','Chris / Nathan','Room 18'); add('Grade 6',['Friday'],6,'11:30','12:15','Math','Hellen','Room 18')
add('Grade 6',MW,8,'12:45','13:30','Bible','Hellen','Room 18'); add('Grade 6',['Tuesday'],8,'12:45','13:30','French','Jonathan','Room 18'); add('Grade 6',['Thursday'],8,'12:45','13:30','Physical Education','Jeremie','Room 18'); add('Grade 6',['Friday'],8,'12:45','13:30','Bible','Hellen','Room 18')
add('Grade 6',MW,9,'13:30','14:00','Health','Jeremie','Room 18'); add('Grade 6',TT,9,'13:30','14:00','Music','Christian','Room 18'); add('Grade 6',['Friday'],9,'13:30','14:00','French','Jonathan','Room 18')

assembly('Grade 7','Room 17')
repeated('Grade 7','Math','Hellen','Room 17',[[1,'08:30','09:15'],[2,'09:15','10:00']]); repeated('Grade 7','English','Christian','Room 17',[[4,'10:00','10:45'],[5,'10:45','11:30']])
add('Grade 7',MW,6,'11:30','12:15','Writing','Jeremie','Room 17'); add('Grade 7',TT,6,'11:30','12:15','Reading / Art','Jeremie / Nathan','Room 17'); add('Grade 7',['Friday'],6,'11:30','12:15','Reading','Jonathan','Room 17')
add('Grade 7',MW,8,'12:45','13:30','French','Jonathan','Room 17'); add('Grade 7',['Tuesday'],8,'12:45','13:30','Ethics','David','Room 17'); add('Grade 7',['Thursday'],8,'12:45','13:30','Physical Education','Jeremie','Room 17'); add('Grade 7',['Friday'],8,'12:45','13:30','Ethics','David','Room 17')
add('Grade 7',MW,9,'13:30','14:00','Music','Christian','Room 17'); add('Grade 7',['Tuesday'],9,'13:30','14:00','Bible','Hellen','Room 17'); add('Grade 7',['Friday'],9,'13:30','14:00','Bible','Hellen','Room 17')

assembly('Grade 8','Room 10')
repeated('Grade 8','English','Didier','Room 10',[[1,'08:30','09:15'],[2,'09:15','10:00']]); repeated('Grade 8','Science','William','Room 10',[[4,'10:00','10:45'],[5,'10:45','11:30']])
add('Grade 8',MW,6,'11:30','12:15','Math','William','Room 10'); add('Grade 8',TT,6,'11:30','12:15','Health','David','Room 10'); add('Grade 8',['Friday'],6,'11:30','12:15','French','Jeremie','Room 10')
add('Grade 8',MW,8,'12:45','13:30','Reading','Shalom','Room 10'); add('Grade 8',['Tuesday'],8,'12:45','13:30','French','Jeremie','Room 10'); add('Grade 8',['Thursday'],8,'12:45','13:30','Physical Education','Jeremie','Room 10'); add('Grade 8',['Friday'],8,'12:45','13:30','Math','William','Room 10')
add('Grade 8',MW,9,'13:30','14:00','Bible','David','Room 10'); add('Grade 8',['Tuesday'],9,'13:30','14:00','Bible','William','Room 10'); add('Grade 8',['Friday'],9,'13:30','14:00','Music','Christian','Room 10')

const highCore = [
 ['Grade 9','Mathematics / Science','William / David','English / History','David / Didier','Room 18'],
 ['Grade 10','English','Shalom','Math','Chris','Room 5'],
 ['Grade 11','Math','Jonathan','History','Jean','Room 11'],
 ['Grade 12','English','Jean','Math','Jonathan',undefined],
] as const
for (const [grade,s1,t1,s2,t2,room] of highCore) {
 assembly(grade,room); repeated(grade,s1,t1,room,[[1,'08:30','09:15'],[2,'09:15','10:00']]); repeated(grade,s2,t2,room,[[4,'10:00','10:45'],[5,'10:45','11:30']]); add(grade,['Friday'],8,'12:45','13:30','Physical Education','Jeremie',room); add(grade,['Friday'],9,'13:30','14:00','Physical Education','Jeremie',room)
}
const elective = (grade:string, group:string|undefined, days:readonly string[], period:number, start:string, end:string, subject:string, teacher:string) => add(grade,days,period,start,end,subject,teacher,grade+' classroom',PDF,group)
elective('Grade 10',undefined,MWF,6,'11:30','12:15','Creative Writing','Didier'); elective('Grade 12',undefined,MWF,6,'11:30','12:15','Computer Science','Chris'); elective('Grade 9','G9A',MWF,6,'11:30','12:15','Bible 1','Shalom'); elective('Grade 9','G9B',MWF,6,'11:30','12:15','Music','Christian'); elective('Grade 11',undefined,MWF,6,'11:30','12:15','Art Workshop','Nathan')
elective('Grade 12',undefined,TT,6,'11:30','12:15','Reading','William'); elective('Grade 9','G9B',TT,6,'11:30','12:15','Programming (O)','Jonathan'); elective('Grade 10',undefined,TT,6,'11:30','12:15','Business Law 1','Pekita'); elective('Grade 9','G9A',TT,6,'11:30','12:15','E SAT Prep','Jean'); elective('Grade 11',undefined,TT,6,'11:30','12:15','Health 1','Shalom')
elective('Grade 11',undefined,MWF,8,'12:45','13:30','Music','Christian'); elective('Grade 10',undefined,MWF,8,'12:45','13:30','Entrepreneurship in EE (O)','Pastor Jean'); elective('Grade 9','G9B',MWF,8,'12:45','13:30','African History','Didier'); elective('Grade 12',undefined,MWF,8,'12:45','13:30','Life Science','David-Joyce'); elective('Grade 9','G9A',MWF,8,'12:45','13:30','Career A','Chris')
elective('Grade 9','G9A',TT,8,'12:45','13:30','Health 2','William'); elective('Grade 9','G9B',TT,8,'12:45','13:30','Congo History 1','Jonathan'); elective('Grade 11',undefined,TT,8,'12:45','13:30','Entrepreneurship','Jean'); elective('Grade 10',undefined,TT,8,'12:45','13:30','French 1','Didier'); elective('Grade 12',undefined,TT,8,'12:45','13:30','Swahili','Shalom')
elective('Grade 9','G9B',MWF,9,'13:30','14:00','Cybersecurity (O)','Jonathan'); elective('Grade 9','G9A',MWF,9,'13:30','14:00','Bible 2','Didier'); elective('Grade 12',undefined,MWF,9,'13:30','14:00','Psychology A','Jean'); elective('Grade 11',undefined,MWF,9,'13:30','14:00','Psychology B','Shalom'); elective('Grade 10',undefined,MWF,9,'13:30','14:00','M SAT Prep','Chris')
elective('Grade 11',undefined,TT,9,'13:30','14:00','Health 3','William'); elective('Grade 9','G9B',TT,9,'13:30','14:00','Congo History 2','Jonathan'); elective('Grade 10',undefined,TT,9,'13:30','14:00','Bible 3','Shalom'); elective('Grade 12',undefined,TT,9,'13:30','14:00','French 2 A','Didier'); elective('Grade 9','G9A',TT,9,'13:30','14:00','French 2 B','Jean')

const slug = (value:string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const data = rows.map(row => ({ ...row, sourceKey: [YEAR,'s1',slug(row.grade),slug(row.classGroup||'all'),slug(row.day),String(row.period),slug(row.subject)].join(':') }))
const keys = data.map(row=>row.sourceKey)
await prisma.$transaction([
  prisma.academicScheduleEntry.updateMany({ where:{ academicYear:YEAR, semester:SEMESTER, sourceKey:{notIn:keys} }, data:{active:false} }),
  ...data.map(row=>prisma.academicScheduleEntry.upsert({where:{sourceKey:row.sourceKey},create:{...row,academicYear:YEAR,semester:SEMESTER,active:true},update:{...row,academicYear:YEAR,semester:SEMESTER,active:true}})),
])
const byGrade = await prisma.academicScheduleEntry.groupBy({by:['grade'],where:{academicYear:YEAR,semester:SEMESTER,active:true},_count:{_all:true}})
console.log(JSON.stringify({imported:data.length,byGrade},null,2))
await prisma.$disconnect()
