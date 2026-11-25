import { useEffect, useRef, useState } from 'react';
import { Save, Send, ArrowLeft, ShieldCheck, Download } from 'lucide-react';
import { api, send, ApiError } from './api';
import { draftsUnlocked, enqueue, synchronize, newestDraft, discardQueue } from './offline';
import { useUI, Loading, PageHead, Field, Status, Progress, Modal } from './ui';
type Mark = {
    criterionId: string;
    kind: 'SCORED' | 'UNSCORED' | 'NOT_APPLICABLE';
    points: string | null;
    comment: string;
};
export function Evaluation({ assignmentId }: {
    assignmentId: string;
}) {
    const { t, notify, confirm } = useUI(), [sheet, setSheet] = useState<any>(null), [marks, setMarks] = useState<Mark[]>([]), [comment, setComment] = useState(''), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [serverResult, setServerResult] = useState<any>(null), [conflict, setConflict] = useState<any>(null);
    const revision = useRef(0), dirty = useRef(false), form = useRef({ marks, comment }), saving = useRef<Promise<void> | null>(null), saveRef = useRef<() => void>(() => { }), mounted = useRef(false);
    form.current = { marks, comment };
    const load = async () => { const current = await api('/assignments/' + assignmentId); if (!mounted.current)
        return; revision.current = current.evaluation.revision; setSheet(current); let pending = null; try {
        pending = await newestDraft(assignmentId);
    }
    catch { } const local = pending || current.evaluation; setMarks(current.rubric.criteria.filter((c: any) => !current.rubric.criteria.some((p: any) => p.parentId === c.id) && (c.applicability === 'BOTH' || c.applicability === current.assignment.scope) && (!current.assignment.criterionIds.length || current.assignment.criterionIds.includes(c.id))).map((c: any) => { const m = local.marks?.find((m: any) => m.criterionId === c.id); return { criterionId: c.id, kind: m?.kind || 'UNSCORED', points: m?.points == null ? null : String(m.points), comment: m?.comment || '' }; })); setComment(local.comment || ''); dirty.current = false; setStatus(pending ? t('Encrypted local changes await synchronization.', 'Modifications locales chiffrées en attente de synchronisation.') : current.evaluation.id ? t('Loaded from the server.', 'Chargé depuis le serveur.') : t('Not saved yet.', 'Pas encore enregistré.')); };
    useEffect(() => { mounted.current = true; void load().catch(e => notify(e.message, true)); const ack = (e: Event) => { const d = (e as CustomEvent).detail; if (d.assignmentId !== assignmentId)
        return; revision.current = Math.max(revision.current, d.revision); setServerResult(d.result); setSheet((old: any) => old ? { ...old, evaluation: { ...old.evaluation, revision: d.revision, status: d.status } } : old); setStatus(t('Server confirmed · ', 'Serveur confirmé · ') + new Date(d.serverSavedAt).toLocaleTimeString()); }; const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
    } }; addEventListener('jury:draft-ack', ack); addEventListener('keydown', key); return () => { mounted.current = false; removeEventListener('jury:draft-ack', ack); removeEventListener('keydown', key); }; }, [assignmentId]);
    const save = async (submit = false): Promise<void> => { if (!sheet?.canEdit || sheet.evaluation.status === 'SUBMITTED')
        return; if (saving.current) {
        await saving.current;
        if (submit)
            return save(true);
        return;
    } const snapshot = JSON.parse(JSON.stringify(form.current)); const job = (async () => { setBusy(true); try {
        if (draftsUnlocked()) {
            await enqueue(assignmentId, { ...snapshot, submit }, revision.current);
            if (JSON.stringify(snapshot) === JSON.stringify(form.current))
                dirty.current = false;
            setStatus(t('Encrypted locally · awaiting server confirmation', 'Chiffré localement · en attente de confirmation serveur'));
            if (navigator.onLine) {
                const result = await synchronize();
                if (result.conflict)
                    setConflict({ message: result.conflict.message, local: await newestDraft(assignmentId) });
                else if (!result.remaining)
                    setStatus(t('All pending changes confirmed by the server.', 'Toutes les modifications sont confirmées par le serveur.'));
            }
        }
        else {
            if (!navigator.onLine)
                throw Error(t('Keep this window open and reconnect. Secure local drafts are unavailable.', 'Gardez cette fenêtre ouverte et reconnectez-vous. Les brouillons locaux sécurisés sont indisponibles.'));
            const result = await send('/assignments/' + assignmentId, { ...snapshot, revision: revision.current, requestId: crypto.randomUUID(), submit }, 'PUT');
            revision.current = result.revision;
            setServerResult(result.result);
            setSheet((old: any) => ({ ...old, evaluation: { ...old.evaluation, ...result } }));
            if (JSON.stringify(snapshot) === JSON.stringify(form.current))
                dirty.current = false;
            setStatus(t('Server confirmed · ', 'Serveur confirmé · ') + new Date(result.serverSavedAt).toLocaleTimeString());
        }
    }
    catch (e) {
        if (e instanceof ApiError && e.status === 409)
            setConflict({ message: e.message, local: snapshot });
        else {
            setStatus(t('Not confirmed by the server. Your open window and encrypted drafts are preserved.', 'Non confirmé par le serveur. Votre fenêtre ouverte et vos brouillons chiffrés sont conservés.'));
            if (submit)
                notify((e as Error).message, true);
        }
    }
    finally {
        setBusy(false);
    } })(); saving.current = job; try {
        await job;
    }
    finally {
        saving.current = null;
    } };
    saveRef.current = () => void save(false);
    useEffect(() => { if (!dirty.current)
        return; const timer = setTimeout(() => void save(false), 1300); return () => clearTimeout(timer); }, [marks, comment]);
    useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
    } }; addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn); }, []);
    const change = (id: string, key: string, value: any) => { dirty.current = true; setMarks(rows => rows.map(m => m.criterionId === id ? { ...m, [key]: value, ...(key === 'points' ? { kind: value === null || value === '' ? 'UNSCORED' : 'SCORED', points: value === null || value === '' ? null : value } : key === 'kind' && value !== 'SCORED' ? { points: null } : {}) } : m)); };
    const submit = async () => { if (await confirm({ title: t('Submit this independent evaluation?', 'Soumettre cette évaluation indépendante ?'), body: t('Required criteria are checked on the server. Submitted marks need an authorized reopening to change. Offline submission is only queued.', 'Le serveur vérifie les critères requis. Les notes soumises demandent une réouverture autorisée. Hors ligne, la soumission reste seulement en attente.') }))
        await save(true); };
    const reconcile = async (overwrite: boolean) => { try {
        const local = conflict.local || await newestDraft(assignmentId), current = await api('/assignments/' + assignmentId);
        if (overwrite) {
            if (!await confirm({ title: t('Prepare your local version again?', 'Préparer à nouveau votre version locale ?'), body: t('The latest server revision will be used. You must explicitly save again. Submitted evaluations require reopening first.', 'La dernière version du serveur sera utilisée. Vous devrez enregistrer à nouveau. Les évaluations soumises doivent d’abord être réouvertes.') }))
                return;
            if (current.evaluation.status === 'SUBMITTED')
                throw Error(t('Request an authorized reopening first.', 'Demandez d’abord une réouverture autorisée.'));
            await discardQueue(assignmentId);
            revision.current = current.evaluation.revision;
            setSheet(current);
            setMarks(local.marks);
            setComment(local.comment || '');
            dirty.current = true;
            setConflict(null);
        }
        else {
            if (!await confirm({ title: t('Discard pending local operations?', 'Abandonner les opérations locales en attente ?'), body: t('The server version will be retained. Download your local copy first if needed.', 'La version du serveur sera conservée. Téléchargez votre copie locale au préalable si nécessaire.'), danger: true }))
                return;
            await discardQueue(assignmentId);
            setConflict(null);
            await load();
        }
    }
    catch (e) {
        notify((e as Error).message, true);
    } };
    if (!sheet)
        return <Loading />;
    const criteria = sheet.rubric.criteria.filter((c: any) => marks.some(m => m.criterionId === c.id)), completed = marks.filter(m => m.kind !== 'UNSCORED').length, editable = sheet.canEdit && sheet.evaluation.status !== 'SUBMITTED';
    return <><PageHead eyebrow={t('Independent jury workspace', 'Espace du jury indépendant')} title={sheet.rubric.title} detail={t('0 is a real score. A blank is unscored. Only server confirmation proves persistence.', '0 est une vraie note. Une case vide est non cotée. Seule la confirmation du serveur atteste l’enregistrement.')}><a className="link" href="#/evaluations"><ArrowLeft size={15}/> {t('My evaluations', 'Mes évaluations')}</a></PageHead><div className="scoring-layout"><section className="stack">
    {criteria.map((c: any) => { const m = marks.find(m => m.criterionId === c.id)!; return <article className="criterion-card" key={c.id}><div className="criterion-heading"><div><h2>{c.name}</h2><small>{t('Relative weight', 'Poids relatif')} {c.weight} · {c.mandatory ? t('Required', 'Obligatoire') : t('Optional · explicit N/A allowed', 'Facultatif · N/A explicite autorisé')}</small></div><Status value={m.kind === 'SCORED' ? 'COMPLETE' : m.kind === 'NOT_APPLICABLE' ? 'EXCUSED' : 'PENDING'}/></div>{c.description && <p>{c.description}</p>}<div className="criterion-score"><div className="stack">{c.instructions && <p>{c.instructions}</p>}{c.levels?.length > 0 && <div className="stack">{c.levels.map((l: any) => <small key={l.id}><b>{l.label}</b> · {l.minimum}–{l.maximum} · {l.description}</small>)}</div>}{!c.mandatory && <label className="check"><input disabled={!editable} type="checkbox" checked={m.kind === 'NOT_APPLICABLE'} onChange={e => change(c.id, 'kind', e.target.checked ? 'NOT_APPLICABLE' : 'UNSCORED')}/>{t('Not applicable', 'Non applicable')}</label>}</div><Field label={t('Score / ', 'Note / ') + c.maximum}><input className="score-input" aria-label={c.name + ' ' + t('score', 'note')} disabled={!editable || m.kind === 'NOT_APPLICABLE'} type="number" min={0} max={c.maximum} step="any" inputMode="decimal" value={m.points ?? ''} onChange={e => change(c.id, 'points', e.target.value)} onKeyDown={e => { if (['ArrowDown', 'Enter', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        const inputs = [...document.querySelectorAll<HTMLInputElement>('.score-input:not(:disabled)')], i = inputs.indexOf(e.currentTarget);
        inputs[i + (e.key === 'ArrowUp' ? -1 : 1)]?.focus();
    } }}/></Field></div><Field label={c.commentRule === 'ALWAYS' ? t('Evidence comment (required)', 'Commentaire justificatif (obligatoire)') : c.commentRule === 'BELOW_THRESHOLD' ? t('Comment required below ', 'Commentaire obligatoire sous ') + c.commentThreshold + '%' : t('Evidence / feedback', 'Justification / retour')}><textarea disabled={!editable} value={m.comment} onChange={e => change(c.id, 'comment', e.target.value)} maxLength={3000}/></Field></article>; })}<section className="panel"><Field label={t('Overall jury feedback', 'Commentaire général du juge')}><textarea aria-label={t('Overall jury feedback', 'Commentaire général du juge')} disabled={!editable} value={comment} onChange={e => { dirty.current = true; setComment(e.target.value); }} maxLength={8000}/></Field></section></section><aside className="scoring-sidebar"><section className="panel stack"><span className="eyebrow">{t('Last server-calculated total', 'Dernier total calculé au serveur')}</span><div className="scoring-total">{serverResult?.total ?? sheet.evaluation.total ?? '—'}<small> / {sheet.rubric.maximum}</small></div><Status value={sheet.evaluation.status}/><Progress value={marks.length ? completed / marks.length * 100 : 0} label={t('Criteria completed', 'Critères complétés')}/><small>{t('The final total is validated on the server.', 'Le total officiel est validé au serveur.')}</small></section><section className="panel stack"><ShieldCheck size={24}/><h3>{t('Persistence status', 'État de l’enregistrement')}</h3><p aria-live="polite">{status}</p><small>{t('Revision', 'Version')} {revision.current} · {navigator.onLine ? t('Connected', 'Connecté') : t('Offline', 'Hors ligne')}</small>{!editable && <small>{t('Read-only. Changes require an authorized reopening.', 'Lecture seule. Une modification demande une réouverture autorisée.')}</small>}{sheet.evaluation.id && sheet.evaluation.status === 'SUBMITTED' && <button onClick={() => void confirm({ title: t('Request reopening', 'Demander une réouverture'), body: t('Explain the correction. An organizer must authorize it.', 'Expliquez la correction. Un responsable devra l’autoriser.'), reason: true }).then(v => v && send('/evaluations/' + sheet.evaluation.id + '/reopen-request', { reason: v.reason })).then(v => { if (v)
        notify(t('Reopening request recorded.', 'Demande de réouverture enregistrée.')); }).catch(e => notify(e.message, true))}>{t('Request reopening', 'Demander une réouverture')}</button>}</section></aside></div>{editable && <div className="sticky-actions actions spread"><small>{busy ? t('Saving…', 'Enregistrement…') : status}</small><div className="actions"><button disabled={busy} onClick={() => void save(false)}><Save size={16}/>{t('Save draft', 'Enregistrer le brouillon')}</button><button className="primary" disabled={busy || completed < marks.length} onClick={() => void submit()}><Send size={16}/>{t('Submit evaluation', 'Soumettre l’évaluation')}</button></div></div>}{conflict && <Modal wide title={t('Reconcile your versions', 'Réconcilier vos versions')} onClose={() => setConflict(null)}><div className="stack"><div className="banner warning">{conflict.message}</div><p>{t('Your encrypted local copy is preserved. No newer server mark was overwritten.', 'Votre copie locale chiffrée est conservée. Aucune note plus récente du serveur n’a été écrasée.')}</p><button onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(conflict.local, null, 2)], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = 'KCS-Jury-local-draft.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }}><Download size={15}/>{t('Download my local copy', 'Télécharger ma copie locale')}</button><div className="actions end"><button onClick={() => void reconcile(false)}>{t('Keep server version', 'Conserver la version du serveur')}</button><button className="primary" onClick={() => void reconcile(true)}>{t('Prepare my local version', 'Préparer ma version locale')}</button></div></div></Modal>}</>;
}
