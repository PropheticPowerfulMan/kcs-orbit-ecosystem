import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import EntityDetailPanel from '../../components/ui/EntityDetailPanel';
import StatCard from '../../components/ui/StatCard';
import { emptyIdentityCapture, IdentityCapturePanel, KcsIdCard } from '../../components/ui/KcsIdentityTools';
import { studentsService } from '../../services/api';
import { useTranslation } from 'react-i18next';

const normalizeLabel = (value, fallback) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
};

const formatApiError = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatApiError(item)).filter(Boolean).join(' | ');
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${formatApiError(item)}`)
      .filter(Boolean)
      .join(' | ');
  }

  return '';
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const modalBackdropClass = 'savanex-modal-backdrop fixed inset-0 z-[999] grid place-items-center overflow-y-auto px-4 py-8';
const modalPanelClass = 'savanex-modal-panel w-full max-w-5xl overflow-y-auto p-5 sm:p-6';
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

const createStudentDraft = () => ({
  firstName: '',
  lastName: '',
  email: '',
  classLevel: '',
  classSuffix: '',
  dateOfBirth: '',
  gender: 'F',
  address: '',
  identity: { ...emptyIdentityCapture },
});

const createEditForm = (student) => {
  const nameParts = normalizeLabel(student?.full_name, '').split(/\s+/).filter(Boolean);
  const classParts = splitClassName(student?.class_name || '');

  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    email: student?.email || '',
    classLevel: standardClassLevels.includes(classParts.level) ? classParts.level : '',
    classSuffix: classParts.suffix || '',
    dateOfBirth: student?.date_of_birth || '',
    gender: student?.gender || 'F',
    address: student?.address || '',
    notes: student?.notes || '',
  };
};

const StudentsPage = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [classLevelFilter, setClassLevelFilter] = useState('all');
  const [classSuffixFilter, setClassSuffixFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState(createEditForm(null));
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [lastTemporaryCredentials, setLastTemporaryCredentials] = useState(null);
  const [form, setForm] = useState({
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPhone: '',
    parentIdentity: { ...emptyIdentityCapture },
    students: [createStudentDraft()],
  });

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await studentsService.getAll();
        setStudents(data);
      } catch {
        setError("Impossible de charger les élèves pour le moment.");
      } finally {
        setLoading(false);
      }
    };

    void loadStudents();
  }, []);

  const familyOptions = useMemo(
    () => Array.from(new Set(students.map((student) => normalizeLabel(student.parent_name, 'Aucun parent lié')))).sort((left, right) => left.localeCompare(right)),
    [students]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return students.filter((student) => {
      const className = normalizeLabel(student.class_name, 'Non assignée');
      const classParts = splitClassName(className);
      const familyName = normalizeLabel(student.parent_name, 'Aucun parent lié');
      const haystack = `${student.full_name} ${student.student_id} ${className} ${familyName}`.toLowerCase();

      if (classLevelFilter !== 'all' && classParts.level !== classLevelFilter) {
        return false;
      }

      if (classSuffixFilter !== 'all' && classParts.suffix !== classSuffixFilter) {
        return false;
      }

      if (familyFilter !== 'all' && familyName !== familyFilter) {
        return false;
      }

      if (normalizedQuery && !haystack.includes(normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [classLevelFilter, classSuffixFilter, familyFilter, query, students]);

  const groupedByClass = useMemo(() => {
    const groups = new Map();

    for (const student of filtered) {
      const className = normalizeLabel(student.class_name, 'Non assignée');
      const current = groups.get(className) || { className, total: 0, families: new Set(), students: [] };
      current.total += 1;
      current.students.push(student);
      current.families.add(normalizeLabel(student.parent_name, 'Aucun parent lié'));
      groups.set(className, current);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        families: Array.from(group.families).sort((left, right) => left.localeCompare(right)),
        students: [...group.students].sort((left, right) => left.full_name.localeCompare(right.full_name)),
      }))
      .sort((left, right) => right.total - left.total || left.className.localeCompare(right.className));
  }, [filtered]);

  const groupedByFamily = useMemo(() => {
    const groups = new Map();

    for (const student of filtered) {
      const familyName = normalizeLabel(student.parent_name, 'Aucun parent lié');
      const current = groups.get(familyName) || { familyName, total: 0, classes: new Set(), students: [] };
      current.total += 1;
      current.students.push(student);
      current.classes.add(normalizeLabel(student.class_name, 'Non assignée'));
      groups.set(familyName, current);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        classes: Array.from(group.classes).sort((left, right) => left.localeCompare(right)),
        students: [...group.students].sort((left, right) => left.full_name.localeCompare(right.full_name)),
      }))
      .sort((left, right) => right.total - left.total || left.familyName.localeCompare(right.familyName));
  }, [filtered]);

  const linkedFamilies = new Set(filtered.map((student) => student.parent_name).filter(Boolean)).size;
  const activeStudents = filtered.filter((student) => student.is_active).length;
  const classesCovered = new Set(filtered.map((student) => student.class_name).filter(Boolean)).size;

  const updateStudentDraft = (index, field, value) => {
    setForm((current) => ({
      ...current,
      students: current.students.map((student, studentIndex) => (
        studentIndex === index ? { ...student, [field]: value } : student
      )),
    }));
  };

  const addStudentDraft = () => {
    setForm((current) => ({
      ...current,
      students: [...current.students, createStudentDraft()],
    }));
  };

  const removeStudentDraft = (index) => {
    setForm((current) => ({
      ...current,
      students: current.students.filter((_, studentIndex) => studentIndex !== index),
    }));
  };

  const openEditDialog = (student) => {
    setEditingStudent(student);
    setEditForm(createEditForm(student));
    setError('');
    setFeedback('');
  };

  const setEditField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const refreshStudents = async () => {
    const data = await studentsService.getAll();
    setStudents(data);
  };

  const saveEditedStudent = async () => {
    if (!editingStudent) return;
    setSavingEdit(true);
    setError('');
    setFeedback('');

    try {
      const payload = {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        user_email: editForm.email,
        gender: editForm.gender,
        address: editForm.address,
        class_level: editForm.classLevel,
        class_suffix: editForm.classSuffix,
        notes: editForm.notes,
      };
      if (editForm.dateOfBirth) {
        payload.date_of_birth = editForm.dateOfBirth;
      }
      await studentsService.update(editingStudent.id, payload);
      await refreshStudents();
      setFeedback('Entité mise à jour. ID élève et carte KCS conservés.');
      setEditingStudent(null);
    } catch (editError) {
      setError(editError?.response?.data?.detail || editError?.message || "Impossible de modifier cette entité.");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteStudentEntity = async (student) => {
    if (!window.confirm(`Supprimer ${student.full_name} ? Cette action désactive l'entité sans modifier son ID ni sa carte KCS.`)) {
      return;
    }

    setDeletingId(student.id);
    setError('');
    setFeedback('');

    try {
      await studentsService.remove(student.id);
      await refreshStudents();
      setSelectedStudent(null);
      setFeedback('Entité supprimée/désactivée.');
    } catch (deleteError) {
      setError(deleteError?.response?.data?.detail || deleteError?.message || "Impossible de supprimer cette entité.");
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    { key: 'full_name', label: 'Élève' },
    { key: 'student_id', label: 'ID élève' },
    { key: 'class_name', label: 'Classe', render: (value) => value || 'Non assignée' },
    { key: 'parent_name', label: 'Parent responsable', render: (value) => value || 'Aucun parent lié' },
    {
      key: 'source_label',
      label: 'Source',
      render: (value, row) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.source === 'orbit' ? 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`}>
          {value || (row.source === 'orbit' ? 'Orbit' : 'SAVANEX')}
        </span>
      ),
    },
    { key: 'email', label: 'Email', render: (value) => value || 'Non renseigné' },
    { key: 'kcs_card_id', label: 'Carte KCS', render: (value) => value || 'À générer' },
    { key: 'has_biometrics', label: 'Bio', render: (_value, row) => (row.has_photo || row.has_biometrics ? 'Prêt' : 'À compléter') },
    { key: 'is_active', label: 'Statut', render: (value) => value ? 'Actif' : 'Inactif' },
    {
      key: 'details',
      label: 'Action',
      render: (_value, row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedStudent({ ...row, role: 'Élève' })} className="rounded-lg border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10">Voir</button>
          {row.is_read_only ? (
            <span className="rounded-lg border border-slate-600/60 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300">Lecture seule</span>
          ) : (
            <>
              <button type="button" onClick={() => openEditDialog(row)} className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-300/20">Modifier</button>
              <button type="button" disabled={deletingId === row.id} onClick={() => void deleteStudentEntity(row)} className="rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-300/20 disabled:opacity-50">
                {deletingId === row.id ? 'Suppression...' : 'Supprimer'}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const submitFamily = async (event) => {
    event?.preventDefault();
    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
      const parentReady = form.parentFirstName.trim() && form.parentLastName.trim() && form.parentEmail.trim();
      const studentsReady = form.students.every((student) => (
        student.firstName.trim() && student.lastName.trim() && student.email.trim() && student.dateOfBirth
      ));

      if (!parentReady) {
        setFamilyDialogOpen(true);
        throw new Error('Complétez d’abord la boîte de dialogue Nouvelle famille.');
      }

      if (!studentsReady) {
        setFamilyDialogOpen(true);
        throw new Error('Complétez d’abord la boîte de dialogue Enfants.');
      }

      const payload = {
        parent: {
          first_name: form.parentFirstName,
          last_name: form.parentLastName,
          email: form.parentEmail,
          phone: form.parentPhone,
          ...form.parentIdentity,
        },
        students: form.students.map((student) => ({
          user: {
            first_name: student.firstName,
            last_name: student.lastName,
            email: student.email,
            ...student.identity,
          },
          date_of_birth: student.dateOfBirth,
          gender: student.gender,
          class_level: student.classLevel,
          class_suffix: student.classSuffix,
          address: student.address,
        })),
      };

      const response = await studentsService.registerFamily(payload);
      const data = await studentsService.getAll();
      setStudents(data);
      const parentCredential = response.temporaryCredentials?.parent;
      const studentCredentials = response.temporaryCredentials?.students || [];
      const credentialSummary = [
        parentCredential?.temporaryPassword ? `Parent: ${parentCredential.username} (${parentCredential.accessCode || 'sans code'}) / ${parentCredential.temporaryPassword}` : null,
        ...studentCredentials
          .filter((credential) => credential.temporaryPassword)
          .map((credential) => `${credential.studentId}: ${credential.username} (${credential.accessCode || 'sans code'}) / ${credential.temporaryPassword}`),
      ].filter(Boolean).join(' | ');
      setLastTemporaryCredentials({
        parent: parentCredential || null,
        students: studentCredentials,
      });
      setFeedback(`Famille enregistrée avec ${response.studentCount || form.students.length} élève(s). Mot de passe temporaire à changer: ${credentialSummary || 'déjà défini'}.`);
      setForm({
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPhone: '',
        parentIdentity: { ...emptyIdentityCapture },
        students: [createStudentDraft()],
      });
      setFamilyDialogOpen(false);
    } catch (submissionError) {
      const responseData = submissionError?.response?.data;
      setError(
        responseData?.detail
        || formatApiError(responseData)
        || submissionError?.message
        || "Impossible d'enregistrer cette famille."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <section className="mb-6 flex flex-col gap-4 page-enter lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Student command center</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.students')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Enregistrement des familles, classes normalisées et vue fusionnée SAVANEX + Orbit avec entrées externes en lecture seule.</p>
        </div>
      </section>

      <section className="mb-6 card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-slate-100">Nouvelle famille</h3>
            <p className="mt-1 text-sm text-slate-400">Un parent, un ou plusieurs élèves, tous liés dans la même opération. Les mots de passe temporaires sont générés par le système.</p>
          </div>
        </div>

        <form onSubmit={submitFamily} className="space-y-4">
          {lastTemporaryCredentials ? (
            <section className="rounded-2xl border border-emerald-400/35 bg-emerald-400/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Accès temporaires générés</p>
                  <h4 className="mt-1 font-display text-lg font-semibold text-slate-100">Mots de passe à remettre à la famille</h4>
                  <p className="mt-1 text-xs text-slate-300">Format: KCS-ROLE-CODE-CODE. PAR = parent, STU = élève. Ce mot de passe sert seulement à la première connexion.</p>
                </div>
                <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-bold text-slate-950">À changer à la première connexion</span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {lastTemporaryCredentials.parent ? (
                  <div className="rounded-xl border border-emerald-300/25 bg-slate-950/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Parent</p>
                    <p className="mt-2 text-sm text-slate-200">Utilisateur: <span className="font-metric font-bold text-white">{lastTemporaryCredentials.parent.username}</span></p>
                    <p className="mt-1 text-sm text-slate-200">Code d'accès: <span className="font-metric font-bold text-sky-200">{lastTemporaryCredentials.parent.accessCode || 'Non défini'}</span></p>
                    <p className="mt-1 text-sm text-slate-200">Mot de passe: <span className="font-metric font-bold text-emerald-200">{lastTemporaryCredentials.parent.temporaryPassword || 'Déjà défini'}</span></p>
                  </div>
                ) : null}
                {lastTemporaryCredentials.students.map((credential) => (
                  <div key={`${credential.studentId}-${credential.username}`} className="rounded-xl border border-emerald-300/25 bg-slate-950/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Élève {credential.studentId}</p>
                    <p className="mt-2 text-sm text-slate-200">Utilisateur: <span className="font-metric font-bold text-white">{credential.username}</span></p>
                    <p className="mt-1 text-sm text-slate-200">Code d'accès: <span className="font-metric font-bold text-sky-200">{credential.accessCode || 'Non défini'}</span></p>
                    <p className="mt-1 text-sm text-slate-200">Mot de passe: <span className="font-metric font-bold text-emerald-200">{credential.temporaryPassword || 'Déjà défini'}</span></p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-github-border bg-github-panel/80 p-4 shadow-glass backdrop-blur-xl">
            <p className="max-w-2xl text-sm text-slate-300">Tout l'enregistrement se fait maintenant dans une seule fenêtre dédiée : parent, enfants, biométrie et validation finale.</p>
            <button type="button" onClick={() => setFamilyDialogOpen(true)} className="savanex-primary-family-button">
              Ajouter une nouvelle famille
            </button>
          </div>

          {familyDialogOpen ? createPortal((
            <div className={modalBackdropClass}>
              <section role="dialog" aria-modal="true" aria-label="Nouvelle famille" className={modalPanelClass}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Famille complète</p>
                    <h4 className="mt-1 font-display text-xl font-semibold text-slate-100">Nouvelle famille</h4>
                  </div>
                  <button type="button" onClick={() => setFamilyDialogOpen(false)} className="rounded-xl border border-github-border bg-slate-950/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60">Fermer</button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input value={form.parentFirstName} onChange={(event) => setForm({ ...form, parentFirstName: event.target.value })} placeholder="Prénom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input value={form.parentLastName} onChange={(event) => setForm({ ...form, parentLastName: event.target.value })} placeholder="Nom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input type="email" value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} placeholder="Email du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: event.target.value })} placeholder="Téléphone du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                </div>

                <div className="mt-4">
                  <IdentityCapturePanel
                    value={form.parentIdentity}
                    subjectName={`${form.parentFirstName} ${form.parentLastName}`}
                    onChange={(identity) => setForm({ ...form, parentIdentity: identity })}
                  />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Aperçu de la carte biométrique du parent</p>
                    <p className="mt-1 text-xs text-slate-400">La photo et les empreintes capturées ici alimentent la carte KCS officielle.</p>
                  </div>
                  <KcsIdCard entity={{
                    full_name: `${form.parentFirstName} ${form.parentLastName}`.trim() || 'Parent KCS',
                    role: 'Parent',
                    phone: form.parentPhone,
                    email: form.parentEmail,
                    ...form.parentIdentity,
                  }} />
                </div>

                <div className="mt-6 border-t border-github-border pt-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Enfants liés</p>
                      <h4 className="mt-1 font-display text-xl font-semibold text-slate-100">Ajouter / gérer les enfants</h4>
                    </div>
                    <button type="button" onClick={addStudentDraft} className="rounded-xl border border-github-border bg-slate-950/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60">Ajouter un enfant</button>
                  </div>
                <div className="space-y-3">
                  {form.students.map((student, index) => (
                    <div key={`student-draft-${index}`} className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">Enfant {index + 1}</p>
                  {form.students.length > 1 ? (
                    <button type="button" onClick={() => removeStudentDraft(index)} className="text-xs text-rose-300 hover:text-rose-200">Retirer</button>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input value={student.firstName} onChange={(event) => updateStudentDraft(index, 'firstName', event.target.value)} placeholder="Prénom" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input value={student.lastName} onChange={(event) => updateStudentDraft(index, 'lastName', event.target.value)} placeholder="Nom" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input type="email" value={student.email} onChange={(event) => updateStudentDraft(index, 'email', event.target.value)} placeholder="Email élève" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <select value={student.classLevel} onChange={(event) => updateStudentDraft(index, 'classLevel', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
                    <option value="">Classe non assignée</option>
                    {standardClassLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                  <select value={student.classSuffix} onChange={(event) => updateStudentDraft(index, 'classSuffix', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" disabled={!student.classLevel}>
                    {classSuffixes.map((suffix) => <option key={suffix || 'none'} value={suffix}>{suffix ? `Suffixe ${suffix}` : 'Sans suffixe'}</option>)}
                  </select>
                  <input type="date" value={student.dateOfBirth} onChange={(event) => updateStudentDraft(index, 'dateOfBirth', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <select value={student.gender} onChange={(event) => updateStudentDraft(index, 'gender', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
                    <option value="F">Fille</option>
                    <option value="M">Garçon</option>
                    <option value="O">Autre</option>
                  </select>
                  <input value={student.address} onChange={(event) => updateStudentDraft(index, 'address', event.target.value)} placeholder="Adresse" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue md:col-span-2" />
                </div>
                <div className="mt-4">
                  <IdentityCapturePanel
                    value={student.identity}
                    subjectName={`${student.firstName} ${student.lastName}`}
                    onChange={(identity) => updateStudentDraft(index, 'identity', identity)}
                    compact
                  />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Aperçu de la carte biométrique élève</p>
                    <p className="mt-1 text-xs text-slate-400">La carte utilise l'identité visuelle KCS, la photo et les empreintes reliées au lecteur.</p>
                  </div>
                  <KcsIdCard entity={{
                    full_name: `${student.firstName} ${student.lastName}`.trim() || `Élève ${index + 1}`,
                    role: 'Élève',
                    class_name: [student.classLevel, student.classSuffix].filter(Boolean).join(' '),
                    email: student.email,
                    ...student.identity,
                  }} />
                </div>
              </div>
            ))}
                </div>
                </div>

                {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
                <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-github-border pt-4">
                  <button type="button" onClick={() => setFamilyDialogOpen(false)} className="rounded-xl border border-github-border bg-slate-950/50 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/60">Fermer</button>
                  <button type="button" onClick={() => void submitFamily()} disabled={submitting} className="rounded-xl bg-kcs-blue px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                    {submitting ? 'Enregistrement en cours...' : 'Enregistrer la famille'}
                  </button>
                </div>
              </section>
            </div>
          ), document.body) : null}

          {editingStudent ? createPortal((
            <div className={modalBackdropClass}>
              <section role="dialog" aria-modal="true" aria-label="Modifier une entité" className={modalPanelClass}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Modification autorisée</p>
                    <h4 className="mt-1 font-display text-xl font-semibold text-slate-100">Modifier l'entité élève</h4>
                    <p className="mt-1 text-xs text-slate-400">ID élève et carte KCS restent verrouillés.</p>
                  </div>
                  <button type="button" onClick={() => setEditingStudent(null)} className="rounded-xl border border-github-border bg-slate-950/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60">Fermer</button>
                </div>

                <div className="mb-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-github-border bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">ID élève verrouillé</p>
                    <p className="mt-1 font-metric text-sm font-bold text-slate-200">{editingStudent.student_id || 'Non renseigné'}</p>
                  </div>
                  <div className="rounded-xl border border-github-border bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Carte KCS verrouillée</p>
                    <p className="mt-1 font-metric text-sm font-bold text-slate-200">{editingStudent.kcs_card_id || 'À générer'}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input value={editForm.firstName} onChange={(event) => setEditField('firstName', event.target.value)} placeholder="Prénom" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  <input value={editForm.lastName} onChange={(event) => setEditField('lastName', event.target.value)} placeholder="Nom" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  <input type="email" value={editForm.email} onChange={(event) => setEditField('email', event.target.value)} placeholder="Email" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  <input type="date" value={editForm.dateOfBirth || ''} onChange={(event) => setEditField('dateOfBirth', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  <select value={editForm.classLevel} onChange={(event) => setEditField('classLevel', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
                    <option value="">Classe non assignée</option>
                    {standardClassLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                  <select value={editForm.classSuffix} onChange={(event) => setEditField('classSuffix', event.target.value)} disabled={!editForm.classLevel} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue disabled:opacity-60">
                    {classSuffixes.map((suffix) => <option key={suffix || 'none'} value={suffix}>{suffix ? `Suffixe ${suffix}` : 'Sans suffixe'}</option>)}
                  </select>
                  <select value={editForm.gender} onChange={(event) => setEditField('gender', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
                    <option value="F">Fille</option>
                    <option value="M">Garçon</option>
                    <option value="O">Autre</option>
                  </select>
                  <input value={editForm.address} onChange={(event) => setEditField('address', event.target.value)} placeholder="Adresse" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
                  <textarea value={editForm.notes} onChange={(event) => setEditField('notes', event.target.value)} placeholder="Notes" className="min-h-24 w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue md:col-span-2 xl:col-span-4" />
                </div>

                {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
                <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-github-border pt-4">
                  <button type="button" onClick={() => setEditingStudent(null)} className="rounded-xl border border-github-border bg-slate-950/50 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800/60">Annuler</button>
                  <button type="button" onClick={() => void saveEditedStudent()} disabled={savingEdit} className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/20 disabled:opacity-60">
                    {savingEdit ? 'Modification...' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </section>
            </div>
          ), document.body) : null}

          {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        </form>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Effectif actif" value={activeStudents} subtitle="Élèves actuellement visibles" accent="text-cyan-300" />
        <StatCard title="Familles liées" value={linkedFamilies} subtitle="Parents reliés aux élèves" accent="text-emerald-300" />
        <StatCard title="Classes couvertes" value={classesCovered} subtitle="Classes détectées dans SAVANEX" accent="text-amber-300" />
      </section>

      <div className="mb-4 card p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher par élève, classe ou famille..."
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
      {loading ? <p className="mb-4 text-sm text-slate-400">Chargement des élèves...</p> : null}
      <DataTable columns={columns} data={filtered} />

      <EntityDetailPanel entity={selectedStudent} type="student" onClose={() => setSelectedStudent(null)} />

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Classement</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Groupement par classe</h3>
            </div>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{groupedByClass.length} classes</span>
          </div>
          <div className="mt-4 space-y-3">
            {groupedByClass.length ? groupedByClass.map((group) => (
              <div key={slugify(group.className)} className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-100">{group.className}</p>
                  <span className="text-xs text-slate-400">{group.total} élève(s)</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Familles: {group.families.join(', ')}</p>
                <p className="mt-3 text-sm text-slate-300">{group.students.map((student) => student.full_name).join(', ')}</p>
              </div>
            )) : <p className="text-sm text-slate-400">Aucune classe ne correspond aux filtres en cours.</p>}
          </div>
        </article>

        <article className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Familles</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Groupement par famille</h3>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">{groupedByFamily.length} groupes</span>
          </div>
          <div className="mt-4 space-y-3">
            {groupedByFamily.length ? groupedByFamily.map((group) => (
              <div key={slugify(group.familyName)} className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-100">{group.familyName}</p>
                  <span className="text-xs text-slate-400">{group.total} élève(s)</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Classes: {group.classes.join(', ')}</p>
                <p className="mt-3 text-sm text-slate-300">{group.students.map((student) => `${student.full_name} (${normalizeLabel(student.class_name, 'Non assignée')})`).join(', ')}</p>
              </div>
            )) : <p className="text-sm text-slate-400">Aucune famille ne correspond aux filtres en cours.</p>}
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
};

export default StudentsPage;
