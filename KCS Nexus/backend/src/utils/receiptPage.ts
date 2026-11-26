export type ReceiptKind='report-card'|'transcript'|'message'
export function receiptPage(kind:ReceiptKind,id:string,fr:boolean,nonce:string){
 const base='/api/'+(kind==='report-card'?'report-card-receipts':kind==='transcript'?'transcript-receipts':'message-receipts'),tr=(a:string,b:string)=>fr?a:b
 const title=kind==='report-card'?tr('Accusé de réception du bulletin','Report card receipt confirmation'):kind==='transcript'?tr('Accusé de réception du relevé académique','Transcript receipt confirmation'):tr('Accusé de réception du message','Email receipt confirmation')
 const attachment=kind==='message'?tr('Je confirme avoir reçu et pu ouvrir la pièce jointe.','I confirm that I received and could open the attachment.'):kind==='transcript'?tr('Je confirme avoir reçu et pu ouvrir le relevé académique PDF joint.','I confirm that I received and could open the attached transcript PDF.'):tr('Je confirme avoir reçu et pu ouvrir le bulletin PDF joint.','I confirm that I received and could open the attached report card PDF.')
 return `<!doctype html><html lang="${fr?'fr':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KCS · ${title}</title><style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:20px;background:#e7f0f6;color:#12344c;font:16px/1.6 system-ui,sans-serif}main{max-width:620px;width:100%;border:1px solid #adc8d7;border-radius:24px;overflow:hidden;background:#f7fbfd;box-shadow:0 22px 70px #12344c20}header{display:flex;align-items:center;gap:18px;padding:24px 30px;color:#fff;background:#083d60;border-top:6px solid #e6ba51}.school-logo{width:68px;height:68px;object-fit:contain;padding:4px;background:#fff;border-radius:50%;flex-shrink:0}header strong{letter-spacing:.13em;font-size:11px}form,.receipt-summary{padding:30px}h1{font-size:25px;line-height:1.3;margin:10px 0}label{display:flex;align-items:start;gap:12px;margin:24px 0}input[type=checkbox]{margin-top:7px;width:20px;height:20px;flex-shrink:0;accent-color:#086a87}button,.button{display:inline-flex;align-items:center;justify-content:center;border:0;padding:14px 22px;border-radius:12px;color:#fff;background:#086785;font:700 15px system-ui;cursor:pointer;text-decoration:none}button:disabled{opacity:.5;cursor:not-allowed}button:focus-visible,a:focus-visible{outline:3px solid #e6ba51;outline-offset:3px}.secondary{color:#173f58;background:#dceaf2}.receipt-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}small{display:block;margin-top:24px;color:#557080}[hidden]{display:none!important}.receipt-overlay{position:fixed;inset:0;display:grid;place-items:center;padding:20px;background:#102e46b8;backdrop-filter:blur(6px);z-index:100}.receipt-modal{width:min(100%,510px);max-height:calc(100dvh - 40px);overflow:auto;text-align:center;padding:30px;border-radius:24px;background:#f7fbfd;border:1px solid #a9c9d9;box-shadow:0 26px 90px #001b3e66}.receipt-symbol{display:grid;place-items:center;margin:0 auto 16px;width:64px;height:64px;border-radius:20px;background:#d8eee8;color:#116c52;font-size:32px;font-weight:800}.receipt-modal[data-error=true] .receipt-symbol{background:#f8dfe4;color:#9d2444}.receipt-modal h2{margin:0;font-size:25px;line-height:1.25}.receipt-modal p{color:#3d5c70}.receipt-modal .school-logo{width:54px;height:54px;margin-bottom:16px}@media(max-width:480px){header{padding:20px;gap:12px}.school-logo{width:54px;height:54px}h1{font-size:21px}form,.receipt-summary,.receipt-modal{padding:22px}.receipt-actions>*{width:100%}}
</style><script src="${base}/client.js" defer></script></head><body><main data-receipt-base="${base}/${id}" data-language="${fr?'fr':'en'}"><header><img class="school-logo" src="/icons/nexus-192.png" width="68" height="68" alt="Kinshasa Christian School"><div><strong>KINSHASA CHRISTIAN SCHOOL</strong><h1>${title}</h1></div></header><div id="receipt-notice" class="receipt-summary" role="status">${tr('Vérification du lien sécurisé…','Checking your secure link…')}</div><form id="receipt-form" method="post" action="${base}/${id}?lang=${fr?'fr':'en'}" hidden><input type="hidden" name="token" id="receipt-token"><input type="hidden" name="formVersion" value="2"><input type="hidden" name="confirmed" value="yes"><p>${tr('Veuillez confirmer uniquement les éléments que vous avez réellement reçus.','Please confirm only what you have actually received.')}</p><label><input type="checkbox" name="emailReceived" value="yes" required><span>${tr('Je confirme avoir reçu cet e-mail.','I confirm that I received this email.')}</span></label><label id="receipt-attachment"><input type="checkbox" name="pdfReceived" value="yes" required><span>${attachment}</span></label><button id="receipt-submit" type="submit" disabled>${tr('Confirmer la réception','Confirm receipt')}</button><small>${tr('Votre confirmation est enregistrée une seule fois. Elle ne modifie aucun résultat scolaire.','Your acknowledgement is recorded once. It does not change any academic result.')}</small></form><noscript><div class="receipt-summary">${tr('Activez JavaScript puis rouvrez le lien depuis votre mail pour confirmer sa réception.','Enable JavaScript and reopen the link from your email to confirm receipt.')}</div></noscript></main><div id="receipt-overlay" class="receipt-overlay" hidden><section class="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title" aria-describedby="receipt-description" tabindex="-1"><img class="school-logo" src="/icons/nexus-192.png" width="54" height="54" alt="KCS"><div id="receipt-symbol" class="receipt-symbol" aria-hidden="true">✓</div><h2 id="receipt-title"></h2><p id="receipt-description"></p><p id="receipt-countdown" role="status"></p><div class="receipt-actions"><a id="receipt-return" class="button" rel="noreferrer" hidden></a><button id="receipt-retry" type="button" hidden></button><button id="receipt-stay" class="secondary" type="button"></button></div></section></div></body></html>`
}
export const receiptClientScript=String.raw`(()=>{
'use strict';
const root=document.querySelector('[data-receipt-base]');if(!root)return;
const fr=root.dataset.language==='fr',tr=(a,b)=>fr?a:b,base=root.dataset.receiptBase,token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
const get=id=>document.getElementById(id),form=get('receipt-form'),notice=get('receipt-notice'),submit=get('receipt-submit'),overlay=get('receipt-overlay'),modal=overlay.querySelector('.receipt-modal');
let busy=false,hasAttachment=true,timer=null,seconds=5;
const stop=()=>{if(timer)clearInterval(timer);timer=null;get('receipt-countdown').textContent=''};
get('receipt-stay').addEventListener('click',()=>{stop();overlay.hidden=true;root.inert=false});
get('receipt-return').addEventListener('click',stop);
get('receipt-retry').addEventListener('click',()=>{overlay.hidden=true;root.inert=false;void load()});
form.addEventListener('change',()=>{submit.disabled=busy||!form.elements.emailReceived.checked||(hasAttachment&&!form.elements.pdfReceived.checked)});
async function request(path,body){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
 try{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'omit',signal:controller.signal});const json=await r.json();if(!r.ok||!json.success)throw Error(String(r.status));return json.data}
 finally{clearTimeout(timeout)}
}
function showError(){
 stop();modal.dataset.error='true';get('receipt-symbol').textContent='!';get('receipt-title').textContent=tr('Confirmation à vérifier','Acknowledgement needs checking');
 get('receipt-description').textContent=tr('Le lien est incomplet ou la connexion a été interrompue. Rouvrez le lien depuis votre mail ou vérifiez son état ci-dessous.','The link is incomplete or the connection was interrupted. Reopen it from your email or check its status below.');
 get('receipt-return').hidden=true;get('receipt-retry').hidden=!/^[a-f0-9]{64}$/.test(token);get('receipt-retry').textContent=tr('Vérifier l’état','Check status');get('receipt-stay').textContent=tr('Fermer','Close');root.inert=true;overlay.hidden=false;modal.focus();
}
function showSuccess(data,already){
 stop();form.hidden=true;modal.dataset.error='false';get('receipt-symbol').textContent='✓';
 const title=already?tr('Réception déjà confirmée','Receipt already confirmed'):tr('Réception confirmée','Receipt confirmed');
 get('receipt-title').textContent=title;
 let date='';try{date=new Intl.DateTimeFormat(fr?'fr-FR':'en-GB',{dateStyle:'long',timeStyle:'short',timeZone:'Africa/Kinshasa'}).format(new Date(data.confirmedAt))}catch{}
 const text=(already?tr('Cette réception a déjà été enregistrée. Aucune nouvelle confirmation ne sera ajoutée.','This acknowledgement is already recorded. No duplicate will be added.'):tr('Merci. Votre confirmation a bien été enregistrée auprès de KCS.','Thank you. KCS has recorded your acknowledgement.'))+(date?' · '+date:'');
 get('receipt-description').textContent=text;notice.textContent=title+' · '+text;notice.hidden=false;get('receipt-retry').hidden=true;get('receipt-stay').textContent=tr('Rester sur cette page','Stay on this page');
 const origins=['https://mail.google.com','https://mail.yahoo.com','https://outlook.live.com','https://www.icloud.com','https://mail.proton.me','https://mail.aol.com'];let inbox=null;
 try{const u=new URL(data.inboxUrl);if(origins.includes(u.origin)&&!u.username&&!u.password)inbox=u.href}catch{}
 const back=get('receipt-return');back.hidden=!inbox;back.textContent=tr('Retour à ma messagerie','Return to my mailbox');if(inbox)back.href=inbox;
 root.inert=true;overlay.hidden=false;modal.focus();
 if(inbox){seconds=5;const tick=()=>{get('receipt-countdown').textContent=tr('Retour à votre messagerie dans ','Returning to your mailbox in ')+seconds+' s.';if(seconds--<=0){stop();location.replace(inbox)}};tick();timer=setInterval(tick,1000)}
}
async function load(){
 if(busy)return;busy=true;submit.disabled=true;
 try{if(!/^[a-f0-9]{64}$/.test(token))throw Error('TOKEN');const data=await request('/status',{token});if(data.confirmedAt){showSuccess(data,true);return}
 hasAttachment=data.hasAttachment;form.elements.token.value=token;get('receipt-attachment').hidden=!hasAttachment;form.elements.pdfReceived.required=hasAttachment;notice.hidden=true;form.hidden=false;
 }catch{showError()}finally{busy=false;submit.disabled=!form.elements.emailReceived.checked||(hasAttachment&&!form.elements.pdfReceived.checked)}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!form.reportValidity())return;busy=true;submit.disabled=true;
 try{const data=await request('?lang='+(fr?'fr':'en'),{token,confirmed:'yes',formVersion:'2',emailReceived:form.elements.emailReceived.checked?'yes':undefined,pdfReceived:hasAttachment&&form.elements.pdfReceived.checked?'yes':undefined});if(!data.confirmedAt)throw Error('UNCONFIRMED');showSuccess(data,data.alreadyConfirmed)}
 catch{showError()}finally{busy=false;submit.disabled=false}
});
void load();
})();`
