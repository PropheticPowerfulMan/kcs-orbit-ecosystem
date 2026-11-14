import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { HelpCircle, Info, ShieldAlert, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { answerPortalDialog, cancelPortalDialogs, currentPortalDialog, subscribePortalDialogs } from '@/utils/portalActionDialogs'
import './portalActionDialogs.css'

const translations:Record<string,string>={
 'Submit this reviewed report to the selected school authority?':'Soumettre ce rapport vérifié à la direction choisie ?',
 'Delete this assignment and its linked submissions?':'Supprimer ce travail et les soumissions associées ?',
 'Reason for blocking this parent account:':'Motif du blocage de ce compte parent :',
 'Pour confirmer cette décision, tapez exactement ARCHIVER :':'To confirm this decision, type ARCHIVER exactly:',
 'Media must be 8 MB or less.':'Le fichier doit faire 8 Mo maximum.',
 'The file must be 8 MB or less.':'Le fichier doit faire 8 Mo maximum.'
}
function localizedMessage(message:string,fr:boolean){
 if(fr){if(translations[message]&&/[A-Za-z]/.test(message)&&!message.startsWith('Pour confirmer'))return translations[message];return message.replace(/^Unblock (.+)\?$/,'Débloquer $1 ?').replace(/^Block immediately and revoke sessions for (.+)\?$/,'Bloquer immédiatement et révoquer les sessions de $1 ?').replace(/^Please select a valid (.+) file\.$/,'Veuillez sélectionner un fichier $1 valide.')}
 if(message.startsWith('Pour confirmer')&&translations[message])return translations[message]
 return message.replace(/^Supprimer (\d+) notification\(s\) \?$/,'Delete $1 notification(s)?').replace(/^Supprimer (.+) du registre parent \?$/,'Remove $1 from the parent registry?').replace(/^Supprimer (.+) du registre partagé \?$/,'Remove $1 from the shared registry?').replace(/^Motif officiel de l’archivage de (.+) \(10 caractères minimum\) :$/,'Official reason for archiving $1 (at least 10 characters):').replace(/^Retirer (.+) de tous les registres actifs et archiver son dossier \?\n\nCette opération bloque son accès, mais préserve ses preuves académiques dans Archives\.$/,'Remove $1 from all active registers and archive their record?\n\nThis blocks account access while retaining academic evidence in Archives.')
}
export default function PortalActionDialogs(){
 const request=useSyncExternalStore(subscribePortalDialogs,currentPortalDialog,()=>null)
 const language=useUIStore(state=>state.language),fr=language==='fr',tr=(a:string,b:string)=>fr?a:b
 const [value,setValue]=useState(''),container=useRef<HTMLFormElement>(null),input=useRef<HTMLInputElement>(null),cancel=useRef<HTMLButtonElement>(null)
 const {pathname}=useLocation()
 useEffect(()=>{cancelPortalDialogs();return()=>cancelPortalDialogs()},[pathname])
 useLayoutEffect(()=>{setValue(request?.initialValue??'');if(!request)return;const previous=document.activeElement as HTMLElement|null;const frame=requestAnimationFrame(()=>{(request.kind==='prompt'?input.current:cancel.current)?.focus({preventScroll:true})});return()=>{cancelAnimationFrame(frame);if(previous?.isConnected)previous.focus({preventScroll:true})}},[request?.id])
 if(!request)return null
 const dangerous=request.kind==='confirm'&&/delete|supprim|désactiv|deactivat|archive|archiv|retir|révo|block/i.test(request.message)
 const Icon=dangerous?ShieldAlert:request.kind==='alert'?Info:HelpCircle
 const finish=(answer:boolean|string|null)=>answerPortalDialog(request.id,answer)
 return createPortal(<div className="portal-action-overlay" role="alertdialog" aria-modal="true" aria-labelledby="portal-action-title" aria-describedby="portal-action-message" data-portal-action-dialog onKeyDown={event=>{event.stopPropagation();if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();return}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(request.kind==='confirm'?false:null)}if(event.key==='Tab'){const controls=Array.from(container.current?.querySelectorAll<HTMLElement>('button,input')||[]).filter(node=>node.getClientRects().length>0);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}}}><form ref={container} className="portal-action-surface" onSubmit={event=>{event.preventDefault();finish(request.kind==='prompt'?value:true)}}><header><span className={'portal-action-icon '+(dangerous?'is-danger':'')}><Icon size={26}/></span><div><p>KCS NEXUS AI</p><h2 id="portal-action-title">{request.kind==='alert'?tr('Information importante','Important information'):request.kind==='prompt'?tr('Préciser votre décision','Provide the details'):dangerous?tr('Confirmer cette décision','Confirm this decision'):tr('Avant de continuer','Before you continue')}</h2></div><button type="button" data-kcs-no-processing="true" onClick={()=>finish(request.kind==='confirm'?false:null)} aria-label={tr('Fermer','Close')}><X size={19}/></button></header><div className="portal-action-content"><p id="portal-action-message">{localizedMessage(request.message,fr)}</p>{request.kind==='prompt'&&<label>{tr('Votre réponse','Your response')}<input ref={input} value={value} onChange={event=>setValue(event.target.value)} autoComplete="off"/></label>}</div><footer>{request.kind!=='alert'&&<button ref={cancel} type="button" data-kcs-no-processing="true" onClick={()=>finish(request.kind==='confirm'?false:null)} className="portal-action-cancel">{tr('Annuler','Cancel')}</button>}<button ref={request.kind==='alert'?cancel:undefined} data-kcs-no-processing="true" type="submit" className={dangerous?'portal-action-confirm is-danger':'portal-action-confirm'}>{request.kind==='alert'?tr('Compris','Understood'):request.kind==='prompt'?tr('Valider','Continue'):tr('Confirmer','Confirm')}</button></footer></form></div>,document.body)
}
