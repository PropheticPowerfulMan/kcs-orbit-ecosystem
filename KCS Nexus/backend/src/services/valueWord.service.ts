import {createHash} from 'node:crypto'
import {Prisma,type ValueWordAssignment} from '@prisma/client'
import {prisma} from '../config/prisma.js'
import {academicCalendars} from './reportAttendance.service.js'
import {nonSchoolSettings} from './attendanceCalendarSettings.service.js'
import {schoolDayDecision} from '../utils/schoolDayPolicy.js'
import {currentValueWordReminder,shiftValueWordDate,valueWordDate,valueWordRotation,valueWordTime,valueWordSlots,valueWordAudienceForGrade,valueWordAudienceLabel,valueWordRecipientMatches} from '../utils/valueWord.js'

export const valueWordName=(u:{lastName:string;middleName?:string|null;firstName:string})=>[u.lastName,u.middleName,u.firstName].filter(Boolean).join(' ')
export async function valueWordSettings(){return prisma.valueWordSettings.upsert({where:{id:'main'},create:{id:'main'},update:{}})}
export async function valueWordPeople(){
 const rows=await prisma.user.findMany({where:{accountBlockedAt:null,OR:[{role:'TEACHER'},{role:'STAFF'},{teacherProfile:{isNot:null}}]},select:{id:true,firstName:true,middleName:true,lastName:true,email:true,role:true,permissions:true,teacherProfile:{select:{id:true,homeroomGrade:true,courses:{select:{grade:true}}}}},orderBy:[{lastName:'asc'},{firstName:'asc'}]})
 return rows.filter(u=>!u.permissions.includes('nexus:media-only')).map(u=>({id:u.id,name:valueWordName(u),email:u.email,group:u.role==='TEACHER'||u.teacherProfile?'TEACHER' as const:'STAFF' as const,audiences:[...new Set(['GENERAL',...[u.teacherProfile?.homeroomGrade,...(u.teacherProfile?.courses||[]).map(c=>c.grade)].map(valueWordAudienceForGrade).filter((g):g is 'LOWER'|'UPPER'=>g!==null)])]}))
}
export async function valueWordSchoolDays(){
 const calendars=await academicCalendars();if(!calendars.length)throw new Error('Published school calendar unavailable');const ranges=(await Promise.all(calendars.map(c=>nonSchoolSettings(c.name)))).flatMap(c=>c.ranges)
 return{calendars,ranges,decision:(day:string)=>schoolDayDecision(day,calendars,ranges)}
}
export async function generateValueWordProgramme(now=new Date()){
 const [calendar,people]=await Promise.all([valueWordSchoolDays(),valueWordPeople()]),today=valueWordDate(now),days:string[]=[]
 for(let i=7;i<=42;i++){const day=shiftValueWordDate(today,i);if(calendar.decision(day).allowed)days.push(day)}
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(482938111)`
  const settings=await tx.valueWordSettings.upsert({where:{id:'main'},create:{id:'main'},update:{}})
  if(!settings.enabled)return{created:0,paused:true}
  const pool=people.filter(p=>!settings.excludedIds.includes(p.id))
  if(!pool.length)return{created:0,paused:false,emptyPool:true}
  const existing=await tx.valueWordAssignment.findMany({orderBy:{schoolDate:'asc'}}),occupied=new Set(existing.map(e=>e.academicYear+':'+e.schoolDate+':'+e.audienceKey)),history=[...existing],unfilled:Array<{day:string;audience:string}>=[]
  let created=0
  for(const day of days){const year=calendar.decision(day).academicYear;if(!year)continue;const slots=valueWordSlots(day).filter(group=>!occupied.has(year+':'+day+':'+group)),booked=new Set(history.filter(e=>e.schoolDate===day&&e.status!=='CANCELLED').map(e=>e.speakerReference))
   for(const group of slots){let available=pool.filter(p=>!booked.has(p.id)&&(group==='GENERAL'||p.group==='TEACHER'&&p.audiences.includes(group)))
    // Keep the only possible speaker for the other simultaneous assembly whenever an alternative exists.
    const remaining=slots.slice(slots.indexOf(group)+1);if(available.length>1){const reserve=new Set(remaining.flatMap(next=>{const options=pool.filter(p=>!booked.has(p.id)&&p.group==='TEACHER'&&p.audiences.includes(next));return options.length===1?[options[0].id]:[]}));const flexible=available.filter(p=>!reserve.has(p.id));if(flexible.length)available=flexible}
    const rotation=valueWordRotation([day],available,history,group==='GENERAL'?settings.staffWeekday:0)[0]
    if(!rotation){unfilled.push({day,audience:group});continue}
    const person=rotation.person,location=group==='LOWER'?settings.lowerLocation:group==='UPPER'?settings.upperLocation:settings.location
    const row=await tx.valueWordAssignment.create({data:{academicYear:year,audienceKey:group,schoolDate:day,startsAt:valueWordTime(day,settings.startTime),endsAt:valueWordTime(day,settings.endTime),location,speakerReference:person.id,speakerId:person.id,speakerName:person.name,speakerGroup:person.group}});history.push(row);booked.add(person.id);created++
   }
  }
  return{created,paused:false,unfilled}

 },{timeout:20000})
}
const noticeId=(a:ValueWordAssignment,kind:string,userId:string)=>'value-word:'+createHash('sha256').update([a.id,a.notificationRevision,kind,userId].join(':')).digest('hex')
const programmeLink=(u:{role:string;permissions:string[]})=>u.permissions.includes('nexus:media-only')?'/portal/media/value-word':u.role==='ADMIN'?'/admin/value-word':'/portal/'+u.role.toLowerCase()+'/value-word'
export function valueWordMessage(a:ValueWordAssignment,kind:string){
 const whenFr=new Intl.DateTimeFormat('fr-FR',{timeZone:'Africa/Kinshasa',dateStyle:'full',timeStyle:'short'}).format(a.startsAt),whenEn=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Kinshasa',dateStyle:'full',timeStyle:'short'}).format(a.startsAt)
 const end=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Kinshasa',hour:'2-digit',minute:'2-digit',hour12:false}).format(a.endsAt)
 const reminder=kind.startsWith('REMINDER_'),cancelled=a.status==='CANCELLED'
 const title=cancelled?'Value Word · Assemblée annulée / Assembly cancelled':kind==='CHANGED'?'Value Word · Programme modifié / Programme updated':reminder?'Value Word · Votre tour approche / Your turn is approaching':'Value Word · Programme de l’assemblée / Assembly programme'
 const body=`${reminder?'Vous êtes prévu(e) pour partager la Parole de Dieu. / You are scheduled to share the Word of God.\n\n':''}${cancelled?'ANNULÉ / CANCELLED\n':''}${valueWordAudienceLabel(a.audienceKey,'fr')} / ${valueWordAudienceLabel(a.audienceKey,'en')}\n${a.speakerName}\n${whenFr} – ${end} · ${a.location}\n${whenEn} – ${end} · Africa/Kinshasa\n${a.topic?'Thème / Topic: '+a.topic+'\n':''}${a.scripture?'Référence biblique / Scripture: '+a.scripture+'\n':''}${cancelled?(a.cancellationReason||''):'Consultez le programme dans Nexus. / View the programme in Nexus.'}`
 return{title,body}
}
async function dispatchValueWord(id:string,kind:string,now:Date){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "ValueWordAssignment" WHERE id=${id} FOR UPDATE`
  const a=await tx.valueWordAssignment.findUnique({where:{id}});if(!a)return 0
  const reminder=kind.startsWith('REMINDER_')
  if(kind!=='CHANGED'&&(a.status!=='PUBLISHED'||a.startsAt<=now))return 0
  if(reminder&&kind!=='REMINDER_'+currentValueWordReminder(a.startsAt,now))return 0
  const users=await tx.user.findMany({where:{accountBlockedAt:null,...(reminder?{id:a.speakerId||'__unavailable__'}:{})},select:{id:true,role:true,permissions:true,firstName:true,middleName:true,lastName:true,email:true,studentProfile:{select:{grade:true}},parentLinks:{select:{student:{select:{grade:true}}}},teacherProfile:{select:{homeroomGrade:true,courses:{select:{grade:true}}}}}})
  const message=valueWordMessage(a,kind)
  // Both rows use the same deterministic key. Restart and concurrent workers cannot duplicate a notice.
  const deliveries=await tx.valueWordDelivery.findMany({where:{assignmentId:id,revision:a.notificationRevision,kind},select:{recipientReference:true,emailLogReference:true}}),done=new Set(deliveries.map(d=>d.recipientReference))
  const pending=users.filter(u=>(reminder||valueWordRecipientMatches(a.audienceKey,u))&&!done.has(u.id))
  if(pending.length){await tx.notification.createMany({skipDuplicates:true,data:pending.map(u=>({id:noticeId(a,kind,u.id),userId:u.id,title:message.title,message:message.body,type:'INFO' as const,link:programmeLink(u)}))});await tx.valueWordDelivery.createMany({skipDuplicates:true,data:pending.map(u=>({assignmentId:a.id,revision:a.notificationRevision,kind,recipientReference:u.id,inAppSentAt:now}))})}
  if(reminder&&users[0]){const u=users[0],delivery=await tx.valueWordDelivery.findUniqueOrThrow({where:{assignmentId_revision_kind_recipientReference:{assignmentId:a.id,revision:a.notificationRevision,kind,recipientReference:u.id}}});if(!delivery.emailLogReference){if(u.email?.trim()){
   const mail=await tx.correspondenceLog.create({data:{channel:'EMAIL',status:'QUEUED',subject:message.title,body:message.body,recipientName:valueWordName(u),recipientEmail:u.email.trim(),metadata:{mailQueueVersion:1,recipientId:u.id,valueWordAssignmentId:a.id,valueWordRevision:a.notificationRevision,valueWordKind:kind,attempts:0,nextAttemptAt:now.toISOString(),priority:'NORMAL'}}});await tx.valueWordDelivery.update({where:{id:delivery.id},data:{emailLogReference:mail.id,emailFailure:null}})
  }else if(!delivery.emailFailure)await tx.valueWordDelivery.update({where:{id:delivery.id},data:{emailFailure:'RECIPIENT_EMAIL_MISSING'}})}}
  return pending.length
 },{timeout:20000})
}
/** Cancel pending reminders when a future assignment changes; sent messages remain in the audit trail. */
export async function invalidateValueWordMail(tx:Prisma.TransactionClient,id:string){
 const deliveries=await tx.valueWordDelivery.findMany({where:{assignmentId:id,emailLogReference:{not:null}},select:{emailLogReference:true}})
 await tx.correspondenceLog.updateMany({where:{id:{in:deliveries.flatMap(d=>d.emailLogReference?[d.emailLogReference]:[])},status:'QUEUED'},data:{status:'FAILED',failureReason:'VALUE_WORD_ASSIGNMENT_CHANGED'}})
}
export async function processValueWordNotifications(now=new Date()){
 const [calendar,people]=await Promise.all([valueWordSchoolDays(),valueWordPeople()]),eligible=new Set(people.map(p=>p.id))
 const future=await prisma.valueWordAssignment.findMany({where:{status:{in:['PUBLISHED','CANCELLED']},startsAt:{gt:now}},orderBy:{startsAt:'asc'}})
 let notices=0
 for(const a of future){if(a.status==='CANCELLED'){if(a.notificationRevision>1)notices+=await dispatchValueWord(a.id,'CHANGED',now);continue}const invalid=!calendar.decision(a.schoolDate).allowed||!valueWordSlots(a.schoolDate).includes(a.audienceKey as 'GENERAL'|'LOWER'|'UPPER')||!eligible.has(a.speakerReference)
  if(invalid){await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "ValueWordAssignment" WHERE id=${a.id} FOR UPDATE`;const current=await tx.valueWordAssignment.findUnique({where:{id:a.id}});if(!current||current.version!==a.version||current.status!=='PUBLISHED')return;await invalidateValueWordMail(tx,a.id);await tx.valueWordAssignment.update({where:{id:a.id},data:{status:'CANCELLED',cancellationReason:'Calendar or speaker availability changed / Calendrier ou disponibilité de l’intervenant modifiés',version:{increment:1},notificationRevision:{increment:1}}})});notices+=await dispatchValueWord(a.id,'CHANGED',now);continue}
  const phase=currentValueWordReminder(a.startsAt,now)
  if(phase!==null){notices+=await dispatchValueWord(a.id,'COMMUNITY',now);notices+=await dispatchValueWord(a.id,'REMINDER_'+phase,now)}
  if(a.notificationRevision>1)notices+=await dispatchValueWord(a.id,'CHANGED',now)
 }
 return{notices}
}
let processing=false
export async function processValueWord(now=new Date()){if(processing)return{skipped:true};processing=true;try{const plan=await generateValueWordProgramme(now),delivery=await processValueWordNotifications(now);return{...plan,...delivery}}finally{processing=false}}
export function startValueWordWorker(){if(process.env.VALUE_WORD_WORKER_ENABLED==='false')return;const run=()=>void processValueWord().catch(e=>console.error('[value-word] Worker failed',e instanceof Error?e.name:'UnknownError'));const initial=setTimeout(run,25000);initial.unref();const timer=setInterval(run,5*60000);timer.unref();console.log('[value-word] Persistent calendar rotation and reminders started')}
