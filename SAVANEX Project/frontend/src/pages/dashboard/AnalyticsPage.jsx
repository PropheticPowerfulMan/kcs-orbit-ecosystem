import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Activity, Brain, Calculator, GitBranch, Search, Sigma, Target, TrendingUp } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { analyticsService } from '../../services/api';
import { advancedMetrics, classDistribution, financeSignals, monthlyPerformance } from '../../data/demoSchoolData';
import { useTranslation } from 'react-i18next';

const colors = ['#22d3ee', '#34d399', '#f59e0b', '#fb7185', '#a78bfa'];
const inputClass = 'w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue';
const tooltipStyle = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.24)', borderRadius: 16, color: '#e2e8f0' };

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const mean = (items) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0;
const standardDeviation = (items) => {
  if (!items.length) return 0;
  const avg = mean(items);
  return Math.sqrt(mean(items.map((value) => (value - avg) ** 2)));
};
const correlation = (x, y) => {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  const numerator = x.reduce((sum, value, index) => sum + ((value - mx) * (y[index] - my)), 0);
  const denominator = Math.sqrt(x.reduce((sum, value) => sum + ((value - mx) ** 2), 0) * y.reduce((sum, value) => sum + ((value - my) ** 2), 0));
  return denominator ? numerator / denominator : 0;
};
const linearForecast = (series, horizon = 3) => {
  const n = series.length;
  if (!n) return [];
  const xs = series.map((_item, index) => index + 1);
  const ys = series.map((item) => Number(item.grades || item.attendance || 0));
  const mx = mean(xs);
  const my = mean(ys);
  const slope = xs.reduce((sum, x, index) => sum + ((x - mx) * (ys[index] - my)), 0) / xs.reduce((sum, x) => sum + ((x - mx) ** 2), 0);
  const intercept = my - slope * mx;
  return Array.from({ length: horizon }, (_item, index) => {
    const x = n + index + 1;
    return { month: `P+${index + 1}`, forecast: Number((intercept + slope * x).toFixed(1)), observed: null };
  });
};

