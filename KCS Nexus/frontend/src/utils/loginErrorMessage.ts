type LoginError={response?:{status?:number;data?:{message?:string;retryAfterMinutes?:number}};code?:string;message?:string}
export function loginErrorMessage(error:LoginError,language:string){
 const tr=(fr:string,en:string)=>language==='fr'?fr:en
 const message=error.response?.data?.message??'',status=error.response?.status
 if(status===428||message==='Two-factor authentication code required')return tr('Saisissez votre code d’authentification à 6 chiffres.','Enter your 6-digit authentication code.')
 if(message==='Invalid two-factor authentication code')return tr('Code d’authentification invalide. Réessayez avec le code actuel.','Invalid authentication code. Try again with the current code.')
 // A login rejection is localized from its status, never from possibly misencoded provider text.
 if(status===401)return tr('Identifiant ou mot de passe incorrect.','Incorrect identifier or password.')
 if(status===423||status===429){
  const minutes=Number(error.response?.data?.retryAfterMinutes)||Number(message.match(/(?:dans|in)\s+(\d+)\s+minute/i)?.[1])
  const time=Number.isFinite(minutes)&&minutes>0?Math.ceil(minutes):null
  return time?tr('Compte temporairement verrouillé. Réessayez dans '+time+' minute'+(time>1?'s':'')+'.','Account temporarily locked. Try again in '+time+' minute'+(time>1?'s':'')+'.'):tr('Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.','Too many attempts. Please wait a few minutes before trying again.')
 }
 if(status===410)return tr('Ce compte est archivé ou désactivé. Contactez l’administration de l’école.','This account is archived or disabled. Contact the school administration.')
 if(error.code==='ERR_NETWORK'||error.message==='Network Error')return tr('Connexion indisponible. Vérifiez votre connexion et réessayez.','Connection unavailable. Check your connection and try again.')
 if(error.code==='ECONNABORTED')return tr('Le service met trop de temps à répondre. Réessayez.','The service is taking too long to respond. Please try again.')
 if(status&&status>=500)return tr('Le service de connexion est momentanément indisponible. Réessayez dans quelques instants.','The sign-in service is temporarily unavailable. Please try again shortly.')
 if(message&&!/[ÃÂ\uFFFD]|â€/.test(message))return message
 return tr('La connexion a été refusée. Vérifiez vos identifiants ou contactez l’administration.','Sign-in was declined. Check your credentials or contact the school administration.')
}
