let registration:Promise<ServiceWorkerRegistration|undefined>|undefined;
export function registerPwa():Promise<ServiceWorkerRegistration|undefined>{
 if(!import.meta.env.PROD||!('serviceWorker' in navigator))return Promise.resolve(undefined);
 const base=import.meta.env.BASE_URL||'/';
 registration??=navigator.serviceWorker.register(`${base}sw.js`,{scope:base,updateViaCache:'none'}).then(reg=>{void reg.update().catch(()=>{});return reg;}).catch(()=>undefined);
 return registration;
}