const AnalyticsPage = () => {
  const { t } = useTranslation();
  const [warnings, setWarnings] = useState([]);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

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

  const enrichedWarnings = useMemo(() => warnings.map((student) => {
    const attendance = Number(student.attendance_rate ?? 0);
    const average = Number(student.average_excellence_percentage ?? student.average_normalized ?? 0);
    const attendanceRisk = clamp(100 - attendance);
    const academicRisk = clamp(100 - average);
    const flagPressure = (student.risk_flags || []).length * 12;
    const riskScore = clamp(Math.round((attendanceRisk * 0.42) + (academicRisk * 0.48) + flagPressure));
    const successProbability = clamp(Math.round(100 - (riskScore * 0.74)));
    const severity = riskScore >= 65 ? 'Critique' : riskScore >= 42 ? 'Soutien' : riskScore >= 24 ? 'Surveillance' : 'Stable';
    const intervention = riskScore >= 65 ? 'Plan intensif sous 48h' : riskScore >= 42 ? 'Tutorat + appel parent' : riskScore >= 24 ? 'Observation hebdomadaire' : 'Maintenir les routines';
    return { ...student, attendance, average, riskScore, successProbability, severity, intervention };
  }), [warnings]);

  const filteredWarnings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return enrichedWarnings.filter((student) => {
      if (riskFilter !== 'all' && student.severity !== riskFilter) return false;
      if (!needle) return true;
      return [
        student.student_name,
        student.severity,
        student.intervention,
        ...(student.risk_flags || []),
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [enrichedWarnings, riskFilter, search]);

  const model = useMemo(() => {
    const attendance = enrichedWarnings.map((student) => student.attendance);
    const averages = enrichedWarnings.map((student) => student.average);
    const risks = enrichedWarnings.map((student) => student.riskScore);
    const corr = correlation(attendance, averages);
    const volatility = standardDeviation(monthlyPerformance.map((item) => item.risk));
    const predictionSeries = [
      ...monthlyPerformance.map((item) => ({ month: item.month, observed: item.grades, forecast: null })),
      ...linearForecast(monthlyPerformance),
    ];
    const topRisk = [...enrichedWarnings].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6);
    const matrix = [
      { axis: 'Academique', value: advancedMetrics.predictedPassRate, fullMark: 100 },
      { axis: 'Presence', value: Math.round(mean(attendance) || 92), fullMark: 100 },
      { axis: 'Parents', value: advancedMetrics.parentEngagement, fullMark: 100 },
      { axis: 'Recouvrement', value: advancedMetrics.feeRecoveryRate, fullMark: 100 },
      { axis: 'Programme', value: advancedMetrics.curriculumCompletion, fullMark: 100 },
      { axis: 'Precision IA', value: advancedMetrics.interventionAccuracy, fullMark: 100 },
    ];
    return {
      corr,
      volatility,
      predictionSeries,
      topRisk,
      matrix,
      averageRisk: Math.round(mean(risks)),
      riskStd: Number(standardDeviation(risks).toFixed(1)),
      expectedSuccess: Math.round(mean(enrichedWarnings.map((student) => student.successProbability)) || advancedMetrics.predictedPassRate),
    };
  }, [enrichedWarnings]);

  const riskBuckets = useMemo(() => ['Stable', 'Surveillance', 'Soutien', 'Critique'].map((bucket) => ({
    name: bucket,
    value: enrichedWarnings.filter((student) => student.severity === bucket).length,
  })), [enrichedWarnings]);

  const columns = [
    { key: 'student_name', label: t('analytics.student') },
    { key: 'attendance', label: t('analytics.attendanceRate'), render: (v) => `${v}%` },
    { key: 'average', label: t('analytics.average'), render: (v) => v === null || v === undefined ? 'N/A' : `${v}% excellence` },
    { key: 'riskScore', label: 'Risque IA', render: (v, row) => <span className={v >= 65 ? 'text-rose-300' : v >= 42 ? 'text-amber-300' : 'text-emerald-300'}>{v}% - {row.severity}</span> },
    { key: 'successProbability', label: 'Prob. reussite', render: (v) => `${v}%` },
    { key: 'intervention', label: 'Action predictive' },
    { key: 'risk_flags', label: t('analytics.flags'), render: (v) => v.join(', ') },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 page-enter">
        <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Scientific intelligence lab</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('analytics.title')}</h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">
          Analyse robuste combinant prediction lineaire, correlation, dispersion, scoring de risque et recommandations d'intervention.
        </p>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Reussite predite" value={`${model.expectedSuccess}%`} accent="text-emerald-300" />
        <StatCard title="Risque moyen" value={`${model.averageRisk}%`} subtitle={`ecart-type ${model.riskStd}`} accent="text-rose-300" />
        <StatCard title="Correlation" value={model.corr.toFixed(2)} subtitle="presence / moyenne" accent="text-cyan-300" />
        <StatCard title="Precision alertes" value={`${advancedMetrics.interventionAccuracy}%`} accent="text-amber-300" />
        <StatCard title="Volatilite" value={model.volatility.toFixed(1)} subtitle="risque mensuel" accent="text-violet-300" />
        <StatCard title="Recouvrement" value={`${advancedMetrics.feeRecoveryRate}%`} accent="text-teal-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Modele predictif</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Trajectoire academique observee et projetee</h3>
            </div>
            <TrendingUp className="h-6 w-6 text-cyan-300" />
          </div>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={model.predictionSeries}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[8, 18]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="observed" stroke="#22d3ee" fill="rgba(34,211,238,0.16)" name="Moyenne observee" strokeWidth={2.5} />
                <Line type="monotone" dataKey="forecast" stroke="#f59e0b" name="Projection" strokeWidth={3} strokeDasharray="6 5" dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Score multi-facteurs</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Radar de sante institutionnelle</h3>
            </div>
            <Target className="h-6 w-6 text-emerald-300" />
          </div>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={model.matrix}>
                <PolarGrid stroke="rgba(148,163,184,0.24)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Radar dataKey="value" stroke="#34d399" fill="#34d399" fillOpacity={0.28} strokeWidth={2.5} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5 xl:col-span-2">
          <h3 className="font-display text-lg font-semibold text-slate-100">Carte scientifique presence / performance / risque</h3>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="attendance" name="Presence" unit="%" stroke="#94a3b8" />
                <YAxis dataKey="average" name="Moyenne" unit="%" stroke="#94a3b8" />
                <ZAxis dataKey="riskScore" range={[80, 560]} name="Risque" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                <Scatter data={enrichedWarnings} fill="#22d3ee" name="Eleves">
                  {enrichedWarnings.map((entry) => <Cell key={entry.student_name} fill={entry.riskScore >= 65 ? '#fb7185' : entry.riskScore >= 42 ? '#f59e0b' : '#34d399'} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Distribution des risques</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskBuckets} dataKey="value" nameKey="name" innerRadius={68} outerRadius={108} paddingAngle={4}>
                  {riskBuckets.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {riskBuckets.map((bucket, index) => (
              <div key={bucket.name} className="rounded-xl bg-slate-950/50 p-3 text-center">
                <p className="text-xs text-slate-400">{bucket.name}</p>
                <p className="font-display text-xl font-bold" style={{ color: colors[index] }}>{bucket.value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Cohortes et charge de croissance</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDistribution}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="students" fill="#22d3ee" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Plan d'intervention mathematique</h3>
          <div className="mt-4 space-y-3">
            {[
              { icon: Brain, title: 'Priorite critique', body: 'Isoler les eleves avec risque IA >= 65 et declencher rendez-vous parent + plan de tutorat.' },
              { icon: Calculator, title: 'Controle statistique', body: `Surveiller toute classe dont la variation depasse ${model.volatility.toFixed(1)} points de risque mensuel.` },
              { icon: GitBranch, title: 'Decision tree', body: 'Presence < 75% puis moyenne < 75% = intervention conjointe discipline + pedagogie.' },
              { icon: Sigma, title: 'Qualite predictive', body: `Correlation presence/performance ${model.corr.toFixed(2)}: ajuster les alertes selon la sensibilite reelle.` },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3 rounded-2xl border border-github-border bg-slate-950/40 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kcs-blue/20 text-cyan-200"><Icon className="h-5 w-5" /></span>
                  <div>
                    <p className="font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="mb-4 card p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-10`} placeholder="Recherche: eleve, drapeau, action, severite..." />
          </label>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className={inputClass}>
            <option value="all">Tous les risques</option>
            <option value="Stable">Stable</option>
            <option value="Surveillance">Surveillance</option>
            <option value="Soutien">Soutien</option>
            <option value="Critique">Critique</option>
          </select>
        </div>
      </section>

      <DataTable columns={columns} data={filteredWarnings} />
    </DashboardLayout>
  );
};

export default AnalyticsPage;
