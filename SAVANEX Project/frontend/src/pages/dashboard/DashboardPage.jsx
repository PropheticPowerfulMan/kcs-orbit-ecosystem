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
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsService, studentsService, teachersService } from '../../services/api';
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

const riskWeights = {
  Low: 0.25,
  Medium: 0.6,
  High: 1,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

const variance = (values) => {
  if (!values.length) {
    return 0;
  }

  const average = mean(values);
  return values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
};

const standardDeviation = (values) => Math.sqrt(variance(values));

const quantile = (values, percentile) => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * percentile;
  const base = Math.floor(position);
  const remainder = position - base;
  if (sorted[base + 1] === undefined) {
    return sorted[base];
  }

  return sorted[base] + remainder * (sorted[base + 1] - sorted[base]);
};

const covariance = (left, right) => {
  if (!left.length || left.length !== right.length) {
    return 0;
  }

  const leftMean = mean(left);
  const rightMean = mean(right);
  return left.reduce((sum, value, index) => sum + ((value - leftMean) * (right[index] - rightMean)), 0) / left.length;
};

const pearsonCorrelation = (left, right) => {
  const denominator = standardDeviation(left) * standardDeviation(right);
  if (!denominator) {
    return 0;
  }

  return covariance(left, right) / denominator;
};

const linearSlope = (xValues, yValues) => {
  const denominator = variance(xValues);
  if (!denominator) {
    return 0;
  }

  return covariance(xValues, yValues) / denominator;
};

const giniCoefficient = (values) => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (!total) {
    return 0;
  }

  const weighted = sorted.reduce((sum, value, index) => sum + ((index + 1) * value), 0);
  return ((2 * weighted) / (sorted.length * total)) - ((sorted.length + 1) / sorted.length);
};

const entropy = (counts) => {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (!total) {
    return 0;
  }

  return counts.reduce((sum, count) => {
    if (!count) {
      return sum;
    }

    const probability = count / total;
    return sum - (probability * Math.log2(probability));
  }, 0);
};

const formatSigned = (value, digits = 2) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
const formatNullable = (value, suffix = '') => value === null || value === undefined ? 'N/A' : `${value}${suffix}`;

const normalizeLabel = (value, fallback) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
};

const buildDashboardStats = (overview, studentRows, teacherRows, sources = {}) => {
  const visibleStudents = Array.isArray(studentRows) ? studentRows : [];
  const visibleTeachers = Array.isArray(teacherRows) ? teacherRows : [];
  const activeStudents = visibleStudents.filter((student) => student.is_active !== false);
  const activeTeachers = visibleTeachers.filter((teacher) => teacher.is_active !== false && teacher.employment_status !== 'inactive');
  const classes = new Set(
    visibleStudents
      .map((student) => normalizeLabel(student.class_name, ''))
      .filter(Boolean)
  );

  return {
    total_students: sources.students ? activeStudents.length : (overview?.total_students || 0),
    total_teachers: sources.teachers ? activeTeachers.length : (overview?.total_teachers || 0),
    total_classes: sources.students ? classes.size : (overview?.total_classes || 0),
    attendance_rate_30d: overview?.attendance_rate_30d ?? 0,
    average_grade: overview?.average_grade ?? null,
    data_quality: overview?.data_quality || null,
  };
};

