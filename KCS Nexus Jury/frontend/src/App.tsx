import {LearnerHome,LearnerProject} from './LearnerWorkspace'
import {HomeAnalytics} from './HomeAnalytics'
import {juryLabel} from './labels'
import type {LucideIcon} from 'lucide-react'
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, FolderKanban, ClipboardCheck, BookOpen, FileText, Settings, PanelLeftClose, PanelLeftOpen, Menu, X, Globe, Sun, Moon, LogOut, ArrowUpRight, Plus, Download, RefreshCw, ShieldCheck, Users, CalendarDays, Award } from 'lucide-react';
import { api, send, setApiSession, type Session } from './api';
import { unlockDrafts, lockDrafts, queued, synchronize } from './offline';
import { UIProvider, useUI, Modal, Loading, Empty, PageHead, Stat, Status } from './ui';
import { ProjectEditor } from './ProjectEditor';
import { ProjectWorkspace } from './ProjectWorkspace';
import { Evaluation } from './Evaluation';
import { Templates } from './Templates';
import { SettingsPage } from './SettingsPage';
function useHash() { const read = () => location.hash.slice(1).split('?')[0] || '/'; const [path, setPath] = useState(read); useEffect(() => { const f = () => setPath(read()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []); return path; }
let sessionRequest: Promise<Session> | null = null;
function initialSession(confirmIdentity: (identity:{name:string;reference:string;currentName:string|null})=>Promise<boolean>): Promise<Session> { if (sessionRequest)
    return sessionRequest; const path = location.hash.slice(1).split('?')[0], fragment = new URLSearchParams(location.hash.split('?')[1] || ''); if (path === '/sso' || path === '/invitation') {
    const value = fragment.get(path === '/sso' ? 'ticket' : 'token');
    history.replaceState(null, '', location.pathname + location.search + '#/');
    sessionRequest = path === '/sso' ? (async()=>{const identity=await send('/session/preview',{ticket:value});if(!await confirmIdentity(identity))throw new Error('Sign-in cancelled. / Connexion annulée.');return send('/session/exchange',{ticket:value,confirmedReference:identity.reference})})() : send('/invitations/exchange',{token:value});
}
else
    sessionRequest = api('/session'); return sessionRequest; }
export default function App() { return <UIProvider><Application /></UIProvider>; }
function Application() {
    const { t, language, setLanguage, notify, confirm } = useUI(), path = useHash(), [session, setSession] = useState<Session | null>(null), [ready, setReady] = useState(false), [bootstrap, setBootstrap] = useState<any>(null), [mobile, setMobile] = useState(false), [collapsed, setCollapsed] = useState(localStorage.getItem('jury-sidebar') === 'collapsed'), [dark, setDark] = useState(localStorage.getItem('jury-theme') !== 'light'), [online, setOnline] = useState(navigator.onLine), [install, setInstall] = useState<any>(null), [update, setUpdate] = useState<ServiceWorker | null>(null), [installHelp, setInstallHelp] = useState(false), [drafts, setDrafts] = useState(0), [startupError, setStartupError] = useState(''), generation = useRef(0);
    useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('jury-theme', dark ? 'dark' : 'light'); }, [dark]);
    const acceptSession = async (value: Session) => { const epoch = ++generation.current; setApiSession(value); setSession(value); try {
        await unlockDrafts(value);
    }
    catch {
        notify(t('Secure device drafts are unavailable. Online saving remains available.', 'Les brouillons sécurisés sont indisponibles. L’enregistrement en ligne reste possible.'), true);
    } const data = await api('/bootstrap'); if (epoch === generation.current)
        setBootstrap(data); };
    useEffect(() => { let active = true; const init = async () => { try {
        const value = await initialSession(async identity=>Boolean(await confirm({title:t('Confirm your Jury account','Confirmez votre compte Jury'),body:(identity.currentName?t('Current Jury account: ','Compte Jury actuel : ')+identity.currentName+'. '+t('Continuing will replace this browser session. ','Continuer remplacera cette session dans le navigateur. '):'')+t('You are about to sign in as ','Vous allez vous connecter en tant que ')+identity.name+'. '+t('Continue only if this is your own institutional account. Otherwise cancel and open Jury from your Nexus dashboard.','Continuez uniquement s’il s’agit de votre propre compte institutionnel. Sinon, annulez et ouvrez Jury depuis votre dashboard Nexus.'),approve:t('Continue as this account','Continuer avec ce compte')})));
        if (active)
            await acceptSession(value);
    }
    catch (e) {
        if (active)
            setStartupError((e as Error).message);
    }
    finally {
        if (active)
            setReady(true);
    } }; if (!['/display', '/verify'].includes(path))
        void init();
    else
        setReady(true); return () => { active = false; generation.current++; }; }, []);
    useEffect(() => { const on = () => setOnline(navigator.onLine), prompt = (e: Event) => { e.preventDefault(); setInstall(e); }, installed = () => setInstall(null); addEventListener('online', on); addEventListener('offline', on); addEventListener('beforeinstallprompt', prompt); addEventListener('appinstalled', installed); return () => { removeEventListener('online', on); removeEventListener('offline', on); removeEventListener('beforeinstallprompt', prompt); removeEventListener('appinstalled', installed); }; }, []);
    useEffect(() => { if (!import.meta.env.PROD || !('serviceWorker' in navigator))
        return; let active = true; void navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: new URL('./', document.baseURI).pathname, updateViaCache: 'none' }).then(reg => { if (!active)
        return; if (reg.waiting)
        setUpdate(reg.waiting); reg.addEventListener('updatefound', () => { const worker = reg.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller)
        setUpdate(worker); }); }); void reg.update(); }).catch(() => { }); const previouslyControlled = Boolean(navigator.serviceWorker.controller); let reloading = false; const changed = () => { if (previouslyControlled && !reloading) {
        reloading = true;
        location.reload();
    } }; navigator.serviceWorker.addEventListener('controllerchange', changed); return () => { active = false; navigator.serviceWorker.removeEventListener('controllerchange', changed); }; }, []);
    useEffect(() => { if (!session)
        return; let active = true; const refresh = async () => { try {
        const rows = await queued();
        if (active)
            setDrafts(rows.length);
    }
    catch { } }; void refresh(); const timer = setInterval(refresh, 3000); return () => { active = false; clearInterval(timer); }; }, [session]);
    useEffect(() => { if (!session || !online)
        return; const epoch = generation.current; void synchronize().then(r => { if (epoch !== generation.current)
        return; if (r.conflict)
        notify(t('A local draft conflicts with server changes. Open the assigned evaluation to reconcile it.', 'Un brouillon local entre en conflit avec le serveur. Ouvrez l’évaluation concernée pour le résoudre.'), true); }).catch(() => { }); }, [online, session?.reference]);
    useEffect(() => {
        if (!session) return;
        const owner = session.reference;
        let active = true, pending = false;
        const refreshPhoto = async () => {
            if (!navigator.onLine || document.visibilityState === 'hidden' || pending) return;
            pending = true; const epoch = generation.current;
            try {
                const current = await api<Session>('/session');
                if (active && epoch === generation.current && current.reference === owner)
                    setSession(previous => previous?.reference === owner && previous.avatar !== current.avatar ? { ...previous, avatar: current.avatar ?? null } : previous);
            } catch { /* Keep the current photo during a temporary outage; never replace the signed-in identity. */ }
            finally { pending = false; }
        };
        const refresh = () => { void refreshPhoto(); };
        addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
        return () => { active = false; removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
    }, [session?.reference]);
    useEffect(() => { setMobile(false); }, [path]);
    const installApp = async () => { if (!install) {
        setInstallHelp(true);
        return;
    } await install.prompt(); const choice = await install.userChoice; if (choice.outcome === 'accepted')
        setInstall(null); };
    const installButton = !matchMedia('(display-mode: standalone)').matches && <button onClick={() => void installApp()}><Download size={15}/>{t('Install Jury', 'Installer Jury')}</button>;
    const tools = <><button className="icon" aria-label={t('Change language', 'Changer de langue')} onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}><span>{language.toUpperCase()}</span></button><button className="icon" aria-label={t('Switch appearance', 'Changer l’apparence')} onClick={() => setDark(!dark)}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button></>;
    const installModal = installHelp && <Modal title={t('Install KCS Nexus Jury', 'Installer KCS Nexus Jury')} onClose={() => setInstallHelp(false)}><p>{t('In Chrome or Edge, use the browser’s “Install app” menu. On iPhone or iPad, open in Safari, choose Share, then “Add to Home Screen” and enable “Open as Web App”. This installs Jury with its own icon and identity.', 'Dans Chrome ou Edge, utilisez « Installer l’application ». Sur iPhone ou iPad, ouvrez Safari, choisissez Partager, puis « Sur l’écran d’accueil » et activez « Ouvrir comme app web ». Jury possède son propre nom et sa propre icône.')}</p><button className="primary" onClick={() => setInstallHelp(false)}>{t('Understood', 'Compris')}</button></Modal>;
    if (path === '/display')
        return <><PublicDisplay />{installModal}</>;
    if (path === '/verify')
        return <DocumentVerification />;
    if (!ready)
        return <div className="login"><Loading /></div>;
    if (!session)
        return <div className="login"><div className="login-card"><section className="login-brand"><img src="./jury-logo.svg" alt="KCS Nexus Jury"/><span className="eyebrow">KCS ORBIT ECOSYSTEM</span><h1>{t('Fair judgment. Extraordinary potential.', 'Une évaluation juste. Un potentiel exceptionnel.')}</h1><p>Evaluate fairly. Empower excellence.</p></section><section className="login-main"><div className="login-tools"><img className="institution-emblem" src="./kcs-emblem.jpg" alt="KCS" width={45} height={45}/><div className="actions">{tools}</div></div><span className="eyebrow">KCS NEXUS JURY</span><h2>{t('Your institutional assessment space', 'Votre espace d’évaluation institutionnel')}</h2><p>{t('Open Jury from your KCS Nexus dashboard using your existing school account. External judges use their personal invitation.', 'Ouvrez Jury depuis votre dashboard KCS Nexus avec votre compte de l’école. Les juges externes utilisent leur invitation personnelle.')}</p>{startupError && <div className="banner warning">{startupError}</div>}<a className="primary" href={import.meta.env.VITE_NEXUS_URL || 'https://kinshasachristianschool.org/#/login'} target="_blank" rel="noopener noreferrer">{t('Continue in KCS Nexus', 'Continuer dans KCS Nexus')}<ArrowUpRight size={18}/></a>{installButton}<small>{t('No separate school identity is created. Your marks remain private and server-verified.', 'Aucune identité parallèle n’est créée. Les notes restent privées et leur enregistrement est vérifié au serveur.')}</small></section></div>{installModal}</div>;
    if (!bootstrap)
        return <div className="login"><div className="panel"><h2>{t('Institutional services are temporarily unavailable', 'Les services institutionnels sont momentanément indisponibles')}</h2><p>{startupError}</p><button onClick={() => location.reload()}>{t('Retry', 'Réessayer')}</button></div></div>;
    const learner=Boolean(session.studentId||session.roles.student);
    const nav: Array<[string,LucideIcon,string]> = learner ? [
 ['/',LayoutDashboard,t('My workspace','Mon espace')],
 ['/projects',FolderKanban,t('My projects','Mes projets')],
 ['/portfolio',FileText,t('My submissions','Mes dépôts')],
 ['/results',Award,t('My results & documents','Mes résultats et documents')]
] : [
 ['/',LayoutDashboard,t('Overview','Vue d’ensemble')],
 ['/projects',FolderKanban,t('Projects & events','Projets et événements')],
 ['/evaluations',ClipboardCheck,t('My evaluations','Mes évaluations')]
];
if(!learner&&!session.roles.externalJudge)nav.push(['/templates',BookOpen,t('Rubric library','Bibliothèque de grilles')]);
nav.push(['/settings',Settings,t('Settings & access','Paramètres et accès')]);
const logout = async () => { const yes = await confirm({ title: t('Sign out of Jury?', 'Se déconnecter de Jury ?'), body: drafts ? t('Encrypted local drafts will stay on this device for your next authorized login. Unsynchronized drafts are not yet saved on the server.', 'Les brouillons chiffrés resteront sur cet appareil pour votre prochaine connexion. Les brouillons non synchronisés ne sont pas encore enregistrés au serveur.') : t('This signs out of Jury only.', 'Cela déconnecte uniquement Jury.') }); if (!yes)
        return; try {
        await send('/session/logout', {});
        generation.current++;
        sessionRequest = null;
        lockDrafts();
        setApiSession(null);
        setSession(null);
        setBootstrap(null);
    }
    catch (e) {
        notify((e as Error).message, true);
    } };
    return <div className={collapsed ? 'side-collapsed' : ''}><div className="shell">{mobile && <button className="sidebar-backdrop" aria-label={t('Close navigation', 'Fermer le menu')} onClick={() => setMobile(false)}/>}<aside className={'sidebar ' + (mobile ? 'open' : '')}><a className="brand" href="#/" style={{ textDecoration: 'none' }}><img src="./jury-logo.svg" alt=""/><div><strong>Nexus Jury</strong><small>KCS ORBIT ECOSYSTEM</small></div></a><div className="workspace-label">{learner?t('Learner workspace','Espace élève'):session.roles.superAdministrator ? t('Super Administration', 'Super Administration') : session.roles.academicAdministrator ? t('Academic leadership', 'Direction académique') : session.roles.teacher ? t('Teacher workspace', 'Espace enseignant') : session.roles.student ? t('Learner portfolio', 'Portfolio élève') : t('Jury workspace', 'Espace jury')}</div><nav aria-label={t('Main navigation', 'Navigation principale')}>{nav.map(([url, Icon, label]) => <a key={String(url)} href={'#' + url} className={path === url || url === '/projects' && path.startsWith('/projects/') ? 'active' : ''}><Icon size={18}/><span className="nav-label">{label}</span></a>)}</nav><div className="sidebar-footer"><a href={session.nexusUrl} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={16}/><span className="footer-copy">{t('Return to Nexus', 'Retour à Nexus')}</span></a><button onClick={() => void logout()}><LogOut size={15}/><span className="nav-label">{t('Sign out', 'Déconnexion')}</span></button></div></aside><div className="main-shell"><div className="topbar"><div className="topbar-left"><button className="icon mobile-only" aria-label={t('Open navigation', 'Ouvrir le menu')} onClick={() => setMobile(!mobile)}><Menu size={19}/></button><button className="icon desktop-only" aria-label={t('Collapse navigation', 'Réduire le menu')} onClick={() => { setCollapsed(!collapsed); localStorage.setItem('jury-sidebar', !collapsed ? 'collapsed' : 'expanded'); }}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button><b>Evaluate fairly. Empower excellence.</b></div><div className="topbar-right">{tools}<div className="profile-chip"><DashboardAvatar name={session.name} photo={session.avatar}/><div><strong>{session.name}</strong><small>{online ? t('Connected to KCS', 'Connecté à KCS') : t('Offline · encrypted drafts', 'Hors ligne · brouillons chiffrés')}</small></div></div></div></div><main className="content">{session.environment === 'staging' && <div className="banner"><ShieldCheck size={16}/><span>{t('STAGING · isolated test environment · production remains unchanged', 'STAGING · environnement de test isolé · production inchangée')}</span></div>}{(!online || drafts > 0) && <div className="banner warning"><span>{!online ? t('Connection interrupted. Local drafts are not server confirmation.', 'Connexion interrompue. Un brouillon local ne confirme pas l’enregistrement au serveur.') : t('Encrypted drafts awaiting synchronization: ', 'Brouillons chiffrés en attente : ') + drafts}</span>{online && <button onClick={() => void synchronize().then(r => notify(r.conflict ? r.conflict.message : t('Drafts synchronized with the server.', 'Brouillons synchronisés avec le serveur.'), Boolean(r.conflict))).catch(e => notify(e.message, true))}>{t('Synchronize', 'Synchroniser')}</button>}</div>}{update && <div className="banner"><span>{t('A Jury update is ready. Save your work before updating.', 'Une mise à jour de Jury est prête. Enregistrez votre travail avant de l’appliquer.')}</span><button disabled={drafts > 0} onClick={() => update.postMessage({ type: 'ACTIVATE_JURY_UPDATE' })}>{t('Update Jury', 'Mettre Jury à jour')}</button></div>}{learner?(path==='/settings'?<SettingsPage session={session} installButton={installButton}/>:path.startsWith('/projects/')?<LearnerProject key={path.split('/')[2]} projectId={path.split('/')[2]} session={session}/>:<LearnerHome session={session} bootstrap={bootstrap} mode={path==='/projects'?'projects':path==='/portfolio'?'portfolio':path==='/results'?'results':'overview'}/>):path.startsWith('/projects/') ? <ProjectWorkspace projectId={path.split('/')[2]} bootstrap={bootstrap} session={session}/> : path.startsWith('/evaluations/') ? <Evaluation assignmentId={path.split('/')[2]}/> : path === '/evaluations' ? <EvaluationList /> : path === '/templates' ? <Templates /> : path === '/settings' ? <SettingsPage session={session} installButton={installButton}/> : <ProjectHome session={session} bootstrap={bootstrap} directory={path === '/projects'}/>}<footer className="app-footnote">Kinshasa Christian School · KCS Orbit Ecosystem<br />Project Designer &amp; Initiator: LOKALA LOMBOTO Jonathan</footer></main></div></div>{installModal}</div>;
}
function ProjectHome({ session, bootstrap, directory }: {
    session: Session;
    bootstrap: any;
    directory: boolean;
}) { const { t, notify } = useUI(), [rows, setRows] = useState<any[]>([]), [loading, setLoading] = useState(true), [q, setQ] = useState(''), [year, setYear] = useState(''), [create, setCreate] = useState(false); useEffect(() => { let active = true; const timer = setTimeout(() => { void api('/projects?' + new URLSearchParams({ q, ...(year ? { academicYear: year } : {}) })).then(value => { if (active)
    setRows(value); }).catch(e => { if (active)
    notify(e.message, true); }).finally(() => { if (active)
    setLoading(false); }); }, 180); return () => { active = false; clearTimeout(timer); }; }, [q, year]); const active = rows.filter(p => !['ARCHIVED', 'CANCELLED', 'PUBLISHED'].includes(p.status)); return <><PageHead eyebrow={t('Institutional project assessment', 'Évaluation institutionnelle des projets')} title={directory ? t('Projects & events', 'Projets et événements') : t('Welcome, ', 'Bienvenue, ') + session.name.split(' ')[0]} detail={t('Clear criteria. Independent judgment. Verified academic records.', 'Des critères clairs. Un jugement indépendant. Des résultats vérifiés.')}>{(session.roles.teacher || session.roles.academicAdministrator) && <button className="primary" onClick={() => setCreate(true)}><Plus size={16}/>{t('New project', 'Nouveau projet')}</button>}</PageHead>{!directory && <><section className="hero"><div><span className="eyebrow">KCS NEXUS JURY</span><h1>{t('Every project deserves a fair stage.', 'Chaque projet mérite une évaluation juste.')}</h1><p>{t('Organize authentic learning experiences, assess with confidence and publish validated results into the real Nexus Gradebook.', 'Organisez les projets, évaluez avec confiance et publiez les résultats validés dans le vrai Gradebook Nexus.')}</p><div className="actions"><a className="link" href="#/evaluations">{t('Open my evaluations', 'Ouvrir mes évaluations')} →</a></div></div><div className="hero-note"><span className="eyebrow">{t('Active projects', 'Projets actifs')}</span><strong>{active.length}</strong><p>{t('In the current project selection', 'Dans la sélection actuelle des projets')}</p></div></section>{(session.roles.teacher||session.roles.academicAdministrator)?<HomeAnalytics bootstrap={bootstrap} projects={rows}/>:<div className="stats"><Stat label={t('Participants', 'Participants')} value={rows.reduce((n, p) => n + p._count.juryParticipant_project, 0)} icon={<Users size={18}/>}/><Stat label={t('Registered groups', 'Groupes inscrits')} value={rows.reduce((n, p) => n + p._count.juryGroup_project, 0)} icon={<FolderKanban size={18}/>}/><Stat label={t('Awaiting validation', 'En attente de validation')} value={rows.filter(p => p.status === 'RESULTS_PENDING_VALIDATION').length} icon={<ShieldCheck size={18}/>}/><Stat label={t('Gradebook receipts', 'Reçus Gradebook')} value={rows.reduce((n, p) => n + p._count.juryPublication_project, 0)} icon={<ClipboardCheck size={18}/>}/></div>}</>}<section className="panel"><div className="panel-head"><div><span className="eyebrow">{t('Your academic workspace', 'Votre espace académique')}</span><h2>{t('Explore projects', 'Explorer les projets')}</h2></div><div className="filters"><input className="search" aria-label={t('Search projects', 'Rechercher des projets')} placeholder={t('Search a project…', 'Rechercher un projet…')} value={q} onChange={e => setQ(e.target.value)}/><label className="field"><span className="sr-only">{t('Academic year', 'Année scolaire')}</span><select value={year} onChange={e => setYear(e.target.value)}><option value="">{t('All school years', 'Toutes les années')}</option>{bootstrap.calendars.map((c: any) => <option key={c.name}>{c.name}</option>)}</select></label></div></div>{loading ? <Loading /> : rows.length ? <div className="grid-three">{rows.map(p => <a className="project-card" key={p.id} href={'#/projects/' + p.id}><div className="actions spread"><Status value={p.status}/><ArrowUpRight size={16}/></div><h3>{p.title}</h3><p>{p.academicYear} · {p.term}</p><div className="card-footer"><span>{p._count.juryParticipant_project} {t('participants', 'participants')}</span><span>{p.presentationAt ? new Date(p.presentationAt).toLocaleDateString() : t('Date to be scheduled', 'Date à programmer')}</span></div></a>)}</div> : <Empty title={t('No project in this selection', 'Aucun projet dans cette sélection')} detail={t('Projects appear here when you create, organize, evaluate or participate in them.', 'Vos projets apparaissent lorsque vous les créez, les organisez, les évaluez ou y participez.')}/>}</section>{create && <ProjectEditor bootstrap={bootstrap} onClose={() => setCreate(false)} onSaved={p => { setCreate(false); location.hash = '/projects/' + p.id; }}/>}</>; }
