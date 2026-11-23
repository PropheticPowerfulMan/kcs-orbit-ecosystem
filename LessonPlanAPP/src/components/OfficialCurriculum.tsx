import {useApp} from "../contexts/AppContext";
import {cloudAuthService} from "../services/cloudAuthService";
import PedagogyWorkspace from "./PedagogyWorkspace";
import "./pedagogy.css";
export function OfficialCurriculum(){
 const {language}=useApp();
 const base=new URL("/api/pedagogy/planner",import.meta.env.VITE_PUBLIC_APP_URL||location.origin).toString();
 const request=async(path:string,o?:{method?:string;body?:any})=>{const form=o?.body instanceof FormData,r=await fetch(base+path,{method:o?.method||"GET",headers:{Authorization:"Bearer "+cloudAuthService.getAccessToken(),...(!form&&o?.body?{"Content-Type":"application/json"}:{})},body:o?.body?(form?o.body:JSON.stringify(o.body)):undefined,cache:"no-store",signal:AbortSignal.timeout(25000)}),b=await r.json();if(!r.ok)throw new Error(b.message||"Request failed");return b.data;};
 const download=async(id:string,name:string)=>{if(id.startsWith("reference:")){window.open("https://academy.kinshasachristianschool.org/library/"+encodeURIComponent(id.slice(10)),"_blank","noopener");return;}const r=await fetch(base+"/resources/"+encodeURIComponent(id)+"/file",{headers:{Authorization:"Bearer "+cloudAuthService.getAccessToken()},cache:"no-store"});if(!r.ok)throw new Error("Download failed");const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
 return <PedagogyWorkspace fr={language==="fr"} request={request} download={download}/>;
}