const DashboardPage = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [overviewResult, studentsResult, teachersResult] = await Promise.allSettled([
        analyticsService.getOverview(),
        studentsService.getAll(),
        teachersService.getAll(),
      ]);

      const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
      const studentRows = studentsResult.status === 'fulfilled' ? studentsResult.value : [];
      const teacherRows = teachersResult.status === 'fulfilled' ? teachersResult.value : [];

      setStats(buildDashboardStats(overview, studentRows, teacherRows, {
        students: studentsResult.status === 'fulfilled',
        teachers: teachersResult.status === 'fulfilled',
      }));
    };
    load();
  }, []);

  const science = useMemo(() => {
    const gradeValues = students.map((student) => student.average * 5);
    const attendanceValues = students.map((student) => student.attendance);
    const parentEngagementValues = parents.map((parent) => parent.engagement);
    const parentMeetingValues = parents.map((parent) => parent.meetings);
    const teacherCompletionValues = teachers.map((teacher) => teacher.completion);
    const teacherSatisfactionValues = teachers.map((teacher) => teacher.satisfaction);
    const teacherLoadValues = teachers.map((teacher) => Number.parseInt(teacher.load, 10));
    const monthlyGradeValues = monthlyPerformance.map((item) => item.grades * 5);
    const monthlyAttendanceValues = monthlyPerformance.map((item) => item.attendance);
    const monthIndexes = monthlyPerformance.map((_, index) => index + 1);
    const riskStudents = students.filter((student) => student.risk === 'High').length;
    const mediumRisk = students.filter((student) => student.risk === 'Medium').length;
    const parentEngagement = mean(parentEngagementValues);
    const avgAttendance = mean(attendanceValues);
    const avgGrade = mean(gradeValues);
    const gradeStd = standardDeviation(gradeValues);
    const attendanceStd = standardDeviation(attendanceValues);
    const teacherLoadMean = mean(teacherLoadValues);
    const teacherCompletionMean = mean(teacherCompletionValues);
    const teacherSatisfactionMean = mean(teacherSatisfactionValues);
    const gradeMedian = quantile(gradeValues, 0.5);
    const q1Grade = quantile(gradeValues, 0.25);
    const q3Grade = quantile(gradeValues, 0.75);
    const gradeIqr = q3Grade - q1Grade;
    const attendanceMedian = quantile(attendanceValues, 0.5);
    const gradeCorrelation = pearsonCorrelation(attendanceValues, gradeValues);
    const gradeSlope = linearSlope(attendanceValues, gradeValues);
    const ci95 = 1.96 * (gradeStd / Math.sqrt(Math.max(gradeValues.length, 1)));
    const interventionIndex = Math.round((riskStudents * 100 + mediumRisk * 45) / students.length);
    const coverageIndex = mean([advancedMetrics.curriculumCompletion, avgAttendance, advancedMetrics.parentEngagement]);
    const financeRisk = financeSignals.find((signal) => signal.label === 'En retard')?.value || 0;
    const passRate = (students.filter((student) => (student.average * 5) >= 75).length / students.length) * 100;
    const absenteeismPressure = (students.filter((student) => student.attendance < 80).length / students.length) * 100;
    const riskEntropy = entropy([students.filter((student) => student.risk === 'Low').length, mediumRisk, riskStudents]);
    const parentGini = giniCoefficient(parentEngagementValues);
    const teacherEfficiency = teacherCompletionMean / Math.max(teacherLoadMean, 1);
    const teacherLoadStd = standardDeviation(teacherLoadValues);
    const monthlyGradeSlope = linearSlope(monthIndexes, monthlyGradeValues);
    const monthlyAttendanceSlope = linearSlope(monthIndexes, monthlyAttendanceValues);
    const monthlyGradeMean = mean(monthlyGradeValues);
    const monthlyGradeStd = standardDeviation(monthlyGradeValues);
    const monthlyAttendanceMean = mean(monthlyAttendanceValues);
    const monthlyAttendanceStd = standardDeviation(monthlyAttendanceValues);
    const forecastGrade = monthlyGradeValues.at(-1) + monthlyGradeSlope;
    const forecastAttendance = monthlyAttendanceValues.at(-1) + monthlyAttendanceSlope;
    const gradeStabilityIndex = clamp(100 - ((gradeStd / Math.max(avgGrade, 1)) * 100 * 2.8), 0, 100);
    const precisionIndex = clamp(mean([
      passRate,
      advancedMetrics.retentionProbability,
      100 - (parentGini * 100),
      100 - financeRisk,
      gradeStabilityIndex,
    ]), 0, 100);

    const anomalyStudents = students
      .map((student) => {
        const gradeZ = gradeStd ? ((student.average * 5) - avgGrade) / gradeStd : 0;
        const attendanceZ = attendanceStd ? (student.attendance - avgAttendance) / attendanceStd : 0;
        const anomalyScore = Math.abs(Math.min(attendanceZ, 0)) + Math.abs(Math.min(gradeZ, 0));

        return {
          ...student,
          gradeZ,
          attendanceZ,
          anomalyScore,
        };
      })
      .sort((left, right) => right.anomalyScore - left.anomalyScore);

    const classMetrics = Object.values(
      students.reduce((accumulator, student) => {
        const current = accumulator[student.className] || {
          className: student.className,
          students: [],
          grades: [],
          attendance: [],
          trend: [],
          riskLoad: 0,
        };

        current.students.push(student);
        current.grades.push(student.average * 5);
        current.attendance.push(student.attendance);
        current.trend.push(Number.parseFloat(student.trend));
        current.riskLoad += riskWeights[student.risk];
        accumulator[student.className] = current;
        return accumulator;
      }, {})
    )
      .map((entry) => ({
        className: entry.className,
        avgGrade: mean(entry.grades),
        avgAttendance: mean(entry.attendance),
        trendMomentum: mean(entry.trend),
        riskLoad: (entry.riskLoad / entry.students.length) * 100,
        size: entry.students.length,
      }))
      .sort((left, right) => right.riskLoad - left.riskLoad);

    const controlChartData = monthlyPerformance.map((item) => ({
      month: item.month,
      grade: item.grades,
      attendance: item.attendance,
      target: monthlyGradeMean,
      upper: monthlyGradeMean + monthlyGradeStd,
      lower: monthlyGradeMean - monthlyGradeStd,
      attendanceUpper: monthlyAttendanceMean + monthlyAttendanceStd,
      attendanceLower: monthlyAttendanceMean - monthlyAttendanceStd,
    }));

    const statisticalHighlights = [
      {
        label: 'Corrélation présence / notes',
        value: gradeCorrelation.toFixed(2),
        detail: `Chaque point de présence ajoute environ ${gradeSlope.toFixed(2)} point à la note`,
      },
      {
        label: 'Intervalle de confiance 95%',
        value: `±${ci95.toFixed(2)}`,
        detail: `Autour d'une moyenne excellence de ${avgGrade.toFixed(2)}%`,
      },
      {
        label: 'Entropie du risque',
        value: riskEntropy.toFixed(2),
        detail: 'Mesure la dispersion des statuts Low / Medium / High',
      },
      {
        label: 'Coefficient de Gini parents',
        value: parentGini.toFixed(2),
        detail: '0 = engagement equilibre, 1 = polarisation forte',
      },
      {
        label: 'Volatilite attendance',
        value: `${((attendanceStd / Math.max(avgAttendance, 1)) * 100).toFixed(1)}%`,
        detail: `Médiane ${attendanceMedian.toFixed(1)}%`,
      },
      {
        label: 'Rendement enseignant',
        value: `${teacherEfficiency.toFixed(2)} pts/h`,
        detail: `Charge ${teacherLoadMean.toFixed(1)}h, dispersion ${teacherLoadStd.toFixed(1)}h`,
      },
    ];

    return {
      riskStudents,
      mediumRisk,
      parentEngagement,
      avgAttendance,
      avgGrade,
      gradeStd,
      attendanceStd,
      gradeMedian,
      q1Grade,
      q3Grade,
      gradeIqr,
      gradeCorrelation,
      gradeSlope,
      ci95,
      interventionIndex,
      coverageIndex,
      financeRisk,
      passRate,
      absenteeismPressure,
      riskEntropy,
      parentGini,
      teacherEfficiency,
      teacherLoadMean,
      teacherCompletionMean,
      teacherSatisfactionMean,
      monthlyGradeSlope,
      monthlyAttendanceSlope,
      forecastGrade,
      forecastAttendance,
      gradeStabilityIndex,
      precisionIndex,
      anomalyStudents,
      classMetrics,
      controlChartData,
      statisticalHighlights,
      monthlyGradeMean,
      monthlyGradeStd,
      monthlyAttendanceMean,
      monthlyAttendanceStd,
      averageMeetings: mean(parentMeetingValues),
    };
  }, []);

  const academicScatter = students.map((student) => ({
    name: student.name,
    attendance: student.attendance,
    average: student.average * 5,
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

  const scientificCards = [
    {
      title: 'Médiane académique',
      value: `${science.gradeMedian.toFixed(2)}%`,
      subtitle: `Q1 ${science.q1Grade.toFixed(1)} · Q3 ${science.q3Grade.toFixed(1)}`,
      accent: 'text-fuchsia-300',
    },
    {
      title: 'Dispersion IQR',
      value: science.gradeIqr.toFixed(2),
      subtitle: `Écart-type ${science.gradeStd.toFixed(2)}`,
      accent: 'text-orange-300',
    },
    {
      title: 'Taux de reussite',
      value: `${science.passRate.toFixed(1)}%`,
      subtitle: 'Élèves >= 75% excellence',
      accent: 'text-emerald-300',
    },
    {
      title: "Pression d'absenteisme",
      value: `${science.absenteeismPressure.toFixed(1)}%`,
      subtitle: 'Presence < 80%',
      accent: 'text-rose-300',
    },
    {
      title: 'Projection prochaine periode',
      value: `${science.forecastGrade.toFixed(2)}%`,
      subtitle: `Pente ${formatSigned(science.monthlyGradeSlope, 2)} / mois`,
      accent: 'text-cyan-300',
    },
    {
      title: 'Projection de présence',
      value: `${science.forecastAttendance.toFixed(1)}%`,
      subtitle: `Pente ${formatSigned(science.monthlyAttendanceSlope, 2)} / mois`,
      accent: 'text-sky-300',
    },
    {
      title: 'Indice de stabilite',
      value: `${science.gradeStabilityIndex.toFixed(1)}%`,
      subtitle: 'Moins de volatilite, plus de precision',
      accent: 'text-violet-300',
    },
    {
      title: 'Indice de precision global',
      value: `${science.precisionIndex.toFixed(1)}%`,
      subtitle: 'Synthèse académique, sociale et financière',
      accent: 'text-teal-300',
    },
  ];
  const dataQuality = stats?.data_quality;

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">SAVANEX scientific command center</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('dashboard.overview')}</h2>
          <p className="mt-1 text-sm text-slate-400">{t('dashboard.subtitle')} Analyse académique, statistique, opérationnelle et financière pour piloter KCS.</p>
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
        <StatCard title={t('dashboard.attendanceRate')} value={formatNullable(stats?.attendance_rate_30d, '%')} accent="text-amber-300" />
        <StatCard title="Moyenne excellence" value={formatNullable(stats?.average_grade, '%')} subtitle={stats?.average_classical_equivalent_percentage === null || stats?.average_classical_equivalent_percentage === undefined ? `${dataQuality?.grade_records || 0} note(s) vérifiée(s)` : `Équiv. classique ${stats.average_classical_equivalent_percentage}%`} accent="text-rose-300" />
      </section>

      {dataQuality ? (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Données de présence" value={dataQuality.attendance_records_30d} subtitle="Enregistrements des 30 derniers jours" accent="text-cyan-300" />
            <StatCard title="Données de notes" value={dataQuality.grade_records} subtitle="Notes réelles sur 100% d'excellence" accent="text-orange-300" />
            <StatCard title="Présence calculable" value={dataQuality.attendance_rate_is_available ? 'Oui' : 'Non'} subtitle="Aucune valeur artificielle si vide" accent="text-emerald-300" />
            <StatCard title="Moyenne calculable" value={dataQuality.average_grade_is_available ? 'Oui' : 'Non'} subtitle="Basée uniquement sur les vraies notes" accent="text-teal-300" />
          </section>

          <section className="card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Cohérence scientifique</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Statistiques basées sur les données réelles de l'écosystème</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(dataQuality.notes || []).map((note) => (
                <p key={note} className="rounded-xl border border-github-border bg-slate-950/45 p-3 text-sm text-slate-300">{note}</p>
              ))}
              <p className="rounded-xl border border-github-border bg-slate-950/45 p-3 text-sm text-slate-300">
                Les graphiques scientifiques de démonstration sont masqués en mode données réelles tant que les séries historiques complètes ne sont pas disponibles.
              </p>
            </div>
          </section>
        </>
      ) : (
        <>
      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Moyenne excellence" value={`${science.avgGrade.toFixed(1)}%`} subtitle={`Écart-type ${science.gradeStd.toFixed(2)}`} accent="text-orange-300" />
        <StatCard title="Engagement parents" value={`${science.parentEngagement.toFixed(1)}%`} subtitle={`${science.averageMeetings.toFixed(1)} réunions en moyenne`} accent="text-emerald-300" />
        <StatCard title="Couverture pédagogique" value={`${science.coverageIndex.toFixed(1)}%`} subtitle="Présence + programme + parents" accent="text-cyan-300" />
        <StatCard title="Risque financier" value={`${science.financeRisk}%`} subtitle="Paiements en retard" accent="text-amber-300" />
      </section>

      <section className="mb-6 metric-grid">
        {scientificCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            accent={card.accent}
          />
        ))}
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
                <Legend />
                <Bar dataKey="attendance" fill="#22d3ee" radius={[8, 8, 0, 0]} name="Presence" />
                <Line type="monotone" dataKey="engagement" stroke="#34d399" strokeWidth={3} name="Engagement" />
                <Line type="monotone" dataKey="grades" stroke="#f8fafc" strokeWidth={2} name="Moyenne" />
                <Line type="monotone" dataKey="risk" stroke="#fb7185" strokeWidth={3} name="Risque" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-xl font-semibold text-slate-100">Radar institutionnel</h3>
          <p className="mt-1 text-sm text-slate-400">Lecture rapide de la santé globale de l'école.</p>
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
          <h3 className="font-display text-lg font-semibold text-slate-100">Dispersion présence / moyenne</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="attendance" name="Presence" unit="%" stroke="#94a3b8" />
                <YAxis dataKey="average" name="Moyenne excellence" unit="%" stroke="#94a3b8" />
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
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-950/45 p-3">
              <p className="text-xs text-slate-500">Charge moy.</p>
              <p className="mt-2 font-metric text-lg font-semibold text-slate-100">{science.teacherLoadMean.toFixed(1)}h</p>
            </div>
            <div className="rounded-xl bg-slate-950/45 p-3">
              <p className="text-xs text-slate-500">Completion</p>
              <p className="mt-2 font-metric text-lg font-semibold text-slate-100">{science.teacherCompletionMean.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl bg-slate-950/45 p-3">
              <p className="text-xs text-slate-500">Satisfaction</p>
              <p className="mt-2 font-metric text-lg font-semibold text-slate-100">{science.teacherSatisfactionMean.toFixed(1)}%</p>
            </div>
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

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-100">Carte de controle des notes</h3>
              <p className="mt-1 text-sm text-slate-400">Suivi inferentiel avec moyenne centrale et bornes de controle.</p>
            </div>
            <div className="rounded-xl border border-github-border bg-slate-950/40 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Sigma</p>
              <p className="font-metric text-sm text-slate-100">{science.monthlyGradeStd.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={science.controlChartData}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[50, 100]} />
                <Tooltip contentStyle={chartTooltip} />
                <Legend />
                <ReferenceLine y={science.monthlyGradeMean} stroke="#94a3b8" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="grade" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4 }} name="Notes" />
                <Line type="monotone" dataKey="upper" stroke="#f59e0b" strokeDasharray="6 6" dot={false} name="Borne haute" />
                <Line type="monotone" dataKey="lower" stroke="#fb7185" strokeDasharray="6 6" dot={false} name="Borne basse" />
                <Line type="monotone" dataKey="target" stroke="#f8fafc" dot={false} name="Centre" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-100">Surface scientifique par classe</h3>
              <p className="mt-1 text-sm text-slate-400">Moyennes, risque relatif et momentum de tendance par cohorte.</p>
            </div>
            <div className="rounded-xl border border-github-border bg-slate-950/40 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Risque max</p>
              <p className="font-metric text-sm text-rose-200">{science.classMetrics[0]?.riskLoad.toFixed(1) || '0.0'}%</p>
            </div>
          </div>
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={science.classMetrics}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="className" stroke="#94a3b8" fontSize={11} />
                <YAxis yAxisId="left" stroke="#94a3b8" />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                <Tooltip contentStyle={chartTooltip} />
                <Legend />
                <Bar yAxisId="left" dataKey="riskLoad" fill="#fb7185" radius={[8, 8, 0, 0]} name="Risque" />
                <Line yAxisId="right" type="monotone" dataKey="avgGrade" stroke="#22d3ee" strokeWidth={3} name="Note moyenne" />
                <Line yAxisId="right" type="monotone" dataKey="avgAttendance" stroke="#34d399" strokeWidth={2} name="Presence moyenne" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5 xl:col-span-2">
          <h3 className="font-display text-lg font-semibold text-slate-100">Indicateurs statistiques avancés</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {science.statisticalHighlights.map((item) => (
              <div key={item.label} className="metric-chip">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-2 font-metric text-2xl font-bold text-slate-100">{item.value}</p>
                <p className="mt-2 text-sm text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Diagnostic rapide</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p className="rounded-xl border border-github-border bg-slate-950/45 p-3">
              La corrélation présence / notes est <span className="font-metric text-cyan-200">{science.gradeCorrelation.toFixed(2)}</span>, ce qui confirme un lien mesurable entre assiduité et performance.
            </p>
            <p className="rounded-xl border border-github-border bg-slate-950/45 p-3">
              La moyenne excellence projetée au prochain cycle est <span className="font-metric text-emerald-200">{science.forecastGrade.toFixed(2)}%</span>, avec une présence attendue de <span className="font-metric text-sky-200">{science.forecastAttendance.toFixed(1)}%</span>.
            </p>
            <p className="rounded-xl border border-github-border bg-slate-950/45 p-3">
              L'inégalité d'engagement des parents est de <span className="font-metric text-fuchsia-200">{science.parentGini.toFixed(2)}</span>; il faut concentrer les relances sur les familles les moins présentes.
            </p>
            <p className="rounded-xl border border-github-border bg-slate-950/45 p-3">
              L'entropie du risque est de <span className="font-metric text-amber-200">{science.riskEntropy.toFixed(2)}</span>; plus elle baisse, plus le portefeuille d'élèves converge vers des profils stables.
            </p>
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
                <Area type="monotone" dataKey="students" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.18} name="Élèves" />
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
                    <p className="rounded-xl bg-slate-900/80 p-2 text-slate-300">Moy. {(student.average * 5).toFixed(0)}%</p>
                    <p className="rounded-xl bg-slate-900/80 p-2 text-slate-300">Trend {student.trend}</p>
                  </div>
                </div>
              ))}
          </div>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Tableau des anomalies et ecarts-types</h3>
          <div className="mt-4 space-y-3">
            {science.anomalyStudents.slice(0, 4).map((student) => (
              <div key={student.id} className="rounded-2xl border border-github-border bg-slate-950/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">{student.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{student.className} · {student.parent}</p>
                  </div>
                  <span className={`text-xs font-semibold ${riskColors[student.risk]}`}>{student.risk}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <p className="rounded-xl bg-slate-900/80 p-2 text-slate-300">z note {student.gradeZ.toFixed(2)}</p>
                  <p className="rounded-xl bg-slate-900/80 p-2 text-slate-300">z présence {student.attendanceZ.toFixed(2)}</p>
                  <p className="rounded-xl bg-slate-900/80 p-2 text-slate-300">score {student.anomalyScore.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-display text-lg font-semibold text-slate-100">Lecture mathematique et statistique</h3>
          <div className="mt-4 grid gap-3">
            {[
              `r = ${science.gradeCorrelation.toFixed(2)} : force du lien linéaire entre présence et moyenne.`,
              `CI95 = moyenne ± ${science.ci95.toFixed(2)} : zone de confiance sur la moyenne observee.`,
              `IQR = ${science.gradeIqr.toFixed(2)} : dispersion centrale des performances élèves.`,
              `Slope = ${formatSigned(science.gradeSlope, 2)} : gain estimé sur la note pour 1 point de présence.`,
              `Gini = ${science.parentGini.toFixed(2)} : asymetrie de participation des familles.`,
              `Entropy = ${science.riskEntropy.toFixed(2)} : niveau d'hétérogénéité des risques élèves.`,
            ].map((item) => (
              <p key={item} className="rounded-xl border border-github-border bg-slate-950/45 p-3 text-sm text-slate-300">{item}</p>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {[
          `Prioriser les élèves sous 75% de présence avec rendez-vous parent sous 72h. Impact estimé : ${science.absenteeismPressure.toFixed(1)}% du portefeuille.`,
          `Comparer la charge enseignant avec completion programme. Rendement actuel: ${science.teacherEfficiency.toFixed(2)} points de completion par heure.`,
          `Croiser retards de paiement et baisse académique avant sanction administrative. Risque financier courant : ${science.financeRisk}%.`,
          `Lancer une campagne parents pour les classes avec engagement sous 70%. Gini d'engagement: ${science.parentGini.toFixed(2)}.`,
        ].map((item, index) => (
          <article key={item} className="card p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Action {index + 1}</p>
            <p className="mt-3 text-sm text-slate-300">{item}</p>
          </article>
        ))}
      </section>
        </>
      )}
    </DashboardLayout>
  );
};

export default DashboardPage;
