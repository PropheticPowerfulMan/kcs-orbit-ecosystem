import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { emptyIdentityCapture, IdentityCapturePanel, PrintableKcsCard } from '../../components/ui/KcsIdentityTools';
import { studentsService } from '../../services/api';
import { useTranslation } from 'react-i18next';

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

const StudentsPage = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [familyFormVisible, setFamilyFormVisible] = useState(true);
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

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => normalizeLabel(student.class_name, 'Non assignée')))).sort((left, right) => left.localeCompare(right)),
    [students]
  );

  const familyOptions = useMemo(
    () => Array.from(new Set(students.map((student) => normalizeLabel(student.parent_name, 'Aucun parent lié')))).sort((left, right) => left.localeCompare(right)),
    [students]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return students.filter((student) => {
      const className = normalizeLabel(student.class_name, 'Non assignée');
      const familyName = normalizeLabel(student.parent_name, 'Aucun parent lié');
      const haystack = `${student.full_name} ${student.student_id} ${className} ${familyName}`.toLowerCase();

      if (classFilter !== 'all' && className !== classFilter) {
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
  }, [classFilter, familyFilter, query, students]);

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

  const columns = [
    { key: 'full_name', label: 'Élève' },
    { key: 'student_id', label: 'ID élève' },
    { key: 'class_name', label: 'Classe', render: (value) => value || 'Non assignée' },
    { key: 'parent_name', label: 'Parent responsable', render: (value) => value || 'Aucun parent lié' },
    { key: 'email', label: 'Email', render: (value) => value || 'Non renseigné' },
    { key: 'kcs_card_id', label: 'Carte KCS', render: (value) => value || 'À générer' },
    { key: 'has_biometrics', label: 'Bio', render: (_value, row) => (row.has_photo || row.has_biometrics ? 'Prêt' : 'À compléter') },
    { key: 'is_active', label: 'Statut', render: (value) => value ? 'Actif' : 'Inactif' },
    { key: 'card', label: 'Carte', render: (_value, row) => <button type="button" onClick={() => setSelectedCard({ ...row, role: 'Eleve' })} className="rounded-lg border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10">Voir</button> },
  ];

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

  const submitFamily = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
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
        parentCredential?.temporaryPassword ? `Parent: ${parentCredential.username} / ${parentCredential.temporaryPassword}` : null,
        ...studentCredentials
          .filter((credential) => credential.temporaryPassword)
          .map((credential) => `${credential.studentId}: ${credential.username} / ${credential.temporaryPassword}`),
      ].filter(Boolean).join(' | ');
      setFeedback(`Famille enregistrée avec ${response.studentCount || form.students.length} élève(s). Mot de passe temporaire à changer: ${credentialSummary || 'déjà défini'}.`);
      setForm({
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPhone: '',
        parentIdentity: { ...emptyIdentityCapture },
        students: [createStudentDraft()],
      });
    } catch (submissionError) {
      setError(submissionError?.response?.data?.detail || submissionError?.message || "Impossible d'enregistrer cette famille.");
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
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Enregistrement des familles, classes normalisées et génération automatique des accès temporaires depuis SAVANEX.</p>
        </div>
      </section>

      <section className="mb-6 card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-slate-100">Nouvelle famille</h3>
            <p className="mt-1 text-sm text-slate-400">Un parent, un ou plusieurs élèves, tous liés dans la même opération. Les mots de passe temporaires sont générés par le système.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {familyFormVisible ? (
              <button type="button" onClick={addStudentDraft} className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60">Ajouter un enfant</button>
            ) : null}
            <button
              type="button"
              onClick={() => setFamilyFormVisible((visible) => !visible)}
              aria-expanded={familyFormVisible}
              className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60"
            >
              {familyFormVisible ? 'Masquer' : 'Afficher'}
            </button>
          </div>
        </div>

        {familyFormVisible ? <form onSubmit={submitFamily} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={form.parentFirstName} onChange={(event) => setForm({ ...form, parentFirstName: event.target.value })} placeholder="Prénom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
            <input value={form.parentLastName} onChange={(event) => setForm({ ...form, parentLastName: event.target.value })} placeholder="Nom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
            <input type="email" value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} placeholder="Email du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
            <input value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: event.target.value })} placeholder="Téléphone du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
          </div>

          <IdentityCapturePanel
            value={form.parentIdentity}
            subjectName={`${form.parentFirstName} ${form.parentLastName}`}
            onChange={(identity) => setForm({ ...form, parentIdentity: identity })}
          />

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
              </div>
            ))}
          </div>

          {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button type="submit" disabled={submitting} className="rounded-xl bg-kcs-blue px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {submitting ? 'Enregistrement en cours...' : 'Enregistrer la famille'}
          </button>
        </form> : null}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Effectif actif" value={activeStudents} subtitle="Élèves actuellement visibles" accent="text-cyan-300" />
        <StatCard title="Familles liées" value={linkedFamilies} subtitle="Parents reliés aux élèves" accent="text-emerald-300" />
        <StatCard title="Classes couvertes" value={classesCovered} subtitle="Classes détectées dans SAVANEX" accent="text-amber-300" />
      </section>

      <div className="mb-4 card p-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher par élève, classe ou famille..."
            className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue"
          />
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
            <option value="all">Toutes les classes</option>
            {classOptions.map((className) => (
              <option key={className} value={className}>{className}</option>
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

      {selectedCard ? (
        <section className="mt-6 card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Carte KCS</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">Aperçu de la carte élève</h3>
            </div>
            <button type="button" onClick={() => setSelectedCard(null)} className="rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200">Fermer</button>
          </div>
          <PrintableKcsCard entity={selectedCard} />
        </section>
      ) : null}

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
