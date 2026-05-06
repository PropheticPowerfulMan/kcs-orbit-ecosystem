import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsService } from '../../services/api';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import SchoolLogo from '../../components/ui/SchoolLogo';
import { advancedMetrics, classDistribution, financeSignals, monthlyPerformance, parents, students, teachers } from '../../data/demoSchoolData';

const chartTooltip = {
  background: '#0f172a',
  border: '1px solid rgba(148,163,184,0.24)',
  borderRadius: 12,
  color: '#e2e8f0',
};

const riskColors = {
  Low: 'text-emerald-300',
  Medium: 'text-amber-300',
  High: 'text-rose-300',
};

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

  const science = useMemo(() => {
    const riskStudents = students.filter((student) => student.risk === 'High').length;
    const mediumRisk = students.filter((student) => student.risk === 'Medium').length;
    const parentEngagement = Math.round(parents.reduce((sum, parent) => sum + parent.engagement, 0) / parents.length);
    const avgAttendance = Math.round(students.reduce((sum, student) => sum + student.attendance, 0) / students.length);
    const avgGrade = (students.reduce((sum, student) => sum + student.average, 0) / students.length).toFixed(1);
    const variance = students.reduce((sum, student) => sum + Math.pow(student.average - Number(avgGrade), 2), 0) / students.length;
    const standardDeviation = Math.sqrt(variance).toFixed(2);
    const interventionIndex = Math.round((riskStudents * 100 + mediumRisk * 45) / students.length);
    const coverageIndex = Math.round((advancedMetrics.curriculumCompletion + avgAttendance + advancedMetrics.parentEngagement) / 3);
    const financeRisk = financeSignals.find((signal) => signal.label === 'Overdue')?.value || 0;

    return {
      riskStudents,
      mediumRisk,
      parentEngagement,
      avgAttendance,
      avgGrade,
      standardDeviation,
      interventionIndex,
      coverageIndex,
      financeRisk,
    };
  }, []);

  const academicScatter = students.map((student) => ({
    name: student.name,
    attendance: student.attendance,
    average: student.average,
    risk: student.risk,
  }));

  const radarData = [
    { metric: 'Presence', value: science.avgAttendance },
    { metric: 'Parents', value: science.parentEngagement },
    { metric: 'Programme', value: advancedMetrics.curriculumCompletion },
    { metric: 'Retention', value: advancedMetrics.retentionProbability },
    { metric: 'Finance', value: advancedMetrics.feeRecoveryRate },
    { metric: 'Alertes', value: advancedMetrics.interventionAccuracy },
  ];

  const teacherLoadData = teachers.map((teacher) => ({
    name: teacher.name.replace('Mme ', '').replace('M. ', '').replace('Dr. ', ''),
    load: Number.parseInt(teacher.load, 10),
    completion: teacher.completion,
    satisfaction: teacher.satisfaction,
  }));

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">SAVANEX scientific command center</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('dashboard.overview')}</h2>
          <p className="mt-1 text-sm text-slate-400">{t('dashboard.subtitle')} Analyse academique, statistique, operationnelle et financiere pour piloter KCS.</p>
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
        <StatCard title="Indice intervention" value={`${science.interventionIndex}%`} subtitle="Priorite eleves" accent="text-rose-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Moyenne academique" value={`${science.avgGrade}/20`} subtitle={`Ecart-type ${science.standardDeviation}`} accent="text-orange-300" />
        <StatCard title="Engagement parents" value={`${science.parentEngagement}%`} subtitle="Contacts et reponses" accent="text-emerald-300" />
        <StatCard title="Couverture pedagogique" value={`${science.coverageIndex}%`} subtitle="Presence + programme + parents" accent="text-cyan-300" />
        <StatCard title="Risque financier" value={`${science.financeRisk}%`} subtitle="Paiements en retard" accent="text-amber-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold text-slate-100">Tendance scientifique multi-indicateurs</h3>
              <p className="mt-1 text-sm text-slate-400">Presence, engagement, performance et risque compares par mois.</p>
            </div>
            <Link to="/analytics" className="rounded-xl border border-kcs-blue/40 px-4 py-2 text-sm text-sky-200 hover:bg-kcs-blue/10">Voir analytics</Link>
          </div>
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyPerformance}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="attendance" fill="#22d3ee" radius={[8, 8, 0, 0]} name="Presence" />
                <Line type="monotone" dataKey="engagement" stroke="#34d399" strokeWidth={3} name="Engagement" />
                <Line type="monotone" dataKey="risk" stroke="#fb7185" strokeWidth={3} name="Risque" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-xl font-semibold text-slate-100">Radar institutionnel</h3>
          <p className="mt-1 text-sm text-slate-400">Lecture rapide de la sante globale de l'ecole.</p>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(148,163,184,0.2)" />
                <PolarAngleAxis dataKey="metric" stroke="#cbd5e1" fontSize={11} />
                <PolarRadiusAxis stroke="#64748b" tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.24} />
                <Tooltip contentStyle={chartTooltip} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Dispersion presence / moyenne</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="attendance" name="Presence" unit="%" stroke="#94a3b8" />
                <YAxis dataKey="average" name="Moyenne" unit="/20" stroke="#94a3b8" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={chartTooltip} />
                <Scatter data={academicScatter} fill="#22d3ee">
                  {academicScatter.map((entry) => (
                    <Cell key={entry.name} fill={entry.risk === 'High' ? '#fb7185' : entry.risk === 'Medium' ? '#f59e0b' : '#34d399'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Charge enseignants</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teacherLoadData}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="load" fill="#f59e0b" radius={[8, 8, 0, 0]} name="Heures" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Finance scolaire</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={financeSignals} dataKey="value" nameKey="label" innerRadius={56} outerRadius={90} paddingAngle={4}>
                  {financeSignals.map((entry, index) => <Cell key={entry.label} fill={['#34d399', '#f59e0b', '#fb7185'][index]} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {financeSignals.map((signal, index) => (
              <div key={signal.label} className="rounded-xl bg-slate-950/50 p-3 text-center">
                <p className="text-xs text-slate-400">{signal.label}</p>
                <p className="font-display text-xl font-bold" style={{ color: ['#34d399', '#f59e0b', '#fb7185'][index] }}>{signal.value}%</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Distribution par niveau</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={classDistribution}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={chartTooltip} />
                <Area type="monotone" dataKey="students" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.18} name="Eleves" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5 xl:col-span-2">
          <h3 className="font-display text-lg font-semibold text-slate-100">File d'intervention prioritaire</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {students
              .filter((student) => student.risk !== 'Low')
              .map((student) => (
                <div key={student.id} className="rounded-2xl border border-github-border bg-slate-950/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{student.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{student.className} · parent: {student.parent}</p>
                    </div>
                    <span className={`text-xs font-semibold ${riskColors[student.risk]}`}>{student.risk}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <p className="rounded-xl bg-slate-900/80 p-2 text-slate-300">Presence {student.attendance}%</p>
                    <p className="rounded-xl bg-slate-900/80 p-2 text-slate-300">Moy. {student.average}/20</p>
                    <p className="rounded-xl bg-slate-900/80 p-2 text-slate-300">Trend {student.trend}</p>
                  </div>
                </div>
              ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {[
          'Prioriser les eleves sous 75% de presence avec rendez-vous parent sous 72h.',
          'Comparer la charge enseignant avec completion programme pour detecter les goulots.',
          'Croiser retards de paiement et baisse academique avant sanction administrative.',
          'Lancer une campagne parents pour les classes avec engagement sous 70%.',
        ].map((item, index) => (
          <article key={item} className="card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Action {index + 1}</p>
            <p className="mt-3 text-sm text-slate-300">{item}</p>
          </article>
        ))}
      </section>
    </DashboardLayout>
  );
};

export default DashboardPage;
