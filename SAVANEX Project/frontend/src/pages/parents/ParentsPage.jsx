import React, { useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { parents } from '../../data/demoSchoolData';

const balanceClass = {
  Paid: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  Pending: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  Overdue: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
};

const ParentsPage = () => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => parents.filter((parent) => `${parent.name} ${parent.student} ${parent.phone} ${parent.email}`.toLowerCase().includes(query.toLowerCase())),
    [query]
  );
  const avgEngagement = Math.round(parents.reduce((sum, parent) => sum + parent.engagement, 0) / parents.length);
  const overdue = parents.filter((parent) => parent.balance === 'Overdue').length;
  const lowEngagement = parents.filter((parent) => parent.engagement < 60).length;

  const columns = [
    { key: 'name', label: 'Parent / Tuteur' },
    { key: 'student', label: 'Eleve lie' },
    { key: 'relation', label: 'Relation' },
    { key: 'phone', label: 'Telephone' },
    { key: 'email', label: 'Email' },
    { key: 'engagement', label: 'Engagement', render: (v) => `${v}%` },
    { key: 'lastContact', label: 'Dernier contact' },
    { key: 'balance', label: 'Frais', render: (v) => <span className={`rounded-full border px-2 py-1 text-xs ${balanceClass[v]}`}>{v}</span> },
    { key: 'meetings', label: 'RDV' },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Parent relationship management</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">Gestion complete des parents</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Dossiers parents, contacts, engagement, rendez-vous, suivi financier et relances personnalisees.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-kcs-blue px-4 py-2 text-sm font-semibold text-slate-950">Ajouter un parent</button>
          <button className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60">Planifier RDV</button>
          <button className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60">Relance automatique</button>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Parents actifs" value={parents.length} accent="text-cyan-300" />
        <StatCard title="Engagement moyen" value={`${avgEngagement}%`} subtitle="Portail + messages" accent="text-emerald-300" />
        <StatCard title="Faible engagement" value={lowEngagement} subtitle="A rappeler cette semaine" accent="text-amber-300" />
        <StatCard title="Frais en retard" value={overdue} subtitle="Suivi comptable" accent="text-rose-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5 xl:col-span-2">
          <p className="font-display text-lg font-semibold text-slate-100">Workflow parent complet</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {['Profil', 'Contacts', 'Paiements', 'Communication'].map((step, index) => (
              <div key={step} className="rounded-2xl border border-github-border bg-slate-950/40 p-4">
                <p className="text-xs text-slate-500">Etape {index + 1}</p>
                <p className="mt-1 font-semibold text-slate-100">{step}</p>
                <p className="mt-2 text-xs text-slate-400">Disponible</p>
              </div>
            ))}
          </div>
        </article>
        <article className="card p-5">
          <p className="font-display text-lg font-semibold text-slate-100">Priorite IA</p>
          <p className="mt-2 text-sm text-slate-400">Contacter Claire Nsimba : engagement bas, frais en retard, eleve en risque eleve.</p>
          <button className="mt-4 w-full rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950">Ouvrir le dossier</button>
        </article>
      </section>

      <div className="mb-4 card p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher parent, eleve, telephone ou email..."
          className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue"
        />
      </div>

      <DataTable columns={columns} data={filtered} />
    </DashboardLayout>
  );
};

export default ParentsPage;
