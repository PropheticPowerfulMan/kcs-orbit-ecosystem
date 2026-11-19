import {useEffect,useState} from 'react'
import {MapPin,ShieldCheck} from 'lucide-react'
import {teachingAttendanceAPI} from '@/services/api'
import {useUIStore} from '@/store/uiStore'
import {useAuthStore} from '@/store/authStore'
import TeachingDialog from './TeachingDialog'
import {teachingError,type TeachingSession} from './model'
export function freshCampusPosition():Promise<{latitude:number;longitude:number;accuracy:number}>{
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation)return reject(new Error('TEACHING_LOCATION_UNAVAILABLE'))
  navigator.geolocation.getCurrentPosition(({coords})=>resolve({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy}),()=>reject(new Error('TEACHING_LOCATION_UNAVAILABLE')),{enableHighAccuracy:true,maximumAge:0,timeout:15000})
 })
}
export function PresenceEvidence({row}:{row:TeachingSession}){
 const fr=useUIStore(s=>s.language)==='fr',tr=(a:string,b:string)=>fr?a:b
 return <div className="mt-2 flex flex-wrap gap-2">{(['entry','exit'] as const).map(action=>{
  if(!(action==='entry'?row.checkInAt:row.checkOutAt))return null
  const proof=row.presenceProof?.[action],status=proof?.status||'LEGACY'
  return <span key={action} className="ta-badge" data-state={status}>{action==='entry'?tr('Entrée','Entry'):tr('Sortie','Exit')} · {status==='VERIFIED'?tr('GPS + Principal confirmés','GPS + Principal confirmed'):status==='REJECTED'?tr('Contestée par le Principal','Disputed by Principal'):status==='PENDING'?tr('Campus vérifié · Principal attendu','Campus checked · Principal pending'):tr('Historique déclaratif','Historical declaration')}</span>
 })}</div>
}
export function CampusSettings(){
 const fr=useUIStore(s=>s.language)==='fr',tr=(a:string,b:string)=>fr?a:b
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[configured,setConfigured]=useState(false)
 const [form,setForm]=useState({latitude:'',longitude:'',radiusMeters:'150',maxAccuracyMeters:'50'}),[confirmed,setConfirmed]=useState(false)
 useEffect(()=>{teachingAttendanceAPI.campus().then(r=>{const p=r.data.data;if(p){setConfigured(true);setForm({latitude:String(p.latitude),longitude:String(p.longitude),radiusMeters:String(p.radiusMeters),maxAccuracyMeters:String(p.maxAccuracyMeters)})}}).catch(e=>setError(teachingError(e,fr)))},[fr])
 const save=async()=>{
  setBusy(true);setError('')
  try{await teachingAttendanceAPI.saveCampus(Object.fromEntries(Object.entries(form).map(([key,value])=>[key,Number(value)])));setConfigured(true);setOpen(false)}
  catch(e){setError(teachingError(e,fr))}finally{setBusy(false)}
 }
 return <section className="ta-panel"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold"><MapPin size={17}/>{tr('Campus et contrôle indépendant','Campus and independent verification')}</h3><p className="ta-muted mt-1 max-w-3xl text-xs">{configured?tr('Localisation exigée à chaque entrée et sortie. Une présence reste à confirmer par le Principal.','Location required at every entry and exit. Presence still requires Principal confirmation.'):tr('Configuration du campus requise avant les nouveaux pointages. Le Principal doit confirmer le centre GPS et le périmètre réel.','Campus setup required before new check-ins. The Principal must confirm the GPS centre and actual boundary.')}</p></div><button className="ta-btn" onClick={()=>setOpen(true)}>{tr('Configurer le campus','Configure campus')}</button></div>{error&&!open&&<p role="alert" className="ta-alert mt-2">{error}</p>}
 {open&&<TeachingDialog title={tr('Zone de présence autorisée','Authorized attendance zone')} onClose={()=>!busy&&setOpen(false)} footer={<><button className="ta-btn" disabled={busy} onClick={()=>setOpen(false)}>{tr('Annuler','Cancel')}</button><button className="ta-btn ta-primary" disabled={busy||!confirmed||Object.values(form).some(v=>!v.trim()||!Number.isFinite(Number(v)))} onClick={()=>void save()}>{busy?tr('Enregistrement…','Saving…'):tr('Activer ce périmètre','Activate boundary')}</button></>}>
 <p className="ta-alert">{tr('Le GPS indique une zone, pas une salle. Seule une observation indépendante sur place permet au Principal de confirmer la présence. Aucune position continue n’est suivie.','GPS indicates an area, not a classroom. An independent on-site observation is needed for the Principal to confirm presence. No continuous location tracking.')}</p>
 <div className="mt-4 grid gap-3 sm:grid-cols-2">{([['latitude',tr('Latitude du centre du campus','Campus centre latitude')],['longitude',tr('Longitude du centre du campus','Campus centre longitude')],['radiusMeters',tr('Rayon autorisé (25–500 m)','Allowed radius (25–500 m)')],['maxAccuracyMeters',tr('Incertitude GPS maximale (5–100 m)','Maximum GPS uncertainty (5–100 m)')]] as const).map(([key,label])=><label key={key} className="text-xs font-semibold">{label}<input className="ta-field mt-1" type="number" step={key==='latitude'||key==='longitude'?'any':'1'} value={form[key]} onChange={e=>{setConfirmed(false);setForm(v=>({...v,[key]:e.target.value}))}}/></label>)}</div>
 <button className="ta-btn mt-3" disabled={busy} onClick={async()=>{setBusy(true);try{const pos=await freshCampusPosition();setForm(v=>({...v,latitude:String(pos.latitude),longitude:String(pos.longitude)}));setConfirmed(false)}catch(e){setError(teachingError(e,fr))}finally{setBusy(false)}}}>{tr('Utiliser ma position actuelle sur le campus','Use my current on-campus position')}</button>
 <label className="mt-4 flex items-start gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{tr('Je confirme que le centre et le rayon correspondent au campus réel. Le rayon ne doit pas inclure des lieux extérieurs.','I confirm that the centre and radius match the real campus. The radius must not include off-campus locations.')}</label>{error&&<p role="alert" className="ta-alert mt-3">{error}</p>}
 </TeachingDialog>}</section>
}
export function PresenceVerificationDialog({row,onClose,onSaved}:{row:TeachingSession;onClose:()=>void;onSaved:()=>void}){
 const fr=useUIStore(s=>s.language)==='fr',tr=(a:string,b:string)=>fr?a:b,userId=useAuthStore(s=>s.user?.id)
 const [action,setAction]=useState<'ENTRY'|'EXIT'>(row.presenceProof?.entry?'ENTRY':'EXIT'),[note,setNote]=useState(''),[observed,setObserved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const proof=row.presenceProof?.[action==='ENTRY'?'entry':'exit'],self=userId===row.teacherUserId
 const review=async(status:'VERIFIED'|'REJECTED')=>{if(!row.id||!proof)return;setBusy(true);try{await teachingAttendanceAPI.verifyPresence(row.id,{action,status,revision:proof.revision,note,observedOnSite:true});onSaved()}catch(e){setError(teachingError(e,fr))}finally{setBusy(false)}}
 return <TeachingDialog title={tr('Confirmation indépendante sur place','Independent on-site confirmation')} onClose={()=>!busy&&onClose()} footer={<><button className="ta-btn" disabled={busy} onClick={onClose}>{tr('Fermer','Close')}</button><button className="ta-btn ta-danger" disabled={busy||!proof||self||!observed||note.trim().length<3} onClick={()=>void review('REJECTED')}>{tr('Présence contestée','Dispute presence')}</button><button className="ta-btn ta-complete" disabled={busy||!proof||self||!observed||note.trim().length<3} onClick={()=>void review('VERIFIED')}>{tr('Confirmer après contrôle','Confirm after observation')}</button></>}>
 <h3 className="font-bold">{row.teacherName} · {row.courseName}</h3><p className="ta-muted mt-1 text-xs">{row.schoolDate} · {row.className} · {row.room||'—'}</p><PresenceEvidence row={row}/>
 <p className="ta-alert mt-4">{tr('Les heures déclarées restent inchangées. Ne confirmez que ce que vous avez personnellement vérifié sur place. Le professeur ne peut pas confirmer sa propre présence.','Declared times remain unchanged. Confirm only what you personally observed on site. Teachers cannot verify their own presence.')}</p>
 <label className="mt-4 block text-xs font-bold">{tr('Pointage à examiner','Check-in/out to review')}<select className="ta-field mt-1" value={action} onChange={e=>{setAction(e.target.value as typeof action);setObserved(false)}}><option value="ENTRY">{tr('Entrée','Entry')}</option><option value="EXIT">{tr('Sortie','Exit')}</option></select></label>
 {proof?<p className="ta-muted mt-2 text-xs">{tr('Distance du centre','Distance from centre')}: {proof.distanceMeters} m · {tr('Incertitude GPS','GPS uncertainty')}: ±{proof.accuracyMeters} m{proof.note?' · '+proof.note:''}</p>:<p className="ta-alert mt-2">{tr('Aucun contrôle GPS pour ce pointage. Les données historiques restent déclaratives.','No GPS evidence for this action. Historical records remain declarations.')}</p>}
 {self&&<p className="ta-alert mt-2">{tr('Demandez la confirmation d’un autre responsable autorisé.','Ask another authorized manager to verify your presence.')}</p>}
 <label className="mt-4 block text-xs font-bold">{tr('Observation du Principal','Principal observation')}<textarea className="ta-field mt-1" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
 <label className="mt-3 flex gap-2 text-xs"><input type="checkbox" checked={observed} onChange={e=>setObserved(e.target.checked)}/>{tr('J’ai effectué un contrôle indépendant sur place pour ce pointage.','I independently checked this action on site.')}</label>{error&&<p role="alert" className="ta-alert mt-3">{error}</p>}
 </TeachingDialog>
}
