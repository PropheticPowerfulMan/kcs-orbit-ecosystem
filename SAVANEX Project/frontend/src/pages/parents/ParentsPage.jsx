import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import EntityDetailPanel from '../../components/ui/EntityDetailPanel';
import StatCard from '../../components/ui/StatCard';
import { studentsService } from '../../services/api';

const normalizeLabel = (value, fallback) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const standardClassLevels = [
  'K1', 'K2', 'K3', 'K4', 'K5',
  ...Array.from({ length: 12 }, (_item, index) => `Grade ${index + 1}`),
];
const classSuffixes = ['', ...Array.from({ length: 26 }, (_item, index) => String.fromCharCode(65 + index))];

const splitClassName = (value) => {
  const className = normalizeLabel(value, 'Non assignée');
  const match = className.match(/^(K[1-5]|Grade\s+(?:[1-9]|1[0-2]))(?:\s+([A-Z]))?$/i);

  if (!match) {
    return { level: className, suffix: '' };
  }

  const rawLevel = match[1].replace(/\s+/g, ' ');
  const level = rawLevel.toLowerCase().startsWith('grade')
    ? `Grade ${rawLevel.match(/\d+/)?.[0] || ''}`.trim()
    : rawLevel.toUpperCase();

  return { level, suffix: (match[2] || '').toUpperCase() };
};

