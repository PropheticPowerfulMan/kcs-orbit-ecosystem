export const assessmentTypes = ['homework','quiz','test','project','exam','classwork','participation','observation','presentation','practical','exit-ticket','other'];
export const assessmentLabels = {
 homework:['Homework','Devoir'],quiz:['Quiz','Quiz'],test:['Test','Test'],project:['Project','Projet'],exam:['Exam','Examen'],classwork:['Classwork','Travail en classe'],participation:['Participation','Participation'],observation:['Observation','Observation'],presentation:['Presentation','Présentation'],practical:['Practical work','Travail pratique'],'exit-ticket':['Exit ticket','Ticket de sortie'],other:['Other','Autre']
};
const text=value=>typeof value==='string'?value:typeof value==='number'&&Number.isFinite(value)?String(value):'';
const names=['id','lessonNumber','planType','status','ownerId','ownerName','department','schoolName','schoolYear','semester','quarter','chapter','teachers','subject','gradeClass','date','week','weekStartDate','weekEndDate','term','duration','classroom','numberOfStudents','topic','subtopic','referenceBook','learningArea','biblicalIntegration','crossCurricularConnections'];
const lists=['learningObjectives','learningOutcomes','successCriteria','materialsResources','vocabulary','safetyConsiderations'];
export function migrateAssessmentDay(value={}) {
 const day={...value},legacy=text(day.homework).trim(),assessment=text(day.assessment);
 const selected=[...new Set((Array.isArray(day.assessmentTypes)?day.assessmentTypes:[]).filter(x=>assessmentTypes.includes(x)))];
 if(legacy&&!selected.includes('homework'))selected.push('homework');
 day.assessment=legacy&&!assessment.includes(legacy)?[assessment,'Homework: '+legacy].filter(Boolean).join('\n\n'):assessment;
 day.assessmentTypes=selected;day.homework='';
 return day;
}
export function lessonDocumentContent(input={}) {
 const out={};for(const key of names)out[key]=text(input[key]);
 for(const key of lists)out[key]=(Array.isArray(input[key])?input[key]:[]).map(item=>text(item?.value??item)).filter(Boolean);
 out.tags=(Array.isArray(input.tags)?input.tags:[]).map(text).filter(Boolean);
 out.weeklyPlan=(Array.isArray(input.weeklyPlan)?input.weeklyPlan:[]).slice(0,input.planType==='daily'?1:5).map((raw,index)=>{
  const day=migrateAssessmentDay(raw),result={day:text(day.day)||['Monday','Tuesday','Wednesday','Thursday','Friday'][index]};
  for(const key of ['lesson','objectives','introduction','presentation','guidedPractice','exitTicket','assessment'])result[key]=text(day[key]);
  result.assessmentTypes=day.assessmentTypes;result.activityDurations={};
  for(const key of ['introduction','presentation','guidedPractice','exitTicket']) {
   const n=day.activityDurations?.[key];if(typeof n==='number'&&Number.isFinite(n)&&n>=0)result.activityDurations[key]=n;
  }
  return result;
 });
 for(const [key,fields]of Object.entries({blooms:['remember','understand','apply','analyze','evaluate','create'],differentiation:['strugglingLearners','eslSupport','giftedLearners','specialNeeds','inclusiveStrategies'],assessment:['diagnostic','formative','summative','observationChecklist','rubric','exitTicket','teacherComments'],reflection:['whatWentWell','challenges','improvements','followUpActivities','teacherNotes']})){
  out[key]={};for(const field of fields){const value=input[key]?.[field];out[key][field]=Array.isArray(value)?value.map(text).filter(Boolean):text(value)}
 }
 out.stages=(Array.isArray(input.stages)?input.stages:[]).map(stage=>{
  const result={};for(const field of ['name','duration','teacherActivities','studentActivities','resources','notes'])result[field]=text(stage?.[field]);
  for(const field of ['attachments','images'])result[field]=(Array.isArray(stage?.[field])?stage[field]:[]).map(text);
  return result;
 });
 return out;
}
export const canonicalLessonJSON=lesson=>JSON.stringify(lessonDocumentContent(lesson));
export function documentSettings(value={},fallback={}) {
 const settings={...fallback,...value},orientation=settings.orientation||'landscape',fontSize=Number(settings.fontSize||11),layout=settings.layout||'grid',language=settings.language==='fr'?'fr':'en';
 if(!['landscape','portrait'].includes(orientation)||!['grid','details'].includes(layout)||!Number.isFinite(fontSize)||fontSize<9||fontSize>18)throw Object.assign(new Error('Invalid PDF page settings.'),{status:400});
 return {orientation,fontSize,layout,language};
}
