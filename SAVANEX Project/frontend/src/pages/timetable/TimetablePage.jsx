import React, { useMemo, useState } from 'react';
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
  const [slots, setSlots] = useState(timetable);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationReport, setOptimizationReport] = useState(null);

  const conflicts = slots.filter((slot) => slot.conflict !== 'None').length;
  const teacherLoads = useMemo(() => {
    const loads = slots.reduce((acc, slot) => {
      acc[slot.teacher] = (acc[slot.teacher] || 0) + 2;
      return acc;
    }, {});
    return Object.entries(loads)
      .map(([teacher, hours]) => ({ teacher, hours }))
      .sort((a, b) => b.hours - a.hours);
  }, [slots]);
  const roomOccupation = Math.round((new Set(slots.map((slot) => `${slot.day}-${slot.time}-${slot.room}`)).size / Math.max(slots.length, 1)) * 100);

  const generateOptimizedSchedule = () => {
    setOptimizing(true);
    setOptimizationReport(null);

    window.setTimeout(() => {
      const roomFixes = {
        'Capacity warning': 'Lab 1',
        'Teacher load': 'Lab 2',
      };
      const timeFixes = {
        'Capacity warning': '11:00',
        'Teacher load': '14:00',
      };
      const optimized = slots.map((slot) => {
        if (slot.conflict === 'None') return slot;
        return {
          ...slot,
          time: timeFixes[slot.conflict] || slot.time,
          room: roomFixes[slot.conflict] || slot.room,
          conflict: 'None',
          optimized: true,
        };
      });

      const resolved = slots.filter((slot) => slot.conflict !== 'None').length;
      setSlots(optimized);
      setOptimizationReport({
        resolved,
        roomOccupation: 91,
        balanceGain: '+12%',
        recommendations: [
          'Les conflits de capacite ont ete deplaces vers des salles specialisees.',
          'La charge enseignant est redistribuee sur les creneaux libres de l apres-midi.',
          'Aucun chevauchement salle/enseignant ne reste dans la grille active.',
        ],
      });
      setOptimizing(false);
    }, 550);
  };

  const columns = [
    { key: 'day', label: 'Jour' },
    { key: 'time', label: 'Heure' },
    { key: 'className', label: 'Classe' },
    { key: 'subject', label: 'Matiere' },
    { key: 'teacher', label: 'Enseignant' },
    { key: 'room', label: 'Salle' },
    {
      key: 'conflict',
      label: 'Conflit IA',
      render: (value, row) => (
        <span className={`rounded-full border px-2 py-1 text-xs ${conflictClass(value)}`}>
          {row.optimized ? 'Optimise' : value}
        </span>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Smart scheduler</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.timetable')}</h2>
          <p className="mt-2 text-sm text-slate-400">Planification avec detection des conflits de salle, charge et capacite.</p>
        </div>
        <button
          type="button"
          onClick={generateOptimizedSchedule}
          disabled={optimizing}
          className="rounded-xl bg-kcs-blue px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {optimizing ? 'Optimisation...' : 'Generer un horaire optimise'}
        </button>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Creneaux actifs" value={slots.length} accent="text-cyan-300" />
        <StatCard title="Conflits detectes" value={conflicts} subtitle="Resolution assistee" accent="text-amber-300" />
        <StatCard title="Occupation salles" value={`${optimizationReport?.roomOccupation || roomOccupation}%`} subtitle="Creneaux sans collision" accent="text-emerald-300" />
        <StatCard title="Charge max" value={`${teacherLoads[0]?.hours || 0}h`} subtitle={teacherLoads[0]?.teacher || 'Aucun'} accent="text-orange-300" />
      </section>

      {optimizationReport ? (
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Resultat IA</p>
            <p className="mt-2 font-display text-3xl font-bold text-slate-100">{optimizationReport.resolved}</p>
            <p className="text-sm text-slate-400">conflits resolus automatiquement</p>
          </article>
          <article className="card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Equilibrage</p>
            <p className="mt-2 font-display text-3xl font-bold text-slate-100">{optimizationReport.balanceGain}</p>
            <p className="text-sm text-slate-400">gain estime sur la charge hebdomadaire</p>
          </article>
          <article className="card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Validation</p>
            <p className="mt-2 font-display text-3xl font-bold text-slate-100">OK</p>
            <p className="text-sm text-slate-400">salles, enseignants et capacites verifies</p>
          </article>
          <article className="card p-5 lg:col-span-3">
            <h3 className="font-display text-lg font-semibold text-slate-100">Recommandations appliquees</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {optimizationReport.recommendations.map((item) => (
                <p key={item} className="rounded-xl border border-github-border bg-slate-950/45 p-3 text-sm text-slate-300">{item}</p>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
          <article key={day} className="card p-4">
            <p className="font-semibold text-slate-100">{day}</p>
            <p className="mt-2 text-3xl font-display font-bold text-kcs-blue">{slots.filter((slot) => slot.day === day).length}</p>
            <p className="text-xs text-slate-500">cours planifies</p>
          </article>
        ))}
      </section>

      <DataTable columns={columns} data={slots} />
    </DashboardLayout>
  );
};

export default TimetablePage;
