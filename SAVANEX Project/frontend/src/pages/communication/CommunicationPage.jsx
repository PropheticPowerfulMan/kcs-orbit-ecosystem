import React, { useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { messages } from '../../data/demoSchoolData';
import { useTranslation } from 'react-i18next';

const priorityClass = {
  Urgent: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  High: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  Normal: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
};

const inputClass = 'rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue';

const initialDraft = {
  channel: 'Parent follow-up',
  audience: '',
  priority: 'Normal',
  owner: 'Administration',
  sentiment: 'Neutral',
};

const CommunicationPage = () => {
  const { t } = useTranslation();
  const [messageList, setMessageList] = useState(messages);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [notice, setNotice] = useState('');
  const urgentCount = messageList.filter((message) => ['Urgent', 'High'].includes(message.priority)).length;
  const recommendedText = useMemo(() => {
    if (!draft.audience.trim()) {
      return 'Bonjour, nous souhaitons faire un point rapide avec vous afin de mieux accompagner votre enfant.';
    }
    return `Bonjour ${draft.audience}, nous souhaitons faire un point rapide avec vous afin de mieux accompagner votre enfant. Merci de confirmer votre disponibilite.`;
  }, [draft.audience]);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const submitDraft = (event) => {
    event.preventDefault();
    const nextMessage = {
      id: Date.now(),
      ...draft,
      audience: draft.audience || 'Audience a preciser',
      status: 'Draft ready',
    };
    setMessageList((current) => [nextMessage, ...current]);
    setNotice('Message compose et ajoute au suivi.');
    setComposerOpen(false);
    setDraft(initialDraft);
  };

  const columns = [
    { key: 'channel', label: 'Canal' },
    { key: 'audience', label: 'Audience' },
    { key: 'priority', label: 'Priorite', render: (v) => <span className={`rounded-full border px-2 py-1 text-xs ${priorityClass[v]}`}>{v}</span> },
    { key: 'status', label: 'Statut' },
    { key: 'owner', label: 'Responsable' },
    { key: 'sentiment', label: 'Signal emotionnel' },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Communication hub</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.communication')}</h2>
          <p className="mt-2 text-sm text-slate-400">Messagerie parents-enseignants, relances intelligentes et suivi de reponse.</p>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen((value) => !value)}
          className="rounded-xl bg-kcs-blue px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Composer un message
        </button>
      </section>

      {notice ? <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</p> : null}

      {composerOpen ? (
        <section className="mb-6 card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Nouveau message assiste</h3>
          <form onSubmit={submitDraft} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select value={draft.channel} onChange={(event) => updateDraft('channel', event.target.value)} className={inputClass}>
              <option value="Parent follow-up">Relance parent</option>
              <option value="Weekly bulletin">Bulletin hebdomadaire</option>
              <option value="Exam reminder">Rappel examen</option>
              <option value="Teacher meeting">Reunion enseignant</option>
            </select>
            <input value={draft.audience} onChange={(event) => updateDraft('audience', event.target.value)} placeholder="Audience ou parent" className={inputClass} />
            <select value={draft.priority} onChange={(event) => updateDraft('priority', event.target.value)} className={inputClass}>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
            <input value={draft.owner} onChange={(event) => updateDraft('owner', event.target.value)} placeholder="Responsable" className={inputClass} />
            <button type="submit" className="rounded-xl bg-kcs-blue px-4 py-3 text-sm font-semibold text-slate-950">Ajouter au suivi</button>
          </form>
          <p className="mt-4 rounded-xl border border-github-border bg-slate-950/45 p-4 text-sm text-slate-300">{recommendedText}</p>
        </section>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Messages suivis" value={messageList.length} accent="text-cyan-300" />
        <StatCard title="Prioritaires" value={urgentCount} subtitle="A traiter aujourd'hui" accent="text-rose-300" />
        <StatCard title="Taux reponse" value="84%" subtitle="Parents + enseignants" accent="text-emerald-300" />
        <StatCard title="Temps moyen" value="3h" subtitle="Pour premiere reponse" accent="text-amber-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="card p-5 lg:col-span-2">
          <p className="font-display text-lg font-semibold text-slate-100">Campagne recommandee</p>
          <p className="mt-2 text-sm text-slate-400">Relancer automatiquement les parents dont l'engagement est sous 60%, avec proposition de rendez-vous.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">5 familles ciblees</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">Mode SMS + email</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">Ton empathique</span>
          </div>
        </article>
        <article className="card p-5">
          <p className="text-sm text-slate-400">Sante relationnelle</p>
          <p className="mt-2 font-display text-4xl font-bold text-emerald-300">A-</p>
          <p className="mt-2 text-xs text-slate-500">Analyse basee sur delais, sentiment et recurrence des conversations.</p>
        </article>
      </section>

      <DataTable columns={columns} data={messageList} />
    </DashboardLayout>
  );
};

export default CommunicationPage;
