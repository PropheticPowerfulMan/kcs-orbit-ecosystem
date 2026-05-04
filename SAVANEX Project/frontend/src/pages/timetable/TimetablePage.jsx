import React from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { timetable } from '../../data/demoSchoolData';
import { useTranslation } from 'react-i18next';

const conflictClass = (value) =>
  value === 'None'
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
    : 'border-amber-400/30 bg-amber-400/10 text-amber-200';

const TimetablePage = () => {
  const { t } = useTranslation();
  const conflicts = timetable.filter((slot) => slot.conflict !== 'None').length;
  const columns = [
    { key: 'day', label: 'Jour' },
    { key: 'time', label: 'Heure' },
    { key: 'className', label: 'Classe' },
    { key: 'subject', label: 'Matiere' },
    { key: 'teacher', label: 'Enseignant' },
    { key: 'room', label: 'Salle' },
    { key: 'conflict', label: 'Conflit IA', render: (v) => <span className={`rounded-full border px-2 py-1 text-xs ${conflictClass(v)}`}>{v}</span> },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Smart scheduler</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.timetable')}</h2>
          <p className="mt-2 text-sm text-slate-400">Planification avec detection des conflits de salle, charge et capacite.</p>
        </div>
        <button className="rounded-xl bg-kcs-blue px-4 py-2 text-sm font-semibold text-slate-950">Generer un horaire optimise</button>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Creneaux actifs" value={timetable.length} accent="text-cyan-300" />
        <StatCard title="Conflits detectes" value={conflicts} subtitle="Resolution assistee" accent="text-amber-300" />
        <StatCard title="Occupation salles" value="78%" subtitle="Pic mercredi" accent="text-emerald-300" />
        <StatCard title="Charge moyenne" value="24h" subtitle="Par enseignant" accent="text-orange-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
          <article key={day} className="card p-4">
            <p className="font-semibold text-slate-100">{day}</p>
            <p className="mt-2 text-3xl font-display font-bold text-kcs-blue">{timetable.filter((slot) => slot.day === day).length}</p>
            <p className="text-xs text-slate-500">cours planifies</p>
          </article>
        ))}
      </section>

      <DataTable columns={columns} data={timetable} />
    </DashboardLayout>
  );
};

export default TimetablePage;
