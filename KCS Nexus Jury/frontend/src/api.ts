import {juryErrorMessage} from './errors'
export type Session = {
    reference: string;
    name: string;
    avatar?: string | null;
    userId: string | null;
    memberId: string | null;
    studentId: string | null;
    csrfToken: string;
    nexusUrl: string;
    serverUtc: string;
    environment: string;
    offlineDraftsConfigured: boolean;
    roles: Record<string, boolean>;
};
export class ApiError extends Error {
    constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const API = (import.meta.env.VITE_JURY_API_URL || new URL('api/', document.baseURI).href).replace(/\/$/, '');
let session: Session | null = null;
export const setApiSession = (value: Session | null) => { session = value; };
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> { const headers = new Headers(options.headers); if (!(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json'); if (session) {
    headers.set('X-Jury-CSRF', session.csrfToken);
    headers.set('X-Jury-Actor', session.reference);
} let response: Response; try {
    response = await fetch(API + path, { ...options, credentials: 'include', cache: 'no-store', headers, signal: options.signal || AbortSignal.timeout(options.body instanceof FormData ? 120000 : 25000) });
}
catch {
    throw new ApiError(0, 'NETWORK_UNAVAILABLE', 'The server could not be reached. / Le serveur est momentanément inaccessible.');
} const body = await response.json().catch(() => ({})); if (!response.ok || body.success === false)
    throw new ApiError(response.status, body.code || 'REQUEST_FAILED', juryErrorMessage(body.code||'REQUEST_FAILED',body.message), body.details); return body.data as T; }
export const send = (path: string, body: unknown, method = 'POST') => api(path, { method, body: JSON.stringify(body) });
export async function download(path: string, filename?: string) { const response = await fetch(API + path, { credentials: 'include', cache: 'no-store', headers: session ? { 'X-Jury-Actor': session.reference } : {} }); if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.code || 'DOWNLOAD_FAILED', juryErrorMessage(body.code||'DOWNLOAD_FAILED',body.message));
} const blob = await response.blob(), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename || response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'KCS-Nexus-Jury.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
