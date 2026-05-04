import React, { useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { students } from '../../data/demoSchoolData';
import { useTranslation } from 'react-i18next';

const riskClass = {
  Low: 'bg-emerald-400/10 text-emerald-200 border-emerald-400/30',
  Medium: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
  High: 'bg-rose-400/10 text-rose-200 border-rose-400/30',
};

const StudentsPage = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => students.filter((student) => `${student.name} ${student.className} ${student.parent}`.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const highRisk = students.filter((student) => student.risk === 'High').length;
  const avgAttendance = Math.round(students.reduce((sum, student) => sum + student.attendance, 0) / students.length);
  const avgGrade = (students.reduce((sum, student) => sum + student.average, 0) / students.length).toFixed(1);

  const columns = [
    { key: 'name', label: 'Eleve' },
    { key: 'className', label: 'Classe' },
    { key: 'parent', label: 'Parent responsable' },
    { key: 'attendance', label: 'Presence', render: (v) => `${v}%` },
    { key: 'average', label: 'Moyenne', render: (v) => `${v}/20` },
    { key: 'trend', label: 'Tendance' },
    { key: 'risk', label: 'Risque', render: (v) => <span className={`rounded-full border px-2 py-1 text-xs ${riskClass[v]}`}>{v}</span> },
    { key: 'status', label: 'Action pedagogique' },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Student command center</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.students')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Suivi academique, presence, risque et lien parent pour chaque eleve.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-kcs-blue px-4 py-2 text-sm font-semibold text-slate-950">Ajouter un eleve</button>
          <button className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60">Importer CSV</button>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Effectif actif" value={students.length} subtitle="Dossiers complets" accent="text-cyan-300" />
        <StatCard title="Presence moyenne" value={`${avgAttendance}%`} subtitle="Derniers 30 jours" accent="text-emerald-300" />
        <StatCard title="Moyenne generale" value={avgGrade} subtitle={`${highRisk} eleves en intervention`} accent="text-amber-300" />
      </section>

      <div className="mb-4 card p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher par eleve, classe ou parent..."
          className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue"
        />
      </div>
      <DataTable columns={columns} data={filtered} />
    </DashboardLayout>
  );
};

export default StudentsPage;
