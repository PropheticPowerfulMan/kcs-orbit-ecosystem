export function receiptMailbox(email:string|null):string|null{
 const domain=(email||'').trim().toLowerCase().split('@')[1]
 if(['gmail.com','googlemail.com'].includes(domain))return 'https://mail.google.com/mail/?authuser='+encodeURIComponent(email!)
 if(['yahoo.com','yahoo.fr','yahoo.co.uk','ymail.com','rocketmail.com'].includes(domain))return 'https://mail.yahoo.com/'
 if(['outlook.com','outlook.fr','hotmail.com','hotmail.fr','live.com','live.fr','msn.com'].includes(domain))return 'https://outlook.live.com/mail/0/inbox'
 if(['icloud.com','me.com','mac.com'].includes(domain))return 'https://www.icloud.com/mail/'
 if(['proton.me','protonmail.com','pm.me'].includes(domain))return 'https://mail.proton.me/'
 if(domain==='aol.com')return 'https://mail.aol.com/'
 return null
}
