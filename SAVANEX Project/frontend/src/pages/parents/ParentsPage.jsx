import LegacyImportLink from '../../components/common/LegacyImportLink';
import InternationalPhoneInput from '../../components/InternationalPhoneInput';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { IdentityCapturePanel } from '../../components/ui/KcsIdentityTools';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import EntityDetailPanel from '../../components/ui/EntityDetailPanel';
import EntityPdfButton from '../../components/ui/EntityPdfButton';
import SearchField from '../../components/ui/SearchField';
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
  'K3', 'K4', 'K5',
  ...Array.from({ length: 12 }, (_item, index) => `Grade ${index + 1}`),
];
const classSuffixes = ['', ...Array.from({ length: 26 }, (_item, index) => String.fromCharCode(65 + index))];

const splitClassName = (value) => {
  const className = normalizeLabel(value, 'Non assignée').replace(/\s+/g, ' ');
  const sectionMatch = className.match(/^(.*?)(?:\s+([A-Z]))?$/);
  const rawLevel = sectionMatch?.[1]?.trim() || className;
  const suffix = (sectionMatch?.[2] || '').toUpperCase();
  const kindergarten = rawLevel.match(/^(?:kindergarten(?:\s+grade)?\s*)?k?([3-5])$/i);
  if (kindergarten) {
    return { level: `K${kindergarten[1]}`, suffix };
  }

  const grade = rawLevel.match(/^grade\s*(\d{1,2})(?:\s+grade\s*\1)?$/i);
  if (grade) {
    return { level: `Grade ${Number(grade[1])}`, suffix };
  }

  return { level: rawLevel, suffix };
};

const normalizeClassName = (value) => {
  const { level, suffix } = splitClassName(value);
  return [level, suffix].filter(Boolean).join(' ');
};

const splitFullName = (value) => {
  const parts = normalizeLabel(value, '').split(/\s+/).filter(Boolean);
  return {
    last_name: parts[0] || '',
    middle_name: parts.slice(1, -1).join(' ') || '',
    first_name: parts.length > 1 ? parts[parts.length - 1] : '',
  };
};

const ParentsPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [classLevelFilter, setClassLevelFilter] = useState('all');
  const [classSuffixFilter, setClassSuffixFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [students, setStudents] = useState([]);
  const [directory, setDirectory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedClassGroup, setSelectedClassGroup] = useState(null);
  const [editingParent, setEditingParent] = useState(null);
  const [editForm, setEditForm] = useState({ last_name: '', middle_name: '', first_name: '', email: '', phone: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [temporaryCredentials, setTemporaryCredentials] = useState(null);

  const loadStudents = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }

    const [studentResult, directoryResult] = await Promise.allSettled([
        studentsService.getAll(),
        sharedDirectoryService.get(),
      ]);

    if (studentResult.status === 'fulfilled') {
      setStudents(Array.isArray(studentResult.value) ? studentResult.value : []);
    } else if (!silent) {
      setStudents([]);
    }

    if (directoryResult.status === 'fulfilled') {
      setDirectory(directoryResult.value || null);
    } else if (!silent) {
      setDirectory(null);
    }

    if (!silent && studentResult.status === 'rejected' && directoryResult.status === 'rejected') {
      setError('Impossible de charger les familles pour le moment.');
    }

    if (!silent) setLoading(false);
  };

  useEffect(() => {
    void loadStudents();
    let refreshInFlight = false;
    const refresh = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        await loadStudents(true);
      } finally {
        refreshInFlight = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 1500);
    window.addEventListener('focus', refresh);
    window.addEventListener('savanex:directory-changed', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('savanex:directory-changed', refresh);
    };
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

      const localStudentsByExternalId = new Map(
        students
          .filter((student) => !String(student?.id || '').startsWith('orbit:'))
          .map((student) => [String(student?.student_id || '').trim().toLowerCase(), student])
          .filter(([studentId]) => studentId)
      );

      return directory.parents
        .map((parent) => {
          const orbitStudents = studentsByParent.get(parent.id) || [];
          const savanexExternalId = (Array.isArray(parent.externalIds) ? parent.externalIds : [])
            .map((entry) => typeof entry === 'string' ? { appSlug: '', externalId: entry } : entry)
            .find((entry) => String(entry?.appSlug || '').toUpperCase() === 'SAVANEX')?.externalId || '';
          const localFamilyStudents = students.filter((student) => (
            savanexExternalId && student.parent_external_id === savanexExternalId && !String(student.id || '').startsWith('orbit:')
          ));
          const linkedStudents = orbitStudents.length ? orbitStudents : localFamilyStudents.map((student) => ({
            id: student.id,
            fullName: student.full_name,
            displayId: student.student_id,
            studentNumber: student.student_id,
            className: student.class_name,
            status: student.is_active ? 'ACTIVE' : 'INACTIVE',
          }));
          const localParentId = localFamilyStudents[0]?.parent || null;
          const classes = new Set(linkedStudents.map((student) => normalizeClassName(student.className)));
          const classParts = linkedStudents.map((student) => splitClassName(student.className || ''));
          return {
            id: parent.id,
            family_name: parent.fullName || parent.displayId || 'Parent Orbit',
            full_name: parent.fullName || parent.displayId || 'Parent Orbit',
            first_name: parent.firstName || splitFullName(parent.fullName || '').first_name,
            middle_name: parent.middleName || splitFullName(parent.fullName || '').middle_name,
            last_name: parent.lastName || splitFullName(parent.fullName || '').last_name,
            access_code: parent.accessCode || '',
            students_label: linkedStudents.length
              ? linkedStudents.map((student) => student.fullName || student.displayId).join(', ')
              : 'Aucun élève lié',
            linked_student_ids: linkedStudents.map((student) => student.studentNumber || student.displayId || student.id).filter(Boolean).join(', '),
            classes_label: Array.from(classes).sort((left, right) => left.localeCompare(right)).join(', '),
            class_parts: classParts,
            student_count: linkedStudents.length,
            activeStudents: linkedStudents.filter((student) => (student.status || 'ACTIVE') !== 'INACTIVE').length,
            linked_students: linkedStudents.map((student) => {
              if (!orbitStudents.length) {
                return student;
              }

              const savanexExternalId = (Array.isArray(student.externalIds) ? student.externalIds : [])
                .map((entry) => typeof entry === 'string' ? { appSlug: '', externalId: entry } : entry)
                .find((entry) => String(entry?.appSlug || '').toUpperCase() === 'SAVANEX')?.externalId;
              const localStudent = localStudentsByExternalId.get(
                String(savanexExternalId || student.studentNumber || '').trim().toLowerCase()
              );

              // Route SAVANEX-owned children through the local endpoint so SAVANEX is
              // updated first and its normal Orbit propagation remains authoritative.
              if (localStudent) {
                return localStudent;
              }

              return {
                id: `orbit:${student.id}`,
                student_id: student.studentNumber || student.displayId || student.id,
                full_name: student.fullName || student.displayId || '',
                email: student.email || '',
                class_name: student.className || '',
                date_of_birth: student.dateOfBirth || '',
                gender: student.gender || '',
                notes: student.notes || '',
              };
            }),
            kcs_card_id: parent.displayId,
            parent_external_id: parent.displayId,
            email: parent.email || '',
            phone: parent.phone || '',
            address: parent.physicalAddress || '',
            photo_data: parent.photoData || '',
            photo_source: parent.photoSource || '',
            left_fingerprint_data: '',
            right_fingerprint_data: '',
            management_id: localParentId || parent.id,
            management_source: localParentId ? 'local' : 'orbit',
            identifier_type: localParentId ? 'local' : 'orbitId',
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
        middle_name: splitFullName(familyName).middle_name,
        last_name: splitFullName(familyName).last_name,
        access_code: '',
        students: [],
        classes: new Set(),
        classParts: [],
        activeStudents: 0,
        kcs_card_id: student.parent_kcs_card_id,
        parent_external_id: student.parent_external_id,
        email: student.parent_email,
        phone: student.parent_phone,
        address: student.parent_address,
        photo_data: student.parent_photo_data,
        left_fingerprint_data: student.parent_left_fingerprint_data,
        right_fingerprint_data: student.parent_right_fingerprint_data,
        management_id: student.parent || null,
        management_source: 'local',
        identifier_type: 'local',
        student_ids: [],
        linked_students: [],
      };

      current.students.push(student.full_name);
      current.student_ids.push(student.student_id);
      current.linked_students.push(student);
      const className = normalizeClassName(student.class_name);
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
        middle_name: group.middle_name,
        last_name: group.last_name,
        access_code: group.access_code,
        students_label: group.students.join(', '),
        linked_student_ids: group.student_ids.filter(Boolean).join(', '),
        classes_label: Array.from(group.classes).sort((left, right) => left.localeCompare(right)).join(', '),
        class_parts: group.classParts,
        student_count: group.students.length,
        activeStudents: group.activeStudents,
        linked_students: group.linked_students,
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

      const haystack = `${family.id || ''} ${family.family_name} ${family.access_code || ''} ${family.students_label} ${family.linked_student_ids || ''} ${family.classes_label} ${family.parent_external_id || ''} ${family.management_id || ''} ${family.kcs_card_id || ''} ${family.email || ''} ${family.phone || ''}`.toLowerCase();
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
        const current = groups.get(className) || { className, families: [], parents: [], students: 0 };
        current.families.push(family.family_name);
        current.parents.push(family);
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
      last_name: row.last_name || '',
      middle_name: row.middle_name || '',
      first_name: row.first_name || '',
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      identity: {
        photo_data: row.photo_data || '',
        photo_source: row.photo_source || '',
        left_fingerprint_data: row.left_fingerprint_data || '',
        right_fingerprint_data: row.right_fingerprint_data || '',
      },
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
      await parentsService.update(editingParent.management_id, {
        ...editForm,
        photo_data: editForm.identity.photo_data,
        photo_source: editForm.identity.photo_source,
      }, {
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

  const handleResetAccess = async (row) => {
    const identifier = row.management_source === 'local'
      ? row.management_id
      : (row.email || row.parent_external_id || row.management_id);
    if (!identifier) return setError('Compte utilisateur introuvable pour ce parent.');
    setSubmitting(true);
    setError('');
    try {
      setTemporaryCredentials(await parentsService.resetAccess(identifier, row.management_source === 'local' ? {} : { entityType: 'parent', entityData: { fullName: row.full_name, firstName: row.first_name, middleName: row.middle_name, lastName: row.last_name, email: row.email, phone: row.phone } }));
    } catch (resetError) {
      setError(resetError?.response?.data?.detail || 'Impossible de réinitialiser cet accès.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'family_name', label: 'Famille / Parent' },
    { key: 'parent_external_id', label: 'ID parent', render: (value) => value || 'Non défini' },
    { key: 'access_code', label: 'Code d\'accès', render: (value) => value || 'Non défini' },
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
          <button type="button" onClick={() => navigate(`/parents/${encodeURIComponent(row.id)}`, { state: { entity: { ...row, full_name: row.family_name, role: 'Parent' } } })} className="savanex-entity-action savanex-entity-action-view">Voir</button>
          <EntityPdfButton entity={row} type="parent" />
          <button type="button" onClick={() => navigate(`/parents/${encodeURIComponent(row.id)}/edit`, { state: { entity: row } })} className="savanex-entity-action savanex-entity-action-edit">Modifier</button>
          <button type="button" onClick={() => void handleResetAccess(row)} className="savanex-entity-action border border-amber-300/40 bg-amber-300/10 text-amber-100">Réinitialiser accès</button>
          <button type="button" onClick={() => void handleDelete(row)} className="savanex-entity-action savanex-entity-action-danger">Supprimer</button>
        </div>
      )
    },
  ];

  return (
    <DashboardLayout>
      {temporaryCredentials ? createPortal(<ResetAccessDialog credentials={temporaryCredentials} onClose={() => setTemporaryCredentials(null)} />, document.body) : null}
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Parent relationship management</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">Classement des familles et parents</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Recherche et regroupement des foyers par famille et par classe à partir des élèves reliés dans SAVANEX.</p>
        </div>
        <LegacyImportLink entity="PARENT" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Familles actives" value={activeFamilies} accent="text-cyan-300" />
        <StatCard title="Élèves reliés" value={totalStudents} subtitle="Visibles dans les familles" accent="text-emerald-300" />
        <StatCard title="Classes couvertes" value={classesCovered} subtitle="Classes reliées aux familles" accent="text-amber-300" />
        <StatCard title="Résultats filtrés" value={filtered.length} subtitle="Familles correspondant à la recherche" accent="text-rose-300" />
      </section>

      <div className="mb-4 card p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <SearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher parent, code d'accès, famille, élève, classe ou ID..."
            inputClassName="pr-4"
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

      <section className="mb-5 grid gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Recherche parents</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Groupement détaillé par famille</h3>
          <div className="savanex-scrollbar mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {filtered.length ? filtered.map((family) => (
              <button key={family.id} type="button" onClick={() => setSelectedParent(family)} className="w-full rounded-2xl border border-github-border bg-slate-950/35 p-4 text-left transition hover:border-emerald-300/50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-100">{family.family_name}</p>
                  <span className="text-xs text-slate-400">{family.student_count} élève(s)</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Classes : {family.classes_label || 'Non assignée'}</p>
                <p className="mt-3 text-sm text-slate-300">{family.students_label}</p>
              </button>
            )) : <p className="text-sm text-slate-400">Aucune famille ne correspond aux filtres en cours.</p>}
          </div>
        </article>

        <article className="card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Classement</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Classes et familles associées</h3>
          <div className="savanex-scrollbar mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {classGroups.length ? classGroups.map((group) => (
              <button key={slugify(group.className)} type="button" onClick={() => setSelectedClassGroup(group)} className="w-full rounded-2xl border border-github-border bg-slate-950/35 p-4 text-left transition hover:border-cyan-300/50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-100">{group.className}</p>
                  <span className="text-xs text-slate-400">{group.students} élève(s)</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{group.families.join(', ')}</p>
              </button>
            )) : <p className="text-sm text-slate-400">Aucune classe ne correspond aux filtres en cours.</p>}
          </div>
        </article>
      </section>
      {loading ? <p className="mb-4 text-sm text-slate-400">Chargement des familles...</p> : null}
      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}
      <DataTable columns={columns} data={filtered} />

      <EntityDetailPanel
        entity={selectedParent}
        type="parent"
        onClose={() => setSelectedParent(null)}
        onEdit={(parent) => {
          setSelectedParent(null);
          openEdit(parent);
        }}
      />

      {editingParent ? (
        <div className="savanex-modal-backdrop fixed inset-0 z-[1000] grid place-items-center overflow-y-auto px-4 py-8">
          <section role="dialog" aria-modal="true" aria-label="Modifier un parent" className="savanex-modal-panel savanex-entity-edit-panel w-full overflow-y-auto p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Gestion parent</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-slate-100">Modifier {editingParent.family_name}</h3>
              </div>
              <button type="button" onClick={() => setEditingParent(null)} className="rounded-xl border border-github-border px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/70">Fermer</button>
            </div>

            <div className="mt-6 space-y-4">
              <section className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Identité du parent</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-1 text-xs font-semibold text-slate-400">
                    Nom
                    <input value={editForm.last_name} onChange={(event) => setEditForm({ ...editForm, last_name: event.target.value })} placeholder="Nom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-400">
                    Postnom
                    <input value={editForm.middle_name} onChange={(event) => setEditForm({ ...editForm, middle_name: event.target.value })} placeholder="Postnom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-400">
                    Prénom
                    <input value={editForm.first_name} onChange={(event) => setEditForm({ ...editForm, first_name: event.target.value })} placeholder="Prénom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  </label>
                </div>
              </section>
              <IdentityCapturePanel
                value={editForm.identity}
                subjectName={`${editForm.last_name} ${editForm.middle_name} ${editForm.first_name}`.replace(/\s+/g, ' ').trim()}
                onChange={(identity) => setEditForm({ ...editForm, identity })}
                compact
              />
              <section className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Coordonnées</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-1 text-xs font-semibold text-slate-400">
                    Email
                    <input value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} placeholder="Email du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-400">
                    Téléphone
                    <InternationalPhoneInput value={editForm.phone} onChange={(value) => setEditForm({ ...editForm, phone: value })} />
                  </label>
                </div>
              </section>
              <section className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Enfants liés</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl bg-slate-950/55 p-3">
                    <p className="text-xs text-slate-500">Élèves</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{editingParent.students_label || 'Aucun élève lié'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/55 p-3">
                    <p className="text-xs text-slate-500">Classes</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{editingParent.classes_label || 'Non assignée'}</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingParent(null)} className="rounded-xl border border-github-border px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/70">Annuler</button>
              <button type="button" onClick={() => void handleSave()} disabled={submitting} className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {selectedClassGroup ? createPortal(
        <div className="savanex-modal-backdrop fixed inset-0 z-[1000] grid place-items-center overflow-y-auto px-4 py-8" onClick={() => setSelectedClassGroup(null)}>
          <section role="dialog" aria-modal="true" className="savanex-modal-panel savanex-entity-edit-panel w-full max-w-5xl overflow-y-auto p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 border-b border-github-border pb-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Dossier détaillé de la classe</p><h3 className="mt-2 font-display text-3xl font-bold text-white">{selectedClassGroup.className}</h3><p className="mt-2 text-sm text-slate-400">{selectedClassGroup.students} élève(s) · {selectedClassGroup.families.length} famille(s)</p></div>
              <button type="button" onClick={() => setSelectedClassGroup(null)} className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200">Fermer</button>
            </header>
            <div className="savanex-scrollbar mt-5 grid max-h-[55vh] gap-3 overflow-y-auto md:grid-cols-2">
              {selectedClassGroup.parents.map((parent) => (
                <button key={parent.id} type="button" onClick={() => { setSelectedClassGroup(null); setSelectedParent(parent); }} className="rounded-2xl border border-github-border bg-slate-950/45 p-4 text-left transition hover:border-kcs-blue">
                  <div className="flex items-start justify-between gap-3"><p className="font-semibold text-white">{parent.family_name}</p><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs text-emerald-200">{parent.student_count} enfant(s)</span></div>
                  <div className="mt-3 grid gap-1 text-xs text-slate-400"><span>Enfants : {parent.students_label || 'Aucun élève lié'}</span><span>Téléphone : {parent.phone || 'Non renseigné'}</span><span>E-mail : {parent.email || 'Non renseigné'}</span></div>
                </button>
              ))}
            </div>
          </section>
        </div>, document.body
      ) : null}
    </DashboardLayout>
  );
};

const ResetAccessDialog=({credentials,onClose})=><div className="savanex-modal-backdrop fixed inset-0 z-[9999] grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true"><section className="savanex-modal-panel savanex-reset-access-panel w-full max-w-xl p-6"><button type="button" onClick={onClose} className="float-right text-white">Fermer</button><p className="text-xs text-amber-300">REINITIALISATION TERMINEE</p><h3 className="mt-2 text-2xl font-bold text-white">Nouveaux identifiants</h3><div className="mt-6 space-y-3 text-slate-200"><p>Identifiant : <b>{credentials.username}</b></p><p>Code acces : <b>{credentials.accessCode}</b></p><p>Mot de passe : <b className="text-emerald-200">{credentials.temporaryPassword}</b></p></div><p className="mt-4 text-xs text-slate-400">Mot de passe a changer a la prochaine connexion.</p></section></div>;
export default ParentsPage;
