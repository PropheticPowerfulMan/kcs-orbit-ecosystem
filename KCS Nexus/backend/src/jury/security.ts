import { createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { ApiError } from '../utils/api.js';
export class JuryError extends ApiError {
    constructor(public code: string, message: string, status = 400, public details?: unknown) { super(status, message); }
}
export const token = () => randomBytes(32).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function stable(value: any): string { if (Array.isArray(value))
    return '[' + value.map(stable).join(',') + ']'; if (value && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}'; return JSON.stringify(value) ?? 'null'; }
export const checksum = (value: unknown) => digest(stable(value));
export const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
export function publicBase() { const u = new URL(process.env.JURY_PUBLIC_URL || 'http://localhost:5179/jury/'); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
    throw new Error('Jury public URL is invalid'); return u.href.endsWith('/') ? u.href : u.href + '/'; }
export function returnBase() { const u = new URL(process.env.JURY_NEXUS_URL || process.env.FRONTEND_URL || 'https://kinshasachristianschool.org/'); return u.href.replace(/\/$/, ''); }
export function trustedOrigin(origin: string | undefined) { if (!origin)
    return false; return [new URL(publicBase()).origin, new URL(returnBase()).origin].includes(origin); }
export function cookieToken(header: string | undefined) { try {
    return decodeURIComponent((header || '').split(';').map(s => s.trim()).find(s => s.startsWith('kcs_jury_session='))?.slice(17) || '');
}
catch {
    return '';
} }
export function sessionCookie(value: string, expiresAt: Date) { const path = process.env.JURY_COOKIE_PATH || new URL(publicBase()).pathname; return 'kcs_jury_session=' + encodeURIComponent(value) + '; Path=' + path + '; HttpOnly; SameSite=Lax; ' + (new URL(publicBase()).protocol === 'https:' ? 'Secure; ' : '') + 'Expires=' + expiresAt.toUTCString(); }
function master() { const raw = process.env.JURY_DRAFT_MASTER_KEY || ''; const key = Buffer.from(raw, 'base64'); if (key.length !== 32)
    throw new JuryError('DRAFT_KEY_UNAVAILABLE', 'Secure local drafts are not configured.', 503); return key; }
export function wrapKey(value: Buffer) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', master(), iv), bytes = Buffer.concat([cipher.update(value), cipher.final()]); return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), bytes.toString('base64')].join(':'); }
export function unwrapKey(value: string) { const [v, iv, tag, bytes] = value.split(':'); if (v !== 'v1')
    throw new JuryError('DRAFT_KEY_INVALID', 'The protected draft key cannot be read.', 503); const decipher = createDecipheriv('aes-256-gcm', master(), Buffer.from(iv, 'base64')); decipher.setAuthTag(Buffer.from(tag, 'base64')); return Buffer.concat([decipher.update(Buffer.from(bytes, 'base64')), decipher.final()]); }
export function safeFilename(value: string) { return value.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || 'KCS Jury document'; }
export function httpsLink(value: string) { if (!value)
    return ''; let u: URL; try {
    u = new URL(value);
}
catch {
    throw new JuryError('INVALID_LINK', 'Enter a valid HTTPS link.');
} ; if (u.protocol !== 'https:' || u.username || u.password)
    throw new JuryError('INVALID_LINK', 'Only HTTPS links without embedded credentials are allowed.'); return u.href; }
export function spreadsheetCell(value: unknown) { const s = String(value ?? ''); return /^[=+@\-\t\r]/.test(s) ? "'" + s : s; }
