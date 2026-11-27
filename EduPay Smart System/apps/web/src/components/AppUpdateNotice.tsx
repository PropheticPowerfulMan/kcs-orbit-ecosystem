import {useEffect} from 'react'
/** Scoped runtime emitted by Vite owns the mandatory update dialog. */
export function AppUpdateNotice(){useEffect(()=>{if('serviceWorker'in navigator)void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL,updateViaCache:'none'}).catch(()=>{})},[]);return null}
