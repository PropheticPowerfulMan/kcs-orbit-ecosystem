import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { decoratePortalDialogs } from '@/utils/portalDialogTheme'
import './portalDialogTheme.css'

export default function PortalDialogTheme() {
 const { pathname }=useLocation()
 const dashboard=/^\/(?:admin|portal)(?:\/|$)/.test(pathname)||['/course-syllabi','/electives','/incident-reports','/shining-students'].includes(pathname)
 useEffect(()=>{
  if(!dashboard)return
  document.body.dataset.nexusDashboard='true'
  let frame=0
  const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>decoratePortalDialogs())}
  refresh()
  const observer=new MutationObserver(refresh)
  observer.observe(document.body,{childList:true,subtree:true})
  return()=>{observer.disconnect();cancelAnimationFrame(frame);delete document.body.dataset.nexusDashboard}
 },[dashboard,pathname])
 return null
}
