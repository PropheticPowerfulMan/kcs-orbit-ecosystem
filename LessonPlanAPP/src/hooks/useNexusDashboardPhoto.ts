import {useEffect,useState} from "react";
import {cloudAuthService} from "../services/cloudAuthService";
import type {UserProfile} from "../types/user";
type Photo={userId:string;linked:boolean;photoUrl:string};
const key=(id:string)=>"eduplanner:nexus-dashboard-photo:v1:"+id;
function cached(id:string):Photo|null{try{const value=JSON.parse(localStorage.getItem(key(id))||"null");return value?.userId===id&&value.linked===true&&typeof value.photoUrl==="string"?value:null}catch{return null}}
export function useNexusDashboardPhoto(user:UserProfile|null){
 const [photo,setPhoto]=useState<Photo|null>(()=>user?cached(user.id):null);
 useEffect(()=>{
  if(!user||!cloudAuthService.enabled){setPhoto(null);return}
  const userId=user.id;setPhoto(cached(userId));let alive=true,busy=false,last=0,controller:AbortController|null=null;
  const refresh=async()=>{if(!alive||busy||document.visibilityState==='hidden'||Date.now()-last<15000)return;busy=true;last=Date.now();controller=new AbortController();const timeout=window.setTimeout(()=>controller?.abort(),10000);
   try{const result=await cloudAuthService.getNexusDashboardPhoto(controller.signal);if(!alive)return;const next={userId,...result};setPhoto(next);try{if(result.linked)localStorage.setItem(key(userId),JSON.stringify(next));else localStorage.removeItem(key(userId))}catch{/* A full browser cache does not prevent the photo from being displayed. */}}
   catch{/* Keep this account's last verified dashboard photo during a network interruption. */}
   finally{clearTimeout(timeout);busy=false}
  };
  void refresh();const timer=window.setInterval(()=>void refresh(),60000);const resume=()=>void refresh();window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',resume);
  return()=>{alive=false;controller?.abort();clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',resume)};
 },[user?.id]);
 const current=photo?.userId===user?.id?photo:null;
 return {photoUrl:current?.linked?current.photoUrl:user?.photoUrl||"",linked:current?.linked===true};
}
