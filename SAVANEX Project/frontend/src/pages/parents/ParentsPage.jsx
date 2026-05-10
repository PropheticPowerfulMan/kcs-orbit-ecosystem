import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import EntityDetailPanel from '../../components/ui/EntityDetailPanel';
import StatCard from '../../components/ui/StatCard';
import { parentsService, sharedDirectoryService, studentsService } from '../../services/api';

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

const splitFullName = (value) => {
  const parts = normalizeLabel(value, '').split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || '',
  };
};

const ParentsPage = () => {
  const [query, setQuery] = useState('');
  const [classLevelFilter, setClassLevelFilter] = useState('all');
  const [classSuffixFilter, setClassSuffixFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [students, setStudents] = useState([]);
  const [directory, setDirectory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const [editingParent, setEditingParent] = useState(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadStudents = async () => {
    setLoading(true);
    setError('');

    const [studentResult, directoryResult] = await Promise.allSettled([
        studentsService.getAll(),
        sharedDirectoryService.get(),
      ]);

    if (studentResult.status === 'fulfilled') {
      setStudents(Array.isArray(studentResult.value) ? studentResult.value : []);
    } else {
      setStudents([]);
    }

    if (directoryResult.status === 'fulfilled') {
      setDirectory(directoryResult.value || null);
    } else {
      setDirectory(null);
    }

    if (studentResult.status === 'rejected' && directoryResult.status === 'rejected') {
      setError('Impossible de charger les familles pour le moment.');
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadStudents();
  }, []);

  const familyRows = useMemo(() => {
    if (Array.isArray(directory?.parents)) {
      const studentsByParent = new Map();
      for (const student of Array.isArray(directory?.students) ? directory.students : []) {
        const parentId = student.parentId || '';
        const current = studentsByParent.get(parentId) || [];
        current.push(student);
        studentsByParent.set(parentId, current);
      }

      return directory.parents
        .map((parent) => {
          const linkedStudents = studentsByParent.get(parent.id) || [];
          const classes = new Set(linkedStudents.map((student) => normalizeLabel(student.className, 'Non assignée')));
          const classParts = linkedStudents.map((student) => splitClassName(student.className || ''));
          return {
            id: parent.id,
            family_name: parent.fullName || parent.displayId || 'Parent Orbit',
            full_name: parent.fullName || parent.displayId || 'Parent Orbit',
            first_name: parent.firstName || splitFullName(parent.fullName || '').first_name,
            last_name: parent.lastName || splitFullName(parent.fullName || '').last_name,
            students_label: linkedStudents.length
              ? linkedStudents.map((student) => student.fullName || student.displayId).join(', ')
              : 'Aucun élève lié',
            linked_student_ids: linkedStudents.map((student) => student.studentNumber || student.displayId || student.id).filter(Boolean).join(', '),
            classes_label: Array.from(classes).sort((left, right) => left.localeCompare(right)).join(', '),
            class_parts: classParts,
            student_count: linkedStudents.length,
            activeStudents: linkedStudents.filter((student) => (student.status || 'ACTIVE') !== 'INACTIVE').length,
            kcs_card_id: parent.displayId,
            parent_external_id: parent.displayId,
            email: parent.email || '',
            phone: parent.phone || '',
            photo_data: '',
            left_fingerprint_data: '',
            right_fingerprint_data: '',
            management_id: parent.id,
            management_source: 'orbit',
            identifier_type: 'orbitId',
          };
        })
        .sort((left, right) => right.student_count - left.student_count || left.family_name.localeCompare(right.family_name));
    }

    const groups = new Map();

    for (const student of students) {
      const familyName = normalizeLabel(student.parent_name, 'Aucun parent lié');
      const current = groups.get(familyName) || {
        id: student.parent || slugify(familyName),
        family_name: familyName,
        full_name: familyName,
        first_name: splitFullName(familyName).first_name,
        last_name: splitFullName(familyName).last_name,
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
        management_id: student.parent || null,
        management_source: 'local',
        identifier_type: 'local',
        student_ids: [],
      };

      current.students.push(student.full_name);
      current.student_ids.push(student.student_id);
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
        full_name: group.full_name,
        first_name: group.first_name,
        last_name: group.last_name,
        students_label: group.students.join(', '),
        linked_student_ids: group.student_ids.filter(Boolean).join(', '),
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
        management_id: group.management_id,
        management_source: group.management_source,
        identifier_type: group.identifier_type,
      }))
      .sort((left, right) => right.student_count - left.student_count || left.family_name.localeCompare(right.family_name));
  }, [directory, students]);

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

      const haystack = `${family.family_name} ${family.students_label} ${family.linked_student_ids || ''} ${family.classes_label} ${family.parent_external_id || ''} ${family.management_id || ''} ${family.kcs_card_id || ''} ${family.email || ''} ${family.phone || ''}`.toLowerCase();
      if (normalizedQuery && !haystack.includes(normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [classLevelFilter, classSuffixFilter, familyFilter, familyRows, query]);

  useEffect(() => {
    if (selectedParent && !familyRows.some((row) => row.id === selectedParent.id)) {
      setSelectedParent(null);
    }

    if (editingParent && !familyRows.some((row) => row.id === editingParent.id)) {
      setEditingParent(null);
    }
  }, [editingParent, familyRows, selectedParent]);

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

  const openEdit = (row) => {
    setEditingParent(row);
    setEditForm({
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email || '',
      phone: row.phone || '',
    });
  };

  const handleSave = async () => {
    if (!editingParent?.management_id) {
      setError('Ce parent ne peut pas être modifié depuis cette vue.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await parentsService.update(editingParent.management_id, editForm, {
        source: editingParent.management_source,
        identifierType: editingParent.identifier_type,
      });
      setEditingParent(null);
      await loadStudents();
    } catch (saveError) {
      setError(saveError?.response?.data?.message || saveError?.message || 'Impossible de modifier ce parent.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row.management_id) {
      setError('Ce parent ne peut pas être supprimé depuis cette vue.');
      return;
    }

    const confirmed = window.confirm(`Supprimer ${row.family_name} ?`);
    if (!confirmed) return;

    setSubmitting(true);
    setError('');
    try {
      await parentsService.remove(row.management_id, {
        source: row.management_source,
        identifierType: row.identifier_type,
      });
      if (selectedParent?.id === row.id) {
        setSelectedParent(null);
      }
      if (editingParent?.id === row.id) {
        setEditingParent(null);
      }
      await loadStudents();
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || deleteError?.message || 'Impossible de supprimer ce parent.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'family_name', label: 'Famille / Parent' },
    { key: 'students_label', label: 'Élèves liés' },
    { key: 'classes_label', label: 'Classes' },
    { key: 'student_count', label: 'Effectif' },
    { key: 'kcs_card_id', label: 'Carte KCS', render: (value) => value || 'Non générée' },
    { key: 'activeStudents', label: 'Actifs' },
    {
      key: 'details',
      label: 'Action',
      render: (_value, row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedParent({ ...row, full_name: row.family_name, role: 'Parent' })} className="rounded-lg border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10">Voir</button>
          <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-amber-400/30 px-3 py-1 text-xs text-amber-200 hover:bg-amber-400/10">Modifier</button>
          <button type="button" onClick={() => void handleDelete(row)} className="rounded-lg border border-rose-400/30 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10">Supprimer</button>
        </div>
      )
    },
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
            placeholder="Rechercher parent, famille, élève, classe ou ID..."
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

      {editingParent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-github-border bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Gestion parent</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-slate-100">Modifier {editingParent.family_name}</h3>
              </div>
              <button type="button" onClick={() => setEditingParent(null)} className="rounded-xl border border-github-border px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/70">Fermer</button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <input value={editForm.first_name} onChange={(event) => setEditForm({ ...editForm, first_name: event.target.value })} placeholder="Prénom" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
              <input value={editForm.last_name} onChange={(event) => setEditForm({ ...editForm, last_name: event.target.value })} placeholder="Nom" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
              <input value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} placeholder="Email" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue sm:col-span-2" />
              <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="Téléphone" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue sm:col-span-2" />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingParent(null)} className="rounded-xl border border-github-border px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/70">Annuler</button>
              <button type="button" onClick={() => void handleSave()} disabled={submitting} className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
