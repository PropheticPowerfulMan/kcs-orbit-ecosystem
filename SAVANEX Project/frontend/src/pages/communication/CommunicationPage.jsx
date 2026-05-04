import React from 'react';
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

const CommunicationPage = () => {
  const { t } = useTranslation();
  const urgentCount = messages.filter((message) => ['Urgent', 'High'].includes(message.priority)).length;

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
        <button className="rounded-xl bg-kcs-blue px-4 py-2 text-sm font-semibold text-slate-950">Composer un message</button>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Messages suivis" value={messages.length} accent="text-cyan-300" />
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

      <DataTable columns={columns} data={messages} />
    </DashboardLayout>
  );
};

export default CommunicationPage;