function EvaluationList() { const { t, notify } = useUI(), [rows, setRows] = useState<any[] | null>(null); useEffect(() => { let active = true; void api('/assignments').then(v => { if (active)
    setRows(v); }).catch(e => notify(e.message, true)); return () => { active = false; }; }, []); return <><PageHead eyebrow={t('Independent jury workspace', 'Espace du jury indépendant')} title={t('My evaluations', 'Mes évaluations')} detail={t('Only your assigned candidates are shown. Other judges’ scores remain confidential.', 'Seuls les candidats qui vous sont confiés apparaissent. Les notes des autres juges restent confidentielles.')}/>{!rows ? <Loading /> : !rows.length ? <Empty title={t('No evaluation assigned yet', 'Aucune évaluation attribuée')}/> : <div className="grid-three">{rows.map(a => { const e = a.juryEvaluation_assignment.find((e: any) => e.rubricVersionId === a.candidate.project.activeRubricId); return <a className="project-card" key={a.id} href={'#/evaluations/' + a.id}><Status value={e?.status || 'PENDING'}/><h3>{a.candidate.group?.name || a.candidate.participant?.displayNameSnapshot}</h3><p>{a.candidate.project.title}<br />{a.candidate.project.academicYear} · {a.candidate.project.term}</p><span className="link">{t('Open scoring sheet', 'Ouvrir la grille')} →</span></a>; })}</div>}</>; }
