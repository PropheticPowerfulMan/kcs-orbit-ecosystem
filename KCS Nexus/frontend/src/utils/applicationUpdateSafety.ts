const pendingNexusWrites=new Set<string>();
let sequence=0;
export const getPendingNexusWrites=()=>pendingNexusWrites.size;
function publish(){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('nexus:write-state',{detail:pendingNexusWrites.size}));}
export function beginNexusWrite(existing?:string){const key=existing||'request-'+(++sequence);if(!pendingNexusWrites.has(key)){pendingNexusWrites.add(key);publish();}return key;}
export function finishNexusWrite(key?:string){if(key&&pendingNexusWrites.delete(key))publish();}
