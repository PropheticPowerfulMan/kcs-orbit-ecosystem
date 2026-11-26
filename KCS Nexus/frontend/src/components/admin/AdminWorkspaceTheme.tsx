import {useEffect} from 'react'
import {useLocation} from 'react-router-dom'
import {useAuthStore} from '@/store/authStore'

export default function AdminWorkspaceTheme(){
 const {pathname}=useLocation(),user=useAuthStore(state=>state.user)
 useEffect(()=>{
  if(!pathname.startsWith('/admin')||user?.id!=='configured-superadmin')return
  let main:HTMLElement|null=null,hero:HTMLElement|null=null
  const cards=new Set<HTMLElement>()
  const excluded='[role=dialog],[data-entity-dialog],[data-official-document],.report-card-paper,.report-card-document,.official-report-card,.transcript-paper,[data-kcs-gradebook],[data-school-handbook],.handbook-portal-header'
  const apply=()=>{
   main=document.querySelector<HTMLElement>('.portal-shell > main');if(!main)return
   main.dataset.adminWorkspace='true'
   const next=new Set<HTMLElement>()
   for(const box of main.querySelectorAll<HTMLElement>('section,article,div[class*=rounded-2xl],div[class*=rounded-3xl]')){
    // A custom dark surface owns its descendants' palette. Never repaint its inner cards.
    if(box.closest(excluded)||box.parentElement?.closest('[class*="bg-gradient-"],[data-admin-tone=dark]')||box.querySelector('canvas')||box.matches('[data-employee-row]'))continue
    if(/border/.test(box.className)&&/bg-/.test(box.className))next.add(box)
   }
   for(const box of cards)if(!next.has(box)){delete box.dataset.adminCard;cards.delete(box)}
   for(const box of next){if(box.dataset.adminCard!=='true')box.dataset.adminCard='true';cards.add(box)}
   if(hero){delete hero.dataset.adminHero;hero=null}
   const page=pathname.replace(/\/+$/,'')
   // These workspaces contain independent panels, not one giant heading.
   // Electives already owns its hero; its catalogue and empty states are ordinary cards.
   if(['/admin','/admin/dashboard','/admin/handbook','/admin/electives'].includes(page)||/\/(students|parents|employees|teachers)$/.test(page))return
   const candidate=Array.from(main.querySelectorAll<HTMLElement>('section,[data-admin-card]')).find(box=>
    !box.closest(excluded)&&!box.closest('[hidden]')&&!box.matches('[data-admin-overview],[data-admin-analysis],[data-site-manager]')&&box.querySelector('h2')&&!box.querySelector('table,canvas,article,[role=tablist],form')&&box.getBoundingClientRect().height<600)
   if(candidate){candidate.dataset.adminHero='true';hero=candidate}
  }
  apply();const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true})
  return()=>{observer.disconnect();if(main)delete main.dataset.adminWorkspace;for(const box of cards)delete box.dataset.adminCard;if(hero)delete hero.dataset.adminHero}
 },[pathname,user?.id])
 return null
}