function PublicDisplay() { const { t } = useUI(), [data, setData] = useState<any>(null), [error, setError] = useState(''), [now, setNow] = useState(Date.now()), token = useRef(new URLSearchParams(location.hash.split('?')[1] || '').get('token') || ''), offset = useRef(0); useEffect(() => { const load = () => { void api('/display', { headers: { 'X-Jury-Display': token.current } }).then(value => { setData(value); offset.current = Date.parse(value.serverUtc) - Date.now(); setError(''); }).catch(e => setError(e.message)); }; load(); const timer = setInterval(load, 3000), clock = setInterval(() => setNow(Date.now() + offset.current), 250); return () => { clearInterval(timer); clearInterval(clock); }; }, []); if (error)
    return <div className="projector"><h1>{t('Projector unavailable', 'Écran de présentation indisponible')}</h1><p>{error}</p></div>; if (!data)
    return <div className="projector"><Loading /></div>; const elapsed = (data.elapsedMilliseconds + (data.startedAt ? Math.max(0, now - Date.parse(data.startedAt)) : 0)) / 1000, remaining = (data.state === 'QUESTIONS' ? data.questionsSeconds : data.durationSeconds) - Math.floor(elapsed); return <div className="projector"><img src="./jury-logo.svg" alt="KCS Nexus Jury"/><span className="eyebrow">KINSHASA CHRISTIAN SCHOOL</span><h2>{data.event}</h2><h1>{data.current?.name || t('Welcome to the presentations', 'Bienvenue aux présentations')}</h1><p>{data.current?.topic}</p><div className="timer">{remaining < 0 ? '−' : ''}{Math.floor(Math.abs(remaining) / 60).toString().padStart(2, '0')}:{(Math.abs(remaining) % 60).toString().padStart(2, '0')}</div><p>{t('Next', 'À suivre')} · {data.next?.name || '—'}</p><small>{t('Public presentation display · no academic scores', 'Écran de présentation public · aucune note scolaire')}</small></div>; }
