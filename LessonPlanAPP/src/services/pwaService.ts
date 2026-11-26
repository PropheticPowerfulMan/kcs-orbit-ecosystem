interface BeforeInstallPromptEvent extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>}
type Listener=()=>void;
type InstallSnapshot={canInstall:boolean;showInstall:boolean;installed:boolean};
let deferredPrompt:BeforeInstallPromptEvent|null=null,initialized=false,prompting=false;
let snapshot:InstallSnapshot={canInstall:false,showInstall:false,installed:false};
const listeners=new Set<Listener>();
const updateSnapshot=(installed=snapshot.installed)=>{
 snapshot={canInstall:Boolean(deferredPrompt)&&!installed,showInstall:!installed,installed};
 listeners.forEach(listener=>listener());
};
// A standalone window may belong to Nexus; stale local flags do not prove installation.
const discoverInstallation=async()=>{
 const nav=navigator as Navigator&{getInstalledRelatedApps?:()=>Promise<Array<{platform?:string;id?:string;url?:string}>>};
 if(!nav.getInstalledRelatedApps)return;
 try{
  const base=new URL(import.meta.env.BASE_URL||'/',location.origin),manifest=new URL('manifest.webmanifest',base);
  const apps=await nav.getInstalledRelatedApps();
  const installed=apps.some(app=>{
   if(app.platform!=='webapp')return false;
   try{return (!app.id||new URL(app.id,base).href===base.href)&&typeof app.url==='string'&&new URL(app.url,base).href===manifest.href}catch{return false}
  });
  if(!deferredPrompt)updateSnapshot(installed);
 }catch{/* Keep help available when discovery is unsupported. */}
};
export const initializePwaInstall=()=>{
 if(initialized||typeof window==='undefined')return;
 initialized=true;updateSnapshot(false);void discoverInstallation();
 addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event as BeforeInstallPromptEvent;updateSnapshot(false)});
 addEventListener('appinstalled',()=>{deferredPrompt=null;updateSnapshot(true)});
 addEventListener('focus',()=>{void discoverInstallation()});
};
export const pwaInstallStore={
 subscribe(listener:Listener){listeners.add(listener);return()=>listeners.delete(listener)},
 getSnapshot(){return snapshot},
 async install(){
  if(!deferredPrompt||snapshot.installed||prompting)return false;
  prompting=true;const pending=deferredPrompt;deferredPrompt=null;updateSnapshot(false);
  try{await pending.prompt();return(await pending.userChoice).outcome==='accepted'}
  finally{prompting=false;updateSnapshot()}
 }
};
export const registerPwaServiceWorker=()=>{
 if(!('serviceWorker'in navigator))return;
 addEventListener('load',()=>{
  const base=import.meta.env.BASE_URL||'/',swUrl=base.replace(/\/$/,'')+'/sw.js';
  navigator.serviceWorker.register(swUrl,{scope:base,updateViaCache:'none'}).catch(error=>console.warn('PWA service worker registration failed',error));
 });
};
