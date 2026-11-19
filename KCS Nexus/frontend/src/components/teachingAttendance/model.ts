export type LearnerStatus = 'PRESENT'|'LATE'|'ABSENT'|'EXCUSED'|'SICK'|'SUSPENDED'
export type ReviewStatus = 'PENDING'|'ACKNOWLEDGED'|'FOLLOW_UP'|'JUSTIFIED'
export type PresenceSummary = {recorded:number;present:number;late:number;absent:number;attendanceRate:number|null;presence95:[number,number]|null}
export type TeachingStats = {
 scheduled:number;due:number;recorded:number;unrecorded:number;awaiting:number;inClass:number;completed:number;missingExits:number;
 onTime:number;late:number;punctualityRate:number|null;recordedPresenceRate:number|null;
 meanLateMinutes:number|null;medianLateMinutes:number|null;p95LateMinutes:number|null;
 earlyExits:number;actualMinutes:number;punctuality95:[number,number]|null
}
export type CourseChoice={id:string;name:string;code:string;className:string;teacherUserId:string;teacherName:string;scheduleCount:number}
export type TeachingSession = {
 id:string|null;courseReference:string;scheduleKey:string;schoolDate:string;academicYear:string;semester:number;term:string;
 teacherUserId:string;courseName:string;courseCode:string;className:string;teacherName:string;room:string;
 expectedStartAt:string;expectedEndAt:string;checkInAt:string|null;checkOutAt:string|null;teacherNote:string|null;
 reviewStatus:ReviewStatus;reviewNote:string|null;reviewedAt:string|null;rosterRevision:number;rosterSize:number;
 studentSummary:PresenceSummary;source:string;
 timing:{status:'UPCOMING'|'AWAITING_ENTRY'|'UNRECORDED'|'IN_CLASS'|'MISSING_EXIT'|'COMPLETED';lateMinutes:number|null;earlyExitMinutes:number|null;actualMinutes:number|null;onTime:boolean|null}
}
export type ScheduleWarning={key:string;schoolDate:string;subject:string;teacherName:string;className:string;room:string;expectedStartAt:string;expectedEndAt:string;reason:'NO_COURSE'|'AMBIGUOUS'}
export type TeachingBoard = {
 scheduleWarnings?:ScheduleWarning[];classes?:string[];rooms?:string[];
 serverUtc:string;schoolTimezone:string;trackingSince:string;range:{from:string;to:string};summary:TeachingStats;
 calendars:Array<{name:string;startDate:string;endDate:string;isCurrent?:boolean}>;
 courses:CourseChoice[];sessions:TeachingSession[];
 learners:Array<PresenceSummary&{studentId:string;name:string;className:string;courseId:string;courseName:string}>;learnerSummary:PresenceSummary;
 teachers:Array<TeachingStats&{id:string;name:string}>;
 trend:Array<TeachingStats&{day:string}>
}
export type RosterLearner={studentId:string;name:string;studentNumber:string;className:string;status:LearnerStatus|null;note:string;eligible:boolean}
export type SessionRegister={session:TeachingSession;roster:RosterLearner[];summary:PresenceSummary}
export const statusLabels:Record<LearnerStatus,[string,string]>={
 PRESENT:['Présent','Present'],LATE:['En retard','Late'],ABSENT:['Absent','Absent'],
 EXCUSED:['Absence excusée','Excused absence'],SICK:['Malade','Sick'],SUSPENDED:['Suspendu','Suspended'],
}
export const sessionLabels:Record<TeachingSession['timing']['status'],[string,string]>={
 MISSING_EXIT:['Sortie non enregistrée','Checkout not recorded'],
 UPCOMING:['À venir','Upcoming'],AWAITING_ENTRY:['Entrée attendue','Awaiting entry'],
 UNRECORDED:['Présence non enregistrée','No presence recorded'],IN_CLASS:['En cours','In class'],COMPLETED:['Séance terminée','Session completed'],
}
export const reviewLabels:Record<ReviewStatus,[string,string]>={
 PENDING:['À examiner','Awaiting review'],ACKNOWLEDGED:['Vérifié','Acknowledged'],
 FOLLOW_UP:['Suivi demandé','Follow-up requested'],JUSTIFIED:['Justification acceptée','Justification accepted'],
}
const errors:Record<string,[string,string]>={
 TEACHING_SCHEDULE_INVALID:['Vérifiez les classes et l’ordre des heures de chaque créneau.','Check each time slot’s class and start/end order.'],
 TEACHING_SCHEDULE_OVERLAP:['Cet enseignant a déjà un cours sur une plage qui se chevauche. Aucun horaire n’a été modifié.','This teacher already has an overlapping class. No schedule was changed.'],
 TEACHING_CLOCK_UNAVAILABLE:['L’heure serveur est indisponible. Réessayez avant de pointer.','Server time is unavailable. Retry before checking in.'],
 TEACHING_INVALID_RANGE:['Choisissez une plage de dates valide de 366 jours au maximum.','Choose a valid date range of at most 366 days.'],
 TEACHING_CALENDAR_UNAVAILABLE:['Le calendrier officiel est momentanément indisponible. Aucune donnée n’a été modifiée.','The official calendar is temporarily unavailable. No data was changed.'],
 TEACHING_REGISTER_NOT_READY:['Le registre des séances est en cours de préparation.','The teaching register is being prepared.'],
 TEACHING_SESSION_NOT_SCHEDULED:['Cette séance n’est pas prévue dans l’horaire de ce cours. Vérifiez My Courses ou l’horaire officiel.','This session is not scheduled for this subject. Check My Courses or the official timetable.'],
 TEACHING_SESSION_NOT_FOUND:['Cette séance est introuvable. Actualisez le registre.','Session not found. Refresh the register.'],
 TEACHING_COURSE_NOT_OWNED:['Vous pouvez uniquement enregistrer vos propres cours.','You can only record your own courses.'],
 TEACHING_TODAY_ONLY:['Les pointages et les présences par séance s’enregistrent le jour même, selon l’heure de Kinshasa.','Session check-ins and learner attendance are recorded on the same school day, in Kinshasa time.'],
 TEACHING_ENTRY_WINDOW:['L’entrée peut être enregistrée de 30 minutes avant le cours jusqu’à sa fin prévue.','Check in from 30 minutes before the scheduled start until the scheduled end.'],
 TEACHING_OTHER_SESSION_OPEN:['Enregistrez d’abord la sortie du cours encore ouvert.','Check out of your open session first.'],
 TEACHING_ENTRY_REQUIRED:['Enregistrez d’abord votre entrée dans ce cours.','Check in to this session first.'],
 TEACHING_STUDENT_NOT_ENROLLED:['Un élève sélectionné n’est pas inscrit à ce cours. Actualisez la liste.','A selected learner is not enrolled in this course. Refresh the roster.'],
 TEACHING_DUPLICATE_STUDENT:['Un élève ne peut apparaître qu’une seule fois.','A learner can only appear once.'],
 TEACHING_REGISTER_CHANGED:['Une autre fenêtre a modifié ce registre. Rechargez les présences avant d’enregistrer.','Another window changed this register. Reload attendance before saving.'],
 TEACHING_ROSTER_CHANGED:['Les inscriptions ont changé. Rechargez les élèves avant d’enregistrer.','Enrollment changed. Reload the roster before saving.'],
 TEACHING_PRINCIPAL_REQUIRED:['Cet espace est réservé au Principal et au SuperAdmin.','This workspace is reserved for the Principal and SuperAdmin.'],
 TEACHING_INVALID_YEAR:['Choisissez une année du calendrier officiel.','Choose a published school year.'],
 TEACHING_SCHOOL_DAY_CLOSED:['Cette journée est fermée dans le calendrier scolaire officiel.','This day is closed in the official school calendar.'],
}
export function teachingError(error:unknown,fr:boolean) {
 const e=error as {response?:{data?:{message?:string}}}
 const raw=e.response?.data?.message||''
 const known=Object.keys(errors).find(code=>raw.includes(code))
 if(known)return errors[known][fr?0:1]
 if(raw.includes('CLOSED')||raw.includes('closed period'))return fr?'Cette période est protégée. Demandez une autorisation au SuperAdmin.':'This period is protected. Ask Super Administration for access.'
 return fr?'L’opération n’a pas abouti. Vos données enregistrées restent conservées. Réessayez.':'The operation did not complete. Previously saved data is preserved. Please retry.'
}
export const timeLabel=(value:string|null,fr:boolean)=>value?new Intl.DateTimeFormat(fr?'fr-FR':'en-GB',{timeZone:'Africa/Kinshasa',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)):'—'
export const percentage=(value:number|null|undefined)=>value==null?'—':value.toFixed(1)+'%'
