import {useId,type ReactNode} from 'react'
import {BookOpen,CheckCircle2,GraduationCap,Mail,Pencil,ShieldCheck,Trash2,Users,X} from 'lucide-react'
import RegistryRecordBanner from './RegistryRecordBanner'
import {useUIStore} from '@/store/uiStore'
import './registryProfileView.css'
type Names={firstName?:string|null;middleName?:string|null;lastName?:string|null}
type Contact=Names&{kind:string;relationship?:string;role?:string;email?:string;phone?:string;physicalAddress?:string;authorizedPickup?:boolean;emergencyContact?:boolean}
type Learner=Names&{id:string;name:string;studentNumber?:string;email?:string;grade:string;section:string;status:string;dateOfBirth?:string|null;photoData?:string|null;parent?:string;parentEmail?:string;parentPhone?:string;advisor?:string;discipline?:string;gpa?:number|null;attendance?:number|null;familyContacts?:Contact[];responsibleParents?:Array<{id:string;name:string;email:string;phone:string;relationship:string}>;isEditable?:boolean;isDeletable?:boolean}
type Parent=Names&{id:string;displayId?:string;name:string;email:string;additionalEmails?:string[];phone:string;physicalAddress:string;status:string;photoData?:string|null;familyContacts:Contact[]}
type Actions={onClose:()=>void;onEdit:()=>void;onDelete:()=>void}
function useCopy(){const language=useUIStore(s=>s.language);return {language,tr:(fr:string,en:string)=>language==='fr'?fr:en}}
const statusLabel=(value:string,tr:(fr:string,en:string)=>string)=>{
 const key=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 const labels:Record<string,[string,string]>={active:['Actif','Active'],actif:['Actif','Active'],inactive:['Inactif','Inactive'],archived:['Archivé','Archived'],suspended:['Suspendu','Suspended'],dismissed:['Renvoyé','Dismissed'],'suivi requis':['Suivi requis','Follow-up required'],'sans enfant rattache':['Sans enfant rattaché','No linked learner']}
 return labels[key]?tr(...labels[key]):value
}
const present=(value:unknown)=>String(value??'').trim()
function Fields({rows}:{rows:Array<[string,unknown]>}){
 const {tr}=useCopy()
 return <dl className="registry-view-fields">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{present(value)||<span className="registry-view-empty">{tr('Non renseigné','Not provided')}</span>}</dd></div>)}</dl>
}
function Card({title,icon:Icon,children,section}:{title:string;icon:typeof Users;children:ReactNode;section?:string}){
 return <section className="registry-view-card" data-profile-section={section}><h3><Icon size={18}/>{title}</h3>{children}</section>
}
function Contacts({contacts}:{contacts:Contact[]}){
 const {tr}=useCopy()
 const kinds=[['MOTHER',tr('Mère de l’élève','Learner’s mother')],['RELATIVE',tr('Membre de la famille','Family member')],['HOUSEHOLD_AGENT',tr('Agent de la famille','Household agent')]]
 const knownKinds=new Set(kinds.map(([kind])=>kind))
 const entries=kinds.flatMap(([kind,label])=>{const rows=contacts.filter(c=>c.kind===kind);return rows.length?rows.map(c=>({contact:c,label})): [{contact:{kind} as Contact,label}]})
 entries.push(...contacts.filter(c=>!knownKinds.has(c.kind)).map(contact=>({contact,label:tr('Autre contact familial','Other family contact')})))
 const yesNo=(v:boolean|undefined)=>v===undefined?'':v?tr('Oui','Yes'):tr('Non','No')
 return <div className="registry-view-contacts">{entries.map(({contact:c,label},i)=><article key={c.kind+i}><h4>{label}</h4><Fields rows={[
 [tr('Nom','Last name'),c.lastName],[tr('Postnom','Middle name'),c.middleName],[tr('Prénom','First name'),c.firstName],
 [tr('Parenté','Relationship'),c.relationship],[tr('Fonction','Role'),c.role],['E-mail',c.email],[tr('Téléphone','Phone'),c.phone],[tr('Adresse physique','Home address'),c.physicalAddress],
 [tr('Autorisé à récupérer l’élève','Authorized pickup'),yesNo(c.authorizedPickup)],[tr('Contact d’urgence','Emergency contact'),yesNo(c.emergencyContact)]
 ]}/></article>)}</div>
}
function Frame({kind,name,photo,detail,badge,actions,canEdit=true,canDelete=true,children}:{kind:'parent'|'student';name:string;photo?:string|null;detail?:string;badge?:string;actions:Actions;canEdit?:boolean;canDelete?:boolean;children:ReactNode}){
 const {tr}=useCopy(),id=useId(),sections=kind==='parent'?[['identity',tr('Identité et coordonnées','Identity and contact')],['contacts',tr('Contacts familiaux','Family contacts')],['learners',tr('Enfants liés','Linked learners')]]:[['identity',tr('Identité et scolarité','Identity and schooling')],['family',tr('Parents responsables','Responsible guardians')],['contacts',tr('Contacts familiaux','Family contacts')],['followup',tr('Suivi scolaire','School follow-up')]]
 return <div translate="no" className="registry-view-overlay" data-entity-dialog={kind+'-view'} role="dialog" aria-modal="true" aria-labelledby={id}>
 <section className="registry-dialog-window registry-view-window"><div className="registry-dialog-heading registry-view-heading"><div><span className="registry-view-eyebrow"><ShieldCheck size={14}/>{tr('Registre officiel · consultation','Official registry · read only')}</span><h2 id={id}>{kind==='parent'?tr('Dossier parent','Parent profile'):tr('Dossier de l’élève','Learner profile')}</h2><p>{tr('Les informations du dossier, réunies dans une vue complète.','The complete record, organized in one clear view.')}</p></div><button type="button" className="registry-view-close" aria-label={tr('Fermer','Close')} onClick={actions.onClose}><X size={18}/>{tr('Fermer','Close')}</button></div>
 <nav className="registry-view-nav" aria-label={tr('Sections du dossier','Record sections')}>{sections.map(([key,label])=><button key={key} type="button" onClick={e=>e.currentTarget.closest('[data-entity-dialog]')?.querySelector('[data-profile-section="'+key+'"]')?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}>{label}</button>)}</nav>
 <div className="registry-dialog-body registry-view-body"><RegistryRecordBanner kind={kind} mode="view" name={name} photo={photo} detail={detail} badge={badge}/>{children}</div>
 <div className="registry-view-actions"><span><ShieldCheck size={15}/>{tr('Consultation sans modification','Viewing does not change the record')}</span><div>{canDelete&&<button type="button" className="registry-view-delete" onClick={actions.onDelete}><Trash2 size={16}/>{tr('Supprimer et archiver','Remove and archive')}</button>}{canEdit&&<button type="button" className="registry-view-edit" onClick={actions.onEdit}><Pencil size={16}/>{tr('Modifier le dossier','Edit profile')}</button>}</div></div></section></div>
}
function learnerFields(s:Learner,tr:(fr:string,en:string)=>string,language:string):Array<[string,unknown]>{
 const date=s.dateOfBirth?new Date(s.dateOfBirth):null
 return [[tr('Nom','Last name'),s.lastName],[tr('Postnom','Middle name'),s.middleName],[tr('Prénom','First name'),s.firstName],[tr('Identifiant élève','Student number'),s.studentNumber],[tr('E-mail scolaire','School email'),s.email],[tr('Date de naissance','Date of birth'),date&&!Number.isNaN(date.getTime())?date.toLocaleDateString(language==='fr'?'fr-FR':'en-GB',{timeZone:'UTC'}):''],[tr('Classe','Grade'),s.grade],[tr('Section','Section'),s.section],[tr('Statut','Status'),statusLabel(s.status,tr)]]
}
export function ParentProfileView({parent,learners,actions,onLearner}:{parent:Parent;learners:Learner[];actions:Actions;onLearner:(student:Learner)=>void}){
 const {tr,language}=useCopy()
 return <Frame kind="parent" name={parent.name} detail={parent.email} photo={parent.photoData} badge={learners.length+' '+tr('enfant(s) lié(s)','linked learner(s)')} actions={actions}>
 <Card section="identity" icon={Users} title={tr('Identité et coordonnées','Identity and contact')}><Fields rows={[[tr('Identifiant parent','Parent ID'),parent.displayId||parent.id],[tr('Nom','Last name'),parent.lastName],[tr('Postnom','Middle name'),parent.middleName],[tr('Prénom','First name'),parent.firstName],['E-mail',parent.email],[tr('Téléphone','Phone'),parent.phone],[tr('Adresse physique','Home address'),parent.physicalAddress],[tr('Statut','Status'),statusLabel(parent.status,tr)]]}/>
 <div className="registry-view-secondary"><h4><Mail size={16}/>{tr('E-mails supplémentaires','Additional email addresses')}</h4><Fields rows={Array.from({length:Math.max(3,parent.additionalEmails?.length??0)},(_,i)=>[tr('E-mail supplémentaire','Additional email')+' '+(i+1),parent.additionalEmails?.[i]])}/><p>{tr('Ces adresses complètent les destinataires des communications scolaires ; elles ne remplacent pas l’identifiant de connexion.','These addresses supplement school communication recipients; they do not replace the sign-in identifier.')}</p></div></Card>
 <Card section="contacts" icon={Users} title={tr('Contacts familiaux complémentaires','Additional family contacts')}><Contacts contacts={parent.familyContacts}/></Card>
 <Card section="learners" icon={GraduationCap} title={tr('Enfants liés','Linked learners')}><div className="registry-view-learners">{learners.map(s=><article key={s.id}><div className="registry-view-learner-title"><div><h4>{s.name}</h4><p>{[s.grade,s.section,s.studentNumber].filter(Boolean).join(' · ')}</p></div>{s.photoData&&<img src={s.photoData} alt={s.name} loading="lazy"/>}</div><Fields rows={learnerFields(s,tr,language)}/><button type="button" className="registry-view-link" onClick={()=>onLearner(s)}><BookOpen size={15}/>{tr('Ouvrir le dossier élève','Open learner profile')}</button></article>)}</div>{!learners.length&&<p className="registry-view-note">{tr('Aucun enfant rattaché à ce parent.','No learner is linked to this parent.')}</p>}</Card>
 </Frame>
}
export function LearnerProfileView({student:s,actions}:{student:Learner;actions:Actions}){
 const {tr,language}=useCopy()
 const guardians=s.responsibleParents?.length?s.responsibleParents:s.parent?[{id:'primary',name:s.parent,email:s.parentEmail||'',phone:s.parentPhone||'',relationship:tr('Parent responsable','Responsible guardian')}]:[]
 return <Frame kind="student" name={s.name} detail={s.studentNumber} photo={s.photoData} badge={[s.grade,s.section].filter(Boolean).join(' · ')} actions={actions} canEdit={s.isEditable!==false} canDelete={s.isDeletable!==false}>
 <Card section="identity" icon={GraduationCap} title={tr('Identité et scolarité','Identity and schooling')}><Fields rows={learnerFields(s,tr,language)}/></Card>
 <Card section="family" icon={Users} title={tr('Tous les parents responsables','All responsible guardians')}><div className="registry-view-contacts">{guardians.map(g=><article key={g.id}><h4>{g.name}</h4><Fields rows={[[tr('Parenté','Relationship'),g.relationship],['E-mail',g.email],[tr('Téléphone','Phone'),g.phone]]}/></article>)}</div>{!guardians.length&&<p className="registry-view-note">{tr('Aucun parent rattaché.','No guardian linked.')}</p>}</Card>
 <Card section="contacts" icon={Users} title={tr('Contacts familiaux complémentaires','Additional family contacts')}><Contacts contacts={s.familyContacts??[]}/></Card>
 <Card section="followup" icon={CheckCircle2} title={tr('Suivi scolaire','School follow-up')}><Fields rows={[[tr('Présence','Attendance'),s.attendance==null?'':s.attendance+'%'],['GPA',s.gpa],[tr('Conseiller','Advisor'),s.advisor],['Discipline',s.discipline]]}/></Card>
 </Frame>
}
