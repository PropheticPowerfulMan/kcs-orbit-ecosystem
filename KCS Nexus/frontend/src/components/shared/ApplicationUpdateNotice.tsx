import {useEffect,useRef,useState} from 'react';
import {useUIStore} from '@/store/uiStore';
import {registerPwa} from '@/registerPwa';
import {getPendingNexusWrites} from '@/utils/applicationUpdateSafety';
/** A confirmed reload protects Gradebook drafts and other unsaved work. */
export function ApplicationUpdateNotice(){
 const lang=useUIStore(s=>s.language),L=(a:string,b:string)=>lang==='fr'?a:b;
 const [available,setAvailable]=useState(false),[dismissed,setDismissed]=useState(false),[pending,setPending]=useState(getPendingNexusWrites),[ready,setReady]=useState(false),[confirming,setConfirming]=useState(false);
 const notice=useRef<HTMLDialogElement>(null),dialog=useRef<HTMLDialogElement>(null),registration=useRef<ServiceWorkerRegistration|null>(null);
 useEffect(()=>{
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
  let disposed=false,lastCheck=0;const hadController=Boolean(navigator.serviceWorker.controller);
  const changed=()=>{if(hadController&&!disposed){setAvailable(true);setReady(true);setDismissed(false);}};
  const writes=(e:Event)=>setPending(Number((e as CustomEvent).detail)||0);
  async function check(){if(!navigator.onLine||document.visibilityState==='hidden'||Date.now()-lastCheck<60000)return;lastCheck=Date.now();const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),8000);try{const r=await fetch(import.meta.env.BASE_URL+'app-version.json?t='+Date.now(),{cache:'no-store',credentials:'omit',signal:abort.signal});if(!r.ok)return;const b=await r.json();if(b.app==='KCS_NEXUS'&&typeof b.id==='string'&&/^[a-f0-9]{20}$/.test(b.id)&&b.id!==import.meta.env.VITE_APP_VERSION&&!disposed){setAvailable(true);setDismissed(false);await registration.current?.update();setReady(!registration.current?.installing);}}catch{/* An update check must not disrupt school work. */}finally{clearTimeout(deadline)}}
  const visible=()=>{if(document.visibilityState==='visible')void check();};
  const observe=(reg:ServiceWorkerRegistration)=>{if(disposed)return;registration.current=reg;const watch=()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='activated'&&!disposed)setReady(true)});};reg.addEventListener('updatefound',watch);watch();void reg.update().catch(()=>{});void check();};
  void registerPwa().then(reg=>{if(reg)observe(reg)}).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',changed);window.addEventListener('nexus:write-state',writes);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);const timer=setInterval(()=>void check(),300000);
  return()=>{disposed=true;clearInterval(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);window.removeEventListener('nexus:write-state',writes);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};
 },[]);
 // Deferring is temporary: remind again in one minute or on returning to the app.
 useEffect(()=>{
  if(!available||!dismissed)return;
  const remind=()=>{if(document.visibilityState==='visible')setDismissed(false)};
  const timer=window.setTimeout(()=>setDismissed(false),60000);
  window.addEventListener('focus',remind);document.addEventListener('visibilitychange',remind);
  return()=>{clearTimeout(timer);window.removeEventListener('focus',remind);document.removeEventListener('visibilitychange',remind)};
 },[available,dismissed]);
 useEffect(()=>{const el=notice.current;if(!el)return;if(available&&!dismissed&&!confirming){if(!el.open)el.showModal()}else el.close()},[available,dismissed,confirming]);
 useEffect(()=>{if(confirming)dialog.current?.showModal();else dialog.current?.close()},[confirming]);
 function deferUpdate(){setConfirming(false);setDismissed(true);}

 function requestReload(){if(!getPendingNexusWrites())setConfirming(true);}
 return <><dialog ref={notice} className="nx-update-notice" aria-labelledby="nx-update-title" onCancel={event=>{event.preventDefault();deferUpdate()}}><h2 id="nx-update-title">{L('Nouvelle version de Nexus AI disponible','A new Nexus AI version is available')}</h2><p>{pending?L('Une opération est en cours. Attendez sa confirmation avant de mettre à jour.','An operation is in progress. Wait for confirmation before updating.'):L('Enregistrez votre travail, puis chargez la nouvelle version. La page ne se recharge pas sans votre accord.','Save your work, then load the new version. This page will not reload without your agreement.')}</p><button data-kcs-no-processing="true" disabled={Boolean(pending)||!ready} onClick={requestReload}>{ready?L('Mettre à jour maintenant','Update now'):L('Préparation…','Preparing…')}</button><button data-kcs-no-processing="true" onClick={deferUpdate}>{L('Plus tard · rappel dans 1 min','Later · remind me in 1 min')}</button></dialog>
 <dialog ref={dialog} className="nx-update-confirm" onCancel={event=>{event.preventDefault();deferUpdate()}}><h2>{L('Vérifier avant d’actualiser','Check before reloading')}</h2><p>{L('Une saisie ou une opération hors connexion peut encore être en attente. Vérifiez son enregistrement avant de recharger cette page.','Some input or offline work may still be pending. Check that it has been saved before reloading this page.')}</p><footer><button data-kcs-no-processing="true" onClick={deferUpdate}>{L('Continuer mon travail','Continue working')}</button><button data-kcs-no-processing="true" disabled={Boolean(pending)} onClick={()=>{if(!getPendingNexusWrites())location.reload()}}>{L('J’ai vérifié · actualiser','I have checked · reload')}</button></footer></dialog></>;
}
