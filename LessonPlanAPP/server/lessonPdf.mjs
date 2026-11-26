import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {fileURLToPath} from 'node:url';
import {lessonHash} from './lessonDocuments.mjs';
import {lessonDocumentContent,documentSettings,assessmentLabels} from './lessonDocument.mjs';
const asset=name=>fileURLToPath(new URL('./assets/'+name,import.meta.url));
const palette={ink:'#233747',muted:'#586979',line:'#c9d3d9',soft:'#edf1ed',accent:'#62558b',gold:'#b59a63'};
export async function createLessonPdf(lesson,options={},appUrl='https://kinshasachristianschool.org/lesson-plan/') {
 const settings=documentSettings(options,lesson.printSettings),content=lessonDocumentContent(lesson),hash=lessonHash(lesson),link=new URL(appUrl.endsWith('/')?appUrl:appUrl+'/');link.hash='/verify/'+encodeURIComponent(content.id)+'?hash='+hash;
 const tr=(en,fr)=>settings.language==='fr'?fr:en,qr=QRCode.create(link.href,{errorCorrectionLevel:'M'});
 const doc=new PDFDocument({autoFirstPage:false,bufferPages:true,compress:true,info:{Title:(content.lessonNumber||'Lesson Plan')+' - '+(content.subject||'KCS'),Author:content.teachers||'Kinshasa Christian School',Subject:'KCS Eduplanner - saved lesson document',Keywords:'KCS, Eduplanner, '+hash}});
 doc.registerFont('KCS',asset('LiberationSans-Regular.ttf'));doc.registerFont('KCS-Bold',asset('LiberationSans-Bold.ttf'));
 const chunks=[];doc.on('data',chunk=>chunks.push(chunk));const completed=new Promise((resolve,reject)=>{doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});
 const left=38,right=38,f=settings.fontSize,lineHeight=f*1.22+2;
 let activeBold=false,activeSize=f;
 const width=()=>doc.page.width-left-right,bottom=()=>doc.page.height-140;
 function header(){
  const w=doc.page.width,h=doc.page.height;
  doc.save();doc.opacity(.035).image(asset('kcs-emblem.jpg'),w/2-115,h/2-115,{fit:[230,230],align:'center',valign:'center'}).restore();
  doc.save().rect(0,0,w,5).fill(palette.gold);doc.image(asset('kcs-emblem.jpg'),left,19,{fit:[43,43],align:'center'});
  doc.font('KCS-Bold').fontSize(12).fillColor(palette.ink).text('KINSHASA CHRISTIAN SCHOOL',left+55,23,{width:width()-55,lineBreak:false});
  doc.font('KCS').fontSize(8).fillColor(palette.muted).text('KCS ORBIT ECOSYSTEM  /  EDUPLANNER',left+55,42,{width:width()-55,lineBreak:false});
  doc.moveTo(left,73).lineTo(w-right,73).lineWidth(.7).strokeColor(palette.gold).stroke();doc.restore();doc.font(activeBold?'KCS-Bold':'KCS').fontSize(activeSize).fillColor(palette.ink);doc.x=left;doc.y=89;
 }
 doc.on('pageAdded',header);
 let pageCount=0;
 const newPage=()=>{if(++pageCount>120)throw Object.assign(new Error('This lesson exceeds 120 PDF pages. Split it into daily plans; no content has been deleted.'),{status:413});doc.addPage({size:'A4',layout:settings.orientation,margins:{top:89,bottom:140,left,right}})};
 const ensure=h=>{if(doc.y+h>bottom())newPage()};
 const font=(bold=false,size=f)=>{activeBold=bold;activeSize=size;return doc.font(bold?'KCS-Bold':'KCS').fontSize(size).fillColor(palette.ink)};
 function heading(title,minutes){
  ensure(40);const y=doc.y;doc.save().roundedRect(left,y,width(),24,4).fill(palette.soft);doc.rect(left,y,3,24).fill(palette.accent).restore();
  font(true,f).text(title,left+10,y+5,{width:width()-20,lineBreak:false});
  if(typeof minutes==='number')font(true,Math.min(f,11)).text(minutes+' min',left+width()-75,y+6,{width:65,align:'right',lineBreak:false});
  doc.x=left;doc.y=y+32;
 }
 function paragraph(label,value,minutes){
  const text=Array.isArray(value)?value.filter(Boolean).join('\n'):String(value||'');
  if(!text.trim())return;
  font();const contentHeight=doc.heightOfString(text,{width:width(),lineGap:2,paragraphGap:5}),blockHeight=contentHeight+42;
  if(blockHeight<=bottom()-89&&doc.y+blockHeight>bottom())newPage();
  heading(label,minutes);font().text(text,left,doc.y,{width:width(),lineGap:2,paragraphGap:5});doc.moveDown(.55);
 }
 const dayLabel=name=>settings.language==='fr'?({Monday:'Lundi',Tuesday:'Mardi',Wednesday:'Mercredi',Thursday:'Jeudi',Friday:'Vendredi'}[name]||name):name;
 const labels={lesson:tr('Lesson','Leçon'),objectives:tr('Objectives','Objectifs'),introduction:tr('Introduction','Introduction'),presentation:tr('Presentation','Présentation'),guidedPractice:tr('Guided practice','Pratique guidée'),exitTicket:tr('Exit ticket','Ticket de sortie'),assessment:tr('Assessment','Évaluation')};
 function linesFor(value,w,bold=false){
  const result=[];font(bold);
  for(const paragraph of String(value||'-').split('\n')){
   if(!paragraph){result.push('');continue}
   let line='';
   for(const word of paragraph.split(/\s+/)){
    if(doc.widthOfString(word)>w){
     if(line){result.push(line);line=''}
     let part='';for(const char of Array.from(word)){if(part&&doc.widthOfString(part+char)>w){result.push(part);part=''}part+=char}
     line=part;continue;
    }
    if(line&&doc.widthOfString(line+' '+word)>w){result.push(line);line=word}else line=line?line+' '+word:word;
   }
   result.push(line);
  }
  return result.length?result:['-'];
 }
 function weeklyTable(days){
  if(!days.length){paragraph(tr('Teaching sequence','Déroulement'),tr('No teaching sequence was provided.','Aucun déroulement n’a été renseigné.'));return}
  const first=Math.min(settings.orientation==='portrait'?145:115,width()*.28),cell=(width()-first)/days.length,columns=[first,...days.map(()=>cell)];
  const names=[tr('Teaching sequence','Déroulement'),...days.map(day=>dayLabel(day.day))];
  function drawHeader(){
   ensure(45);const y=doc.y;let x=left;
   names.forEach((name,i)=>{doc.save().rect(x,y,columns[i],39).fillAndStroke(palette.accent,palette.line).restore();font(true,Math.min(f,11)).fillColor('#ffffff').text(name,x+5,y+7,{width:columns[i]-10,height:30,align:i?'center':'left'});x+=columns[i]});doc.x=left;doc.y=y+39;
  }
  drawHeader();
  for(const key of Object.keys(labels)){
   const queues=days.map(day=>{
    let value=day[key]||'';
    if(key==='assessment')value=[(day.assessmentTypes||[]).map(kind=>assessmentLabels[kind]?.[settings.language==='fr'?1:0]||kind).join(' / '),value].filter(Boolean).join('\n');
    const duration=day.activityDurations?.[key];if(typeof duration==='number')value=duration+' min\n'+value;
    return linesFor(value,cell-12);
   });
   const labelLines=linesFor(labels[key],first-12,true);
   const fullRowHeight=Math.max(labelLines.length,...queues.map(q=>q.length))*lineHeight+12;
   if(fullRowHeight<=bottom()-89-39&&doc.y+fullRowHeight>bottom()){newPage();drawHeader()}
   do{
    if(bottom()-doc.y<lineHeight*Math.max(2,labelLines.length)+14){newPage();drawHeader()}
    const available=Math.max(1,Math.floor((bottom()-doc.y-14)/lineHeight)),needed=Math.max(labelLines.length,...queues.map(q=>q.length)),count=Math.min(needed,available),rowHeight=count*lineHeight+12,y=doc.y;
    const values=[labelLines,...queues.map(q=>q.splice(0,count))];
    let x=left;
    values.forEach((rows,i)=>{doc.save().rect(x,y,columns[i],rowHeight).fillAndStroke(i===0?palette.soft:'#ffffff',palette.line).restore();font(i===0);rows.forEach((line,index)=>doc.text(line,x+6,y+6+index*lineHeight,{lineBreak:false}));x+=columns[i]});
    doc.x=left;doc.y=y+rowHeight;
   }while(queues.some(q=>q.length));
  }
  doc.moveDown(.8);
 }
 newPage();
 font(true,f+7).text(content.planType==='daily'?tr('DAILY LESSON PLAN','PLAN DE LEÇON JOURNALIER'):tr('WEEKLY LESSON PLAN','PLAN DE LEÇON HEBDOMADAIRE'),left,doc.y,{width:width()});doc.moveDown(.3);
 font(true,f+2).fillColor(palette.accent).text(content.topic||content.chapter||content.subject||tr('Lesson plan','Plan de leçon'),{width:width()});doc.moveDown(.8);
 const meta=[
 [tr('Teacher','Enseignant'),content.teachers],[tr('Subject / class','Matière / classe'),[content.subject,content.gradeClass].filter(Boolean).join(' / ')],
 [tr('School year / period','Année scolaire / période'),[content.schoolYear,content.semester&&'Semester '+content.semester,content.quarter&&'Quarter '+content.quarter].filter(Boolean).join(' / ')],
 [tr('Date / week','Date / semaine'),content.planType==='daily'?content.date:[content.week&&tr('Week ','Semaine ')+content.week,content.weekStartDate,content.weekEndDate].filter(Boolean).join(' / ')],
 [tr('Reference / status','Référence / statut'),[content.lessonNumber,content.status].filter(Boolean).join(' / ')],
 [tr('Unit / duration','Unité / durée'),[content.chapter,content.duration].filter(Boolean).join(' / ')],
 [tr('Department / term','Département / période'),[content.department,content.term].filter(Boolean).join(' / ')],
 [tr('Tags','Étiquettes'),content.tags.join(', ')]
 ];
 for(const[label,value]of meta){
  if(!value&&[tr('Tags','Étiquettes'),tr('Department / term','Département / période')].includes(label))continue;
  ensure(lineHeight+8);const y=doc.y;font(true,Math.min(f,11)).fillColor(palette.muted).text(label,left,y,{width:145});font(false,Math.min(f,11)).text(value||'-',left+155,y,{width:width()-155});doc.x=left;doc.y=Math.max(doc.y,y+lineHeight)+5;
 }
 doc.moveDown(.5);
 if(settings.layout==='grid'){
  const daysPerTable=settings.orientation==='portrait'?(f>13?1:2):(f>14?3:5);
  for(let offset=0;offset<content.weeklyPlan.length;offset+=daysPerTable){if(offset) newPage();weeklyTable(content.weeklyPlan.slice(offset,offset+daysPerTable))}
 }
 else for(const day of content.weeklyPlan){
  heading(dayLabel(day.day));
  for(const key of Object.keys(labels)){
   const value=key==='assessment'?[(day.assessmentTypes||[]).map(kind=>assessmentLabels[kind]?.[settings.language==='fr'?1:0]||kind).join(' / '),day.assessment].filter(Boolean).join('\n'):day[key];
   paragraph(labels[key],value,day.activityDurations?.[key]);
  }
 }
 const extraLabels={learningObjectives:['Learning objectives','Objectifs d’apprentissage'],learningOutcomes:['Learning outcomes','Résultats attendus'],successCriteria:['Success criteria','Critères de réussite'],materialsResources:['Materials and resources','Matériel et ressources'],vocabulary:['Vocabulary','Vocabulaire'],safetyConsiderations:['Safety','Sécurité'],referenceBook:['Reference book','Livre de référence'],subtopic:['Subtopic','Sous-thème'],learningArea:['Learning area','Domaine d’apprentissage'],biblicalIntegration:['Biblical integration','Intégration biblique'],crossCurricularConnections:['Cross-curricular links','Liens interdisciplinaires'],classroom:['Classroom','Salle'],numberOfStudents:['Number of learners','Nombre d’élèves']};
 for(const[key,label]of Object.entries(extraLabels))paragraph(tr(...label),content[key]);
 const groups={blooms:['Bloom questions','Questions de Bloom'],differentiation:['Differentiation','Différenciation'],assessment:['Assessment notes','Notes d’évaluation'],reflection:['Reflection','Réflexion']};
 for(const[key,label]of Object.entries(groups)){
  const fields=Object.entries(content[key]||{}).filter(([,value])=>Array.isArray(value)?value.some(Boolean):Boolean(value));
  if(fields.length)paragraph(tr(...label),fields.map(([name,value])=>name.replace(/([A-Z])/g,' $1')+': '+(Array.isArray(value)?value.join('; '):value)).join('\n\n'));
 }
 for(const stage of content.stages){
  const parts=[stage.teacherActivities,stage.studentActivities,stage.resources,stage.notes,...stage.attachments,...stage.images].filter(Boolean);
  if(parts.length)paragraph(stage.name||tr('Additional stage','Étape complémentaire'),parts.join('\n'));
 }
 const range=doc.bufferedPageRange();
 for(let index=range.start;index<range.start+range.count;index++){
  doc.switchToPage(index);const page=doc.page,margin=page.margins.bottom;page.margins.bottom=0;const w=page.width,h=page.height;
  if(index===range.start+range.count-1){
   const signatureY=h-126;doc.save().moveTo(left,signatureY).lineTo(left+width()*.44,signatureY).moveTo(left+width()*.56,signatureY).lineTo(left+width(),signatureY).strokeColor(palette.line).stroke();
   doc.font('KCS').fontSize(7).fillColor(palette.muted).text(tr('Teacher signature / date','Signature de l’enseignant / date'),left,signatureY+6,{width:width()*.44,lineBreak:false}).text(tr('Academic leadership signature / date','Signature de la direction / date'),left+width()*.56,signatureY+6,{width:width()*.44,lineBreak:false});doc.restore();
  }
  doc.save().moveTo(left,h-99).lineTo(w-right,h-99).lineWidth(.6).strokeColor(palette.gold).stroke();
  doc.font('KCS-Bold').fontSize(7).fillColor(palette.ink).text('KINSHASA CHRISTIAN SCHOOL',left,h-89,{width:width()-90,lineBreak:false});
  doc.font('KCS').fontSize(6.6).fillColor(palette.muted).text('Macampagne, Ngaliema - Kinshasa, DRC  |  +243 895 326 011',left,h-76,{width:width()-85,lineBreak:false}).text('kinshasachristianschool@gmail.com  |  www.kinshasachristianschool.org',left,h-64,{width:width()-85,lineBreak:false}).text('SHA-256 '+hash.slice(0,24)+'  |  '+tr('Page ','Page ')+(index+1)+' / '+range.count,left,h-51,{width:width()-85,lineBreak:false});
  const size=72,x=w-right-size,y=h-91,quiet=4,modules=qr.modules.size,unit=size/(modules+quiet*2);
  doc.rect(x,y,size,size).fill('#ffffff');doc.fillColor('#132b3b');
  for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.modules.get(row,col))doc.rect(x+(col+quiet)*unit,y+(row+quiet)*unit,unit,unit);
  doc.fill();doc.link(x,y,size,size,link.href);doc.font('KCS').fontSize(5).fillColor(palette.muted).text(tr('Verify - school access','Vérifier - accès école'),x-6,h-13,{width:size+12,align:'center',lineBreak:false});doc.restore();page.margins.bottom=margin;
 }
 doc.end();const bytes=await completed;
 const filename=['LP',content.gradeClass,content.schoolYear,content.lessonNumber,content.subject].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g,' ').slice(0,180)+'.pdf';
 return {bytes,hash,verificationUrl:link.href,filename,pageCount:range.count};
}
