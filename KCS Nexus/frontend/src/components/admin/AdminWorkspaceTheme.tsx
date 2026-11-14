import {useEffect} from 'react'
import {useLocation} from 'react-router-dom'
import {useAuthStore} from '@/store/authStore'
export default function AdminWorkspaceTheme(){const {pathname}=useLocation(),user=useAuthStore(s=>s.user);useEffect(()=>{
 if(!pathname.startsWith('/admin')||user?.id!=='configured-superadmin')return
 let main:HTMLElement|null=null;const touched=new Set<HTMLElement>();
 const excluded='[role=dialog],[data-entity-dialog],[data-official-document],.report-card-paper,.report-card-document,.official-report-card,.transcript-paper,[data-kcs-gradebook]';
 const apply=()=>{main=document.querySelector<HTMLElement>('.portal-shell > main');if(!main)return;main.dataset.adminWorkspace='true';touched.add(main);for(const box of main.querySelectorAll<HTMLElement>('section,article,div[class*=rounded-2xl],div[class*=rounded-3xl]')){if(box.closest(excluded)||box.querySelector('canvas')||box.matches('[data-employee-row]'))continue;const cls=box.className;if(/border/.test(cls)&&/bg-/.test(cls))box.dataset.adminCard='true'}
 if(!/\/(students|parents|employees|teachers)$/.test(pathname)){const candidate=Array.from(main.querySelectorAll<HTMLElement>('section,[data-admin-card]')).find(box=>!box.closest(excluded)&&box.querySelector('h2')&&!box.querySelector('table,canvas')&&box.getBoundingClientRect().height<600);if(candidate)candidate.dataset.adminHero='true'}
 };apply();const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});return()=>{observer.disconnect();for(const root of touched){delete root.dataset.adminWorkspace;root.querySelectorAll('[data-admin-card],[data-admin-hero]').forEach(box=>{box.removeAttribute('data-admin-card');box.removeAttribute('data-admin-hero')})}}
 },[pathname,user?.id]);return null}