function DashboardAvatar({ name, photo }: { name: string; photo?: string | null }) {
    const { t } = useUI(), [failedPhoto, setFailedPhoto] = useState<string | null>(null);
    const source = photo?.trim();
    return <span className="avatar">{source && source !== failedPhoto
        ? <img src={source} alt={t('Profile photo of ', 'Photo de profil de ') + name} width={36} height={36} onError={() => setFailedPhoto(source)}/>
        : name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span>;
}
function DocumentVerification() { const { t } = useUI(), [data, setData] = useState<any>(null), [error, setError] = useState(''); useEffect(() => { const reference = new URLSearchParams(location.hash.split('?')[1] || '').get('reference'); void api('/verify/' + encodeURIComponent(reference || '')).then(setData).catch(e => setError(e.message)); }, []); return <div className="login"><div className="panel stack" style={{ maxWidth: 650 }}><img className="institution-emblem" src="./kcs-emblem.jpg" width={60} height={60} alt="KCS"/><h1>{t('Document verification', 'Vérification du document')}</h1>{error ? <div className="banner error">{error}</div> : !data ? <Loading /> : <><Status value={data.valid ? 'VERIFIED' : 'REVOKED'}/><h3>{juryLabel(data.kind,t)}</h3><p style={{ overflowWrap: 'anywhere' }}>{data.reference}</p><small>{t('Issued by Kinshasa Christian School. Student names and academic results are never exposed through public verification.', 'Émis par Kinshasa Christian School. La vérification publique ne divulgue ni nom d’élève ni résultats scolaires.')}</small></>}</div></div>; }
