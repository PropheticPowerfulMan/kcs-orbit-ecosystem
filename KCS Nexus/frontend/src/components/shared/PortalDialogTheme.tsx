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
  const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const viewport=window.visualViewport,height=Math.max(1,Math.round(Math.min(window.innerHeight,viewport?.height??window.innerHeight)))
   document.documentElement.dataset.nexusDialogCompact=String(height<520)
   document.documentElement.style.setProperty('--nexus-dialog-viewport-height',height+'px')
   document.documentElement.style.setProperty('--nexus-dialog-viewport-top',Math.max(0,Math.round(viewport?.offsetTop??0))+'px')
   decoratePortalDialogs()
  })}
  refresh()
  window.addEventListener('resize',refresh);window.visualViewport?.addEventListener('resize',refresh);window.visualViewport?.addEventListener('scroll',refresh)
  const observer=new MutationObserver(refresh)
  observer.observe(document.body,{childList:true,subtree:true})
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',refresh);window.visualViewport?.removeEventListener('resize',refresh);window.visualViewport?.removeEventListener('scroll',refresh);document.documentElement.style.removeProperty('--nexus-dialog-viewport-height');document.documentElement.style.removeProperty('--nexus-dialog-viewport-top');delete document.documentElement.dataset.nexusDialogCompact;delete document.body.dataset.nexusDashboard}
 },[dashboard,pathname])
 return null
}
