// Compatibility for previously cached EduPay pages. New pages manage update consent in React.
if('serviceWorker' in navigator){const base=new URL('.',document.currentScript?.src||location.href);window.addEventListener('load',()=>{void navigator.serviceWorker.register(new URL('sw.js',base),{updateViaCache:'none'}).catch(()=>{});});}