const ParentsPage = () => {
  const [query, setQuery] = useState('');
  const [classLevelFilter, setClassLevelFilter] = useState('all');
  const [classSuffixFilter, setClassSuffixFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await studentsService.getAll();
        setStudents(data);
      } catch {
        setError('Impossible de charger les familles pour le moment.');
      } finally {
        setLoading(false);
      }
    };

    void loadStudents();
  }, []);

  const familyRows = useMemo(() => {
    const groups = new Map();

    for (const student of students) {
      const familyName = normalizeLabel(student.parent_name, 'Aucun parent lié');
      const current = groups.get(familyName) || {
        id: slugify(familyName),
        family_name: familyName,
        students: [],
        classes: new Set(),
        classParts: [],
        activeStudents: 0,
        kcs_card_id: student.parent_kcs_card_id,
        parent_external_id: student.parent_external_id,
        email: student.parent_email,
        phone: student.parent_phone,
        photo_data: student.parent_photo_data,
        left_fingerprint_data: student.parent_left_fingerprint_data,
        right_fingerprint_data: student.parent_right_fingerprint_data,
      };

      current.students.push(student.full_name);
      const className = normalizeLabel(student.class_name, 'Non assignée');
      current.classes.add(className);
      current.classParts.push(splitClassName(className));
      if (student.is_active) {
        current.activeStudents += 1;
      }

      groups.set(familyName, current);
    }

    return Array.from(groups.values())
      .map((group) => ({
        id: group.id,
        family_name: group.family_name,
        students_label: group.students.join(', '),
        classes_label: Array.from(group.classes).sort((left, right) => left.localeCompare(right)).join(', '),
        class_parts: group.classParts,
        student_count: group.students.length,
        activeStudents: group.activeStudents,
        kcs_card_id: group.kcs_card_id,
        parent_external_id: group.parent_external_id,
        email: group.email,
        phone: group.phone,
        photo_data: group.photo_data,
        left_fingerprint_data: group.left_fingerprint_data,
        right_fingerprint_data: group.right_fingerprint_data,
      }))
      .sort((left, right) => right.student_count - left.student_count || left.family_name.localeCompare(right.family_name));
  }, [students]);

  const familyOptions = useMemo(
    () => familyRows.map((row) => row.family_name),
    [familyRows]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return familyRows.filter((family) => {
      if (classLevelFilter !== 'all' && !family.class_parts.some((classPart) => classPart.level === classLevelFilter)) {
        return false;
      }

      if (classSuffixFilter !== 'all' && !family.class_parts.some((classPart) => classPart.suffix === classSuffixFilter)) {
        return false;
      }

      if (familyFilter !== 'all' && family.family_name !== familyFilter) {
        return false;
      }

      const haystack = `${family.family_name} ${family.students_label} ${family.classes_label}`.toLowerCase();
      if (normalizedQuery && !haystack.includes(normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [classLevelFilter, classSuffixFilter, familyFilter, familyRows, query]);

  const classGroups = useMemo(() => {
    const groups = new Map();

    for (const family of filtered) {
      const classLabels = family.classes_label.split(', ').filter(Boolean);
      for (const className of classLabels.length ? classLabels : ['Non assignée']) {
        const current = groups.get(className) || { className, families: [], students: 0 };
        current.families.push(family.family_name);
        current.students += family.student_count;
        groups.set(className, current);
      }
    }

    return Array.from(groups.values())
      .map((group) => ({ ...group, families: Array.from(new Set(group.families)).sort((left, right) => left.localeCompare(right)) }))
      .sort((left, right) => right.students - left.students || left.className.localeCompare(right.className));
  }, [filtered]);

  const activeFamilies = filtered.filter((family) => family.activeStudents > 0).length;
  const totalStudents = filtered.reduce((sum, family) => sum + family.student_count, 0);
  const classesCovered = classGroups.length;

  const columns = [
    { key: 'family_name', label: 'Famille / Parent' },
    { key: 'students_label', label: 'Élèves liés' },
    { key: 'classes_label', label: 'Classes' },
    { key: 'student_count', label: 'Effectif' },
    { key: 'kcs_card_id', label: 'Carte KCS', render: (value) => value || 'Non générée' },
    { key: 'activeStudents', label: 'Actifs' },
    { key: 'details', label: 'Action', render: (_value, row) => <button type="button" onClick={() => setSelectedParent({ ...row, full_name: row.family_name, role: 'Parent' })} className="rounded-lg border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10">Voir</button> },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Parent relationship management</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">Classement des familles et parents</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Recherche et regroupement des foyers par famille et par classe à partir des élèves reliés dans SAVANEX.</p>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Familles actives" value={activeFamilies} accent="text-cyan-300" />
        <StatCard title="Élèves reliés" value={totalStudents} subtitle="Visibles dans les familles" accent="text-emerald-300" />
        <StatCard title="Classes couvertes" value={classesCovered} subtitle="Classes reliées aux familles" accent="text-amber-300" />
        <StatCard title="Résultats filtrés" value={filtered.length} subtitle="Familles correspondant à la recherche" accent="text-rose-300" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="card p-5 xl:col-span-2">
          <p className="font-display text-lg font-semibold text-slate-100">Classement par famille</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {filtered.slice(0, 4).map((family, index) => (
              <div key={family.id} className="rounded-2xl border border-github-border bg-slate-950/40 p-4">
                <p className="text-xs text-slate-500">Famille {index + 1}</p>
                <p className="mt-1 font-semibold text-slate-100">{family.family_name}</p>
                <p className="mt-2 text-xs text-slate-400">{family.student_count} élève(s) - {family.classes_label || 'Non assignée'}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="card p-5">
          <p className="font-display text-lg font-semibold text-slate-100">Classement par classe</p>
          <div className="mt-4 space-y-3">
            {classGroups.slice(0, 4).map((group) => (
              <div key={group.className} className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <p className="font-semibold text-slate-100">{group.className}</p>
                <p className="mt-1 text-xs text-slate-400">{group.students} élève(s) - {group.families.length} famille(s)</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <div className="mb-4 card p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher parent, famille, élève ou classe..."
            className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue"
          />
          <select value={classLevelFilter} onChange={(event) => setClassLevelFilter(event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
            <option value="all">Tous les niveaux</option>
            {standardClassLevels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          <select value={classSuffixFilter} onChange={(event) => setClassSuffixFilter(event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
            <option value="all">Tous les suffixes</option>
            <option value="">Sans suffixe</option>
            {classSuffixes.filter(Boolean).map((suffix) => (
              <option key={suffix} value={suffix}>Suffixe {suffix}</option>
            ))}
          </select>
          <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
            <option value="all">Toutes les familles</option>
            {familyOptions.map((familyName) => (
              <option key={familyName} value={familyName}>{familyName}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? <p className="mb-4 text-sm text-slate-400">Chargement des familles...</p> : null}
      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}
      <DataTable columns={columns} data={filtered} />

      <EntityDetailPanel entity={selectedParent} type="parent" onClose={() => setSelectedParent(null)} />

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Recherche parents</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Groupement détaillé par famille</h3>
          <div className="mt-4 space-y-3">
            {filtered.length ? filtered.map((family) => (
              <div key={family.id} className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-100">{family.family_name}</p>
                  <span className="text-xs text-slate-400">{family.student_count} élève(s)</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Classes : {family.classes_label || 'Non assignée'}</p>
                <p className="mt-3 text-sm text-slate-300">{family.students_label}</p>
              </div>
            )) : <p className="text-sm text-slate-400">Aucune famille ne correspond aux filtres en cours.</p>}
          </div>
        </article>

        <article className="card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Classement</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Classes et familles associées</h3>
          <div className="mt-4 space-y-3">
            {classGroups.length ? classGroups.map((group) => (
              <div key={slugify(group.className)} className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-100">{group.className}</p>
                  <span className="text-xs text-slate-400">{group.students} élève(s)</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{group.families.join(', ')}</p>
              </div>
            )) : <p className="text-sm text-slate-400">Aucune classe ne correspond aux filtres en cours.</p>}
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
};

export default ParentsPage;
