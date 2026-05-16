import React, { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { analyticsService } from '../../services/api';
import { advancedMetrics, classDistribution, financeSignals, monthlyPerformance } from '../../data/demoSchoolData';
import { useTranslation } from 'react-i18next';

const colors = ['#22d3ee', '#34d399', '#f59e0b', '#fb7185'];

const AnalyticsPage = () => {
  const { t } = useTranslation();
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await analyticsService.getEarlyWarnings();
        setWarnings(data.students || []);
      } catch {
        setWarnings([]);
      }
    };
    load();
  }, []);

  const columns = [
    { key: 'student_name', label: t('analytics.student') },
    { key: 'attendance_rate', label: t('analytics.attendanceRate'), render: (v) => `${v}%` },
    { key: 'average_excellence_percentage', label: t('analytics.average'), render: (v, row) => v === null || v === undefined ? 'N/A' : `${v}% excellence` },
    { key: 'risk_flags', label: t('analytics.flags'), render: (v) => v.join(', ') },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 page-enter">
        <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Advanced school intelligence</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('analytics.title')}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Tableau analytique avancé : prédiction de réussite, rétention, engagement des parents, performance académique et signaux financiers.</p>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Reussite predite" value={`${advancedMetrics.predictedPassRate}%`} accent="text-emerald-300" />
        <StatCard title="Retention" value={`${advancedMetrics.retentionProbability}%`} accent="text-cyan-300" />
        <StatCard title="Precision alertes" value={`${advancedMetrics.interventionAccuracy}%`} accent="text-amber-300" />
        <StatCard title="Engagement parents" value={`${advancedMetrics.parentEngagement}%`} accent="text-teal-300" />
        <StatCard title="Programme" value={`${advancedMetrics.curriculumCompletion}%`} accent="text-orange-300" />
        <StatCard title="Recouvrement" value={`${advancedMetrics.feeRecoveryRate}%`} accent="text-rose-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5 xl:col-span-2">
          <h3 className="font-display text-lg font-semibold text-slate-100">Performance mensuelle multi-indicateurs</h3>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyPerformance}>
                <defs>
                  <linearGradient id="attendance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="engagement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.24)', borderRadius: 16 }} />
                <Area type="monotone" dataKey="attendance" stroke="#22d3ee" fill="url(#attendance)" name="Presence" />
                <Area type="monotone" dataKey="engagement" stroke="#34d399" fill="url(#engagement)" name="Engagement" />
                <Area type="monotone" dataKey="risk" stroke="#fb7185" fill="transparent" name="Risque" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Signaux financiers</h3>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={financeSignals} dataKey="value" nameKey="label" innerRadius={72} outerRadius={112} paddingAngle={4}>
                  {financeSignals.map((entry, index) => <Cell key={entry.label} fill={colors[index]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.24)', borderRadius: 16 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {financeSignals.map((signal, index) => (
              <div key={signal.label} className="rounded-xl bg-slate-950/50 p-3 text-center">
                <p className="text-xs text-slate-400">{signal.label}</p>
                <p className="font-display text-xl font-bold" style={{ color: colors[index] }}>{signal.value}%</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Distribution par niveau</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDistribution}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.24)', borderRadius: 16 }} />
                <Bar dataKey="students" fill="#22d3ee" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Plan d'intervention recommande</h3>
          <div className="mt-4 space-y-3">
            {['Prioriser les élèves cumulant présence < 75% et moyenne excellence < 75%.', 'Déclencher une relance parent automatique si engagement < 60%.', 'Rééquilibrer les enseignants au-dessus de 28h de charge hebdomadaire.', 'Comparer les classes à risque avec les retards de paiement pour détecter les contraintes familiales.'].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-github-border bg-slate-950/40 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kcs-blue/20 text-sm font-bold text-cyan-200">{index + 1}</span>
                <p className="text-sm text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <DataTable columns={columns} data={warnings} />
    </DashboardLayout>
  );
};

export default AnalyticsPage;
