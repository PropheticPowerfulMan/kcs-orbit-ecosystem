import {juryLabel} from './labels'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, ArrowUpRight, ChevronRight } from 'lucide-react';
type Confirm = {
    title: string;
    body: string;
    danger?: boolean;
    reason?: boolean;
    approve?: string;
};
type UI = {
    language: 'en' | 'fr';
    setLanguage: (v: 'en' | 'fr') => void;
    t: (en: string, fr: string) => string;
    notify: (text: string, error?: boolean) => void;
    confirm: (options: Confirm) => Promise<{
        reason: string;
    } | null>;
};
const Context = createContext<UI>(null!);
export const useUI = () => useContext(Context);
export function UIProvider({ children }: {
    children: React.ReactNode;
}) { const [language, setLang] = useState<'en' | 'fr'>(localStorage.getItem('jury-language') === 'fr' ? 'fr' : 'en'), [notice, setNotice] = useState<{
    text: string;
    error: boolean;
} | null>(null), [prompt, setPrompt] = useState<Confirm | null>(null), resolve = useRef<((v: {
    reason: string;
} | null) => void) | null>(null), [reason, setReason] = useState(''); const t = (en: string, fr: string) => language === 'fr' ? fr : en; const setLanguage = (v: 'en' | 'fr') => { setLang(v); localStorage.setItem('jury-language', v); document.documentElement.lang = v; }; const confirm = (p: Confirm) => { if (resolve.current)
    resolve.current(null); setReason(''); setPrompt(p); return new Promise<{
    reason: string;
} | null>(r => { resolve.current = r; }); }; const close = (v: {
    reason: string;
} | null) => { resolve.current?.(v); resolve.current = null; setPrompt(null); }; return <Context.Provider value={{ language, setLanguage, t, notify: (text, error = false) => setNotice({ text, error }), confirm }}>{children}{prompt && <Modal title={prompt.title} onClose={() => close(null)}><p>{prompt.body}</p>{prompt.reason && <Field label={t('Reason (at least 8 characters)', 'Motif (8 caractères minimum)')}><textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} maxLength={2000}/></Field>}<div className="actions end"><button onClick={() => close(null)}>{t('Cancel', 'Annuler')}</button><button className={prompt.danger ? 'danger' : 'primary'} disabled={prompt.reason && reason.trim().length < 8} onClick={() => close({ reason: reason.trim() })}>{prompt.approve || t('Confirm', 'Confirmer')}</button></div></Modal>}{notice && <Modal title={notice.error ? t('Operation could not be completed', 'Opération non aboutie') : t('Operation completed', 'Opération effectuée')} onClose={() => setNotice(null)}><div className={'notice ' + (notice.error ? 'error' : 'success')}>{notice.error ? <AlertCircle size={30}/> : <CheckCircle2 size={30}/>}<p>{notice.text}</p></div><div className="actions end"><button className="primary" onClick={() => setNotice(null)}>{t('Close', 'Fermer')}</button></div></Modal>}</Context.Provider>; }
export function Modal({ title, children, onClose, wide = false }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    wide?: boolean;
}) { const {t}=useUI(); const ref = useRef<HTMLDialogElement>(null), closeRef = useRef(onClose); closeRef.current = onClose; useEffect(() => { const d = ref.current!; d.showModal(); const cancel = (e: Event) => { e.preventDefault(); closeRef.current(); }; d.addEventListener('cancel', cancel); return () => { d.removeEventListener('cancel', cancel); d.close(); }; }, []); return <dialog ref={ref} className={'modal ' + (wide ? 'wide' : '')} aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon" onClick={onClose} aria-label={t('Close','Fermer')}><X size={20}/></button></div><div className="modal-body">{children}</div></dialog>; }
export function Field({ label, children, hint }: {
    label: string;
    children: React.ReactNode;
    hint?: string;
}) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Empty({ title, detail }: {
    title: string;
    detail?: string;
}) { return <div className="empty"><div className="empty-symbol">✦</div><h3>{title}</h3>{detail && <p>{detail}</p>}</div>; }
export function Loading() { const { t } = useUI(); return <div className="loading" role="status"><Loader2 className="spin" size={22}/>{t('Loading institutional records…', 'Chargement des données institutionnelles…')}</div>; }
export function Status({ value }: {
    value: string;
}) { const { t } = useUI(); const labels: Record<string, [
    string,
    string
]> = { DRAFT: ['Draft', 'Brouillon'], REGISTRATION_OPEN: ['Registration open', 'Inscriptions ouvertes'], SUBMISSION_OPEN: ['Submissions open', 'Dépôts ouverts'], SCHEDULED: ['Scheduled', 'Programmé'], EVALUATION_IN_PROGRESS: ['Evaluating', 'Évaluation en cours'], EVALUATION_CLOSED: ['Evaluation closed', 'Évaluation clôturée'], RESULTS_PENDING_VALIDATION: ['Awaiting validation', 'En attente de validation'], APPROVED: ['Approved', 'Approuvé'], PUBLISHED: ['Published', 'Publié'], ARCHIVED: ['Archived', 'Archivé'], CANCELLED: ['Cancelled', 'Annulé'], REOPENED: ['Reopened', 'Réouvert'], SUBMITTED: ['Submitted', 'Soumis'], COMPLETE: ['Complete', 'Complet'], INCOMPLETE: ['Incomplete', 'Incomplet'], VERIFIED: ['Verified', 'Vérifié'], PENDING: ['Pending', 'En attente'], PRESENT: ['Present', 'Présent'], ABSENT: ['Absent', 'Absent'], LATE: ['Late', 'En retard'], EXCUSED: ['Excused', 'Excusé'], DISQUALIFIED: ['Disqualified', 'Disqualifié'], ACTIVE: ['Active', 'Actif'], ACCEPTED: ['Accepted', 'Accepté'], INVITED: ['Invited', 'Invité'], REVOKED: ['Revoked', 'Révoqué'] }; return <span className={'status ' + value.toLowerCase()}>{labels[value] ? t(...labels[value]) : juryLabel(value,t)}</span>; }
export function PageHead({ eyebrow, title, detail, children }: {
    eyebrow: string;
    title: string;
    detail?: string;
    children?: React.ReactNode;
}) { return <header className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{children && <div className="actions">{children}</div>}</header>; }
export function Stat({ label, value, detail, icon }: {
    label: string;
    value: React.ReactNode;
    detail?: string;
    icon?: React.ReactNode;
}) { return <article className="stat"><div><span>{label}</span>{icon}</div><strong>{value}</strong>{detail && <small>{detail}</small>}</article>; }
export function Progress({ value, label }: {
    value: number;
    label: string;
}) { return <div className="progress" aria-label={label}><span><b>{label}</b><em>{Math.round(value)}%</em></span><div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><i style={{ width: Math.max(0, Math.min(100, value)) + '%' }}/></div></div>; }
export function Distribution({ values }: {
    values: number[];
}) { const { t } = useUI(); if (!values.length)
    return <Empty title={t('No validated scores yet', 'Aucun résultat validé')}/>; const bins = [0, 20, 40, 60, 80].map((v, i) => values.filter(n => n >= v && (i === 4 ? n <= 100 : n < v + 20)).length), max = Math.max(1, ...bins); return <figure className="distribution"><figcaption>{t('Score distribution', 'Distribution des résultats')}</figcaption><div>{bins.map((count, i) => <div key={i} title={count + ' ' + t('learners', 'élèves')}><b>{count}</b><i style={{ height: Math.max(3, count / max * 130) }}/><span>{i * 20}–{i * 20 + 20}%</span></div>)}</div></figure>; }
