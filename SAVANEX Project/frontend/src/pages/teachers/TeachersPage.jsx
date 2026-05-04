import React from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { teachers } from '../../data/demoSchoolData';
import { useTranslation } from 'react-i18next';

const TeachersPage = () => {
  const { t } = useTranslation();
  const avgSatisfaction = Math.round(teachers.reduce((sum, teacher) => sum + teacher.satisfaction, 0) / teachers.length);
  const avgCompletion = Math.round(teachers.reduce((sum, teacher) => sum + teacher.completion, 0) / teachers.length);

  const columns = [
    { key: 'name', label: 'Enseignant' },
    { key: 'subject', label: 'Matiere' },
    { key: 'classes', label: 'Classes' },
    { key: 'load', label: 'Charge' },
    { key: 'satisfaction', label: 'Satisfaction', render: (v) => `${v}%` },
    { key: 'completion', label: 'Programme', render: (v) => `${v}%` },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 page-enter">
        <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Faculty operations</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.teachers')}</h2>
        <p className="mt-2 text-sm text-slate-400">Pilotage des charges, progression des programmes et experience des classes.</p>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Enseignants actifs" value={teachers.length} accent="text-cyan-300" />
        <StatCard title="Satisfaction" value={`${avgSatisfaction}%`} subtitle="Feedback eleves" accent="text-emerald-300" />
        <StatCard title="Programme couvert" value={`${avgCompletion}%`} subtitle="Moyenne globale" accent="text-amber-300" />
        <StatCard title="Alertes charge" value="1" subtitle="A reequilibrer" accent="text-rose-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {teachers.slice(0, 3).map((teacher) => (
          <article key={teacher.id} className="card p-5">
            <p className="font-semibold text-slate-100">{teacher.name}</p>
            <p className="mt-1 text-sm text-slate-400">{teacher.subject} · {teacher.load}</p>
            <div className="mt-4 h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-kcs-blue" style={{ width: `${teacher.completion}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Programme complete a {teacher.completion}%</p>
          </article>
        ))}
      </section>

      <DataTable columns={columns} data={teachers} />
    </DashboardLayout>
  );
};

export default TeachersPage;
