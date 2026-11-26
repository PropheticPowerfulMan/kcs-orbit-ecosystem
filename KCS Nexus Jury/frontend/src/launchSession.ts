import {api, send, ApiError, type Session} from './api';
type Identity = {name:string;reference:string;currentName:string|null};
type Pending = {kind:string;value:string|null;reference?:string};
let request: Promise<Session> | null = null, pending: Pending | null = null;
export function resetSessionRequest() { request = null; pending = null; }
export function retrySessionRequest() { request = null; }
export function initialSession(confirmIdentity: (identity:Identity)=>Promise<boolean>): Promise<Session> {
    if (request) return request;
    const path = location.hash.slice(1).split('?')[0];
    if (path === '/sso' || path === '/invitation') {
        const fragment = new URLSearchParams(location.hash.split('?')[1] || '');
        pending = {kind:path,value:fragment.get(path === '/sso' ? 'ticket' : 'token')};
        // Keep the capability only in this page's memory, never in logs or storage.
        history.replaceState(null, '', location.pathname + location.search + '#/');
    }
    request = (async () => {
        const launch = pending;
        if (!launch) return api<Session>('/session');
        if (launch.kind === '/invitation') {
            const result = await send('/invitations/exchange', {token:launch.value});
            pending = null; return result;
        }
        if (!launch.reference) {
            const identity = await send('/session/preview', {ticket:launch.value});
            if (!await confirmIdentity(identity)) { pending = null; throw Error('Sign-in cancelled. / Connexion annulée.'); }
            launch.reference = identity.reference;
        }
        try {
            const result = await send('/session/exchange', {ticket:launch.value,confirmedReference:launch.reference});
            pending = null; return result;
        } catch (error) {
            // A lost response can leave a valid cookie. Never substitute another identity.
            if (error instanceof ApiError && (error.status === 0 || ['TICKET_EXPIRED','TICKET_ALREADY_USED','INVALID_RESPONSE'].includes(error.code))) {
                const current = await api<Session>('/session').catch(() => null);
                if (current?.reference === launch.reference) { pending = null; return current; }
            }
            throw error;
        }
    })().catch(error => { request = null; throw error; });
    return request;
}
