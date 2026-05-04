import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analyticsService } from '../../services/api';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import SchoolLogo from '../../components/ui/SchoolLogo';
import { advancedMetrics, monthlyPerformance, parents, students } from '../../data/demoSchoolData';

const DashboardPage = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await analyticsService.getOverview();
        setStats(data);
      } catch {
        setStats({
          total_students: 0,
          total_teachers: 0,
          total_classes: 0,
          attendance_rate_30d: 0,
          average_grade: 0,
        });
      }
    };
    load();
  }, []);

  const riskStudents = students.filter((student) => student.risk === 'High').length;
  const parentEngagement = Math.round(parents.reduce((sum, parent) => sum + parent.engagement, 0) / parents.length);

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">SAVANEX command bridge</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('dashboard.overview')}</h2>
          <p className="mt-1 text-sm text-slate-400">{t('dashboard.subtitle')} Donnees demo enrichies pour piloter toute l'ecole.</p>
        </div>
        <div className="github-glass flex items-center gap-3 rounded-2xl px-4 py-3">
          <SchoolLogo size="sm" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kcs-blue">KCS</p>
            <p className="text-sm text-slate-300">Kinshasa Christian School</p>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title={t('dashboard.students')} value={stats?.total_students ?? '-'} accent="text-cyan-300" />
        <StatCard title={t('dashboard.teachers')} value={stats?.total_teachers ?? '-'} accent="text-teal-300" />
        <StatCard title={t('dashboard.classes')} value={stats?.total_classes ?? '-'} accent="text-emerald-300" />
        <StatCard title={t('dashboard.attendanceRate')} value={`${stats?.attendance_rate_30d ?? '-'}%`} accent="text-amber-300" />
        <StatCard title={t('dashboard.avgGrade')} value={stats?.average_grade ?? '-'} accent="text-orange-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold text-slate-100">Pilotage avance</h3>
              <p className="mt-1 text-sm text-slate-400">Vue synthetique des signaux qui demandent une decision.</p>
            </div>
            <Link to="/analytics" className="rounded-xl border border-kcs-blue/40 px-4 py-2 text-sm text-sky-200 hover:bg-kcs-blue/10">Voir analytics</Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-github-border bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Risque eleves</p>
              <p className="mt-2 font-display text-3xl font-bold text-rose-300">{riskStudents}</p>
              <p className="mt-1 text-xs text-slate-400">Interventions prioritaires</p>
            </div>
            <div className="rounded-2xl border border-github-border bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Parents</p>
              <p className="mt-2 font-display text-3xl font-bold text-emerald-300">{parentEngagement}%</p>
              <p className="mt-1 text-xs text-slate-400">Engagement moyen</p>
            </div>
            <div className="rounded-2xl border border-github-border bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Reussite predite</p>
              <p className="mt-2 font-display text-3xl font-bold text-cyan-300">{advancedMetrics.predictedPassRate}%</p>
              <p className="mt-1 text-xs text-slate-400">Modele academique</p>
            </div>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-xl font-semibold text-slate-100">Acces rapides</h3>
          <div className="mt-4 grid gap-2">
            <Link to="/students" className="rounded-xl bg-slate-800/70 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700/70">Gerer les eleves</Link>
            <Link to="/parents" className="rounded-xl bg-slate-800/70 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700/70">Gestion complete des parents</Link>
            <Link to="/timetable" className="rounded-xl bg-slate-800/70 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700/70">Optimiser l'emploi du temps</Link>
            <Link to="/communication" className="rounded-xl bg-slate-800/70 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700/70">Envoyer une campagne</Link>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {monthlyPerformance.slice(-3).map((month) => (
          <article key={month.month} className="card p-5">
            <p className="text-sm text-slate-400">{month.month}</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-100">Presence {month.attendance}%</p>
            <p className="mt-1 text-sm text-slate-400">Moyenne {month.grades}/20 · Risque {month.risk}%</p>
          </article>
        ))}
      </section>
    </DashboardLayout>
  );
};

export default DashboardPage;
