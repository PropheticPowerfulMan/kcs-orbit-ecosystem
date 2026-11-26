import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {lessonHash} from './lessonDocuments.mjs';
import {lessonDocumentContent,documentSettings,assessmentLabels} from './lessonDocument.mjs';
const asset=name=>fileURLToPath(new URL('./assets/'+name,import.meta.url));
const emblem=asset('kcs-emblem.jpg'),regular=readFileSync(asset('LiberationSans-Regular.ttf')),bold=readFileSync(asset('LiberationSans-Bold.ttf'));
const palette={ink:'#233747',muted:'#586979',line:'#c9d3d9',soft:'#eef0f5',accent:'#62558b',gold:'#b59a63',navy:'#172b40'};
export async function createLessonPdf(lesson,options={},appUrl='https://kinshasachristianschool.org/lesson-plan/') {
 const settings=documentSettings(options,lesson.printSettings),content=lessonDocumentContent(lesson),hash=lessonHash(lesson),link=new URL(appUrl.endsWith('/')?appUrl:appUrl+'/');link.hash='/verify/'+encodeURIComponent(content.id)+'?hash='+hash;
 const tr=(en,fr)=>settings.language==='fr'?fr:en,qr=QRCode.create(link.href,{errorCorrectionLevel:'M'});
 const doc=new PDFDocument({autoFirstPage:false,bufferPages:true,compress:true,info:{Title:(content.lessonNumber||'Lesson Plan')+' - '+(content.subject||'KCS'),Author:content.teachers||'Kinshasa Christian School',Subject:'KCS Eduplanner - saved lesson document',Keywords:'KCS, Eduplanner, '+hash}});
 doc.registerFont('KCS',regular);doc.registerFont('KCS-Bold',bold);
 const chunks=[];doc.on('data',chunk=>chunks.push(chunk));const completed=new Promise((resolve,reject)=>{doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});
 const left=38,right=38,f=settings.fontSize,lineHeight=f*1.22+2;
 let activeBold=false,activeSize=f;
 const width=()=>doc.page.width-left-right,bottom=()=>doc.page.height-140;
 function header(){
  const w=doc.page.width;
  doc.save().rect(0,0,w,76).fill(palette.navy).rect(0,0,w,5).fill(palette.gold);
  doc.circle(left+25,38,26).fill('#ffffff');doc.image(emblem,left+1,14,{fit:[48,48],align:'center'});
  doc.font('KCS-Bold').fontSize(12.5).fillColor('#ffffff').text('KINSHASA CHRISTIAN SCHOOL',left+64,20,{width:width()-64,lineBreak:false});
  doc.font('KCS').fontSize(7.8).fillColor('#d5dfeb').text('KCS ORBIT ECOSYSTEM  /  EDUPLANNER',left+64,39,{width:width()-64,lineBreak:false});
  doc.font('KCS-Bold').fontSize(7).fillColor('#e1c589').text(tr('ACADEMIC PLANNING  |  TEACHING & LEARNING','PLANIFICATION PÉDAGOGIQUE  |  ENSEIGNEMENT ET APPRENTISSAGE'),left+64,54,{width:width()-64,lineBreak:false});
  doc.moveTo(left,76).lineTo(w-right,76).lineWidth(1).strokeColor(palette.gold).stroke();doc.restore();
  doc.font(activeBold?'KCS-Bold':'KCS').fontSize(activeSize).fillColor(palette.ink);doc.x=left;doc.y=92;
 }
 doc.on('pageAdded',header);
 let pageCount=0;
 const newPage=()=>{if(++pageCount>120)throw Object.assign(new Error('This lesson exceeds 120 PDF pages. Split it into daily plans; no content has been deleted.'),{status:413});doc.addPage({size:'A4',layout:settings.orientation,margins:{top:89,bottom:140,left,right}})};
 const ensure=h=>{if(doc.y+h>bottom())newPage()};
 const font=(bold=false,size=f)=>{activeBold=bold;activeSize=size;return doc.font(bold?'KCS-Bold':'KCS').fontSize(size).fillColor(palette.ink)};
 function heading(title,minutes){
  ensure(40);const y=doc.y;doc.save().roundedRect(left,y,width(),24,4).fill(palette.soft);doc.rect(left,y,3,24).fill(palette.accent).restore();
  font(true,f).text(title,left+10,y+5,{width:width()-(typeof minutes==='number'?90:20),lineBreak:false});
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
  const dailyDate=content.planType==='daily'&&/^\d{4}-\d{2}-\d{2}$/.test(content.date)?new Date(content.date+'T12:00:00'):null;
  const names=[tr('Teaching sequence','Déroulement'),...days.map(day=>dailyDate&&!Number.isNaN(dailyDate.getTime())?new Intl.DateTimeFormat(settings.language==='fr'?'fr-FR':'en-GB',{weekday:'long',day:'numeric',month:'short'}).format(dailyDate):dayLabel(day.day))];
  function drawHeader(){
   ensure(45);const y=doc.y;let x=left;
   names.forEach((name,i)=>{doc.save().rect(x,y,columns[i],39).fillAndStroke(palette.accent,palette.line).restore();font(true,Math.min(f,11)).fillColor('#ffffff').text(name,x+5,y+7,{width:columns[i]-10,height:30,align:i?'center':'left'});x+=columns[i]});doc.x=left;doc.y=y+39;
  }
  drawHeader();
  for(const key of Object.keys(labels)){
   const queues=days.map(day=>{
    let value=day[key]||'';
    if(key==='assessment')value=[(day.assessmentTypes||[]).map(kind=>assessmentLabels[kind]?.[settings.language==='fr'?1:0]||kind).join(' / '),value].filter(Boolean).join('\n');
    return linesFor(value,cell-12);
   });
   const timings=days.map(day=>({day:dayLabel(day.day),minutes:day.activityDurations?.[key]})).filter(item=>typeof item.minutes==='number');
   const shared=timings.length===days.length&&timings.every(item=>item.minutes===timings[0].minutes);
   const timingText=shared?timings[0].minutes+' min':timings.map(item=>item.day.slice(0,3)+' · '+item.minutes+' min').join('\n');
   const labelLines=linesFor([labels[key],timingText].filter(Boolean).join('\n'),first-12,true);
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
 const metadata=meta.filter(([label,value])=>value||![tr('Tags','Étiquettes'),tr('Department / term','Département / période')].includes(label));
 const cardGap=10,metaColumns=settings.orientation==='landscape'?3:2,cardWidth=(width()-cardGap*(metaColumns-1))/metaColumns,metaFont=Math.min(f,11);
 for(let index=0;index<metadata.length;index+=metaColumns){
  const pair=metadata.slice(index,index+metaColumns);font(false,metaFont);
  const height=Math.max(...pair.map(([,value])=>doc.heightOfString(String(value||'-'),{width:cardWidth-20,lineGap:2})))+31;
  ensure(height+8);const y=doc.y;
  pair.forEach(([label,value],column)=>{
   const x=left+column*(cardWidth+cardGap);
   doc.save().roundedRect(x,y,cardWidth,height,5).fillAndStroke(palette.soft,palette.line).restore();
   font(true,7.2).fillColor(palette.accent).text(label.toUpperCase(),x+10,y+7,{width:cardWidth-20,lineBreak:false});
   font(false,metaFont).text(String(value||'-'),x+10,y+20,{width:cardWidth-20,lineGap:2});
  });doc.x=left;doc.y=y+height+8;
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
 for(const[key,label]of Object.entries(extraLabels)){
  const value=Array.isArray(content[key])?content[key].filter(Boolean).join('\n'):String(content[key]||'');if(!value.trim())continue;
  const labelWidth=Math.min(155,width()*.28);font();const valueHeight=doc.heightOfString(value,{width:width()-labelWidth-16,lineGap:2});
  if(valueHeight+22>bottom()-92){paragraph(tr(...label),value);continue}
  ensure(valueHeight+22);const y=doc.y;
  doc.save().roundedRect(left,y,width(),valueHeight+16,4).fillAndStroke(palette.soft,palette.line).restore();
  font(true,Math.min(f,10)).fillColor(palette.accent).text(tr(...label),left+8,y+8,{width:labelWidth-12});
  font().text(value,left+labelWidth,y+8,{width:width()-labelWidth-8,lineGap:2});doc.x=left;doc.y=y+valueHeight+22;
 }
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
  // Paint the emblem above opaque table cells so every printed page retains its watermark.
  const watermark=Math.min(290,width()*.62);
  doc.save().opacity(.055).image(emblem,w/2-watermark/2,h/2-watermark/2,{fit:[watermark,watermark],align:'center',valign:'center'}).restore();
  if(index===range.start+range.count-1){
   const signatureY=h-126;doc.save().moveTo(left,signatureY).lineTo(left+width()*.44,signatureY).moveTo(left+width()*.56,signatureY).lineTo(left+width(),signatureY).strokeColor(palette.line).stroke();
   doc.font('KCS').fontSize(7).fillColor(palette.muted).text(tr('Teacher signature / date','Signature de l’enseignant / date'),left,signatureY+6,{width:width()*.44,lineBreak:false}).text(tr('Academic leadership signature / date','Signature de la direction / date'),left+width()*.56,signatureY+6,{width:width()*.44,lineBreak:false});doc.restore();
  }
  doc.save().moveTo(left,h-99).lineTo(w-right,h-99).lineWidth(.6).strokeColor(palette.gold).stroke();
  doc.font('KCS-Bold').fontSize(7).fillColor(palette.accent).text('KINSHASA CHRISTIAN SCHOOL',left,h-89,{width:width()-90,lineBreak:false});
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
