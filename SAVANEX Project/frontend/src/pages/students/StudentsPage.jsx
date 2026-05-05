import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { studentsService } from '../../services/api';
import { useTranslation } from 'react-i18next';

const StudentsPage = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPhone: '',
    students: [
      {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        dateOfBirth: '',
        gender: 'F',
        address: '',
      },
    ],
  });

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await studentsService.getAll();
        setStudents(data);
      } catch {
        setError("Impossible de charger les eleves pour le moment.");
      } finally {
        setLoading(false);
      }
    };

    void loadStudents();
  }, []);

  const filtered = useMemo(
    () => students.filter((student) => `${student.full_name} ${student.student_id} ${student.class_name || ''} ${student.parent_name || ''}`.toLowerCase().includes(query.toLowerCase())),
    [query, students]
  );

  const linkedFamilies = new Set(filtered.map((student) => student.parent_name).filter(Boolean)).size;
  const activeStudents = filtered.filter((student) => student.is_active).length;
  const classesCovered = new Set(filtered.map((student) => student.class_name).filter(Boolean)).size;

  const columns = [
    { key: 'full_name', label: 'Eleve' },
    { key: 'student_id', label: 'ID eleve' },
    { key: 'class_name', label: 'Classe', render: (value) => value || 'Non assignee' },
    { key: 'parent_name', label: 'Parent responsable', render: (value) => value || 'Aucun parent lie' },
    { key: 'email', label: 'Email', render: (value) => value || 'Non renseigne' },
    { key: 'is_active', label: 'Statut', render: (value) => value ? 'Actif' : 'Inactif' },
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
      students: [...current.students, { firstName: '', lastName: '', email: '', password: '', dateOfBirth: '', gender: 'F', address: '' }],
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
          password: 'ParentPortal123!',
          phone: form.parentPhone,
        },
        students: form.students.map((student) => ({
          user: {
            first_name: student.firstName,
            last_name: student.lastName,
            email: student.email,
            password: student.password,
          },
          date_of_birth: student.dateOfBirth,
          gender: student.gender,
          address: student.address,
        })),
      };

      const response = await studentsService.registerFamily(payload);
      const data = await studentsService.getAll();
      setStudents(data);
      setFeedback(`Famille enregistree avec ${response.studentCount || form.students.length} eleve(s).`);
      setForm({
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPhone: '',
        students: [{ firstName: '', lastName: '', email: '', password: '', dateOfBirth: '', gender: 'F', address: '' }],
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
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Enregistrement famille, generation des IDs eleves et suivi des liens parent-enfants depuis SAVANEX.</p>
        </div>
      </section>

      <section className="mb-6 card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-slate-100">Nouvelle famille</h3>
            <p className="mt-1 text-sm text-slate-400">Un parent, un ou plusieurs eleves, tous lies dans la meme operation.</p>
          </div>
          <button type="button" onClick={addStudentDraft} className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60">Ajouter un enfant</button>
        </div>

        <form onSubmit={submitFamily} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={form.parentFirstName} onChange={(event) => setForm({ ...form, parentFirstName: event.target.value })} placeholder="Prenom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
            <input value={form.parentLastName} onChange={(event) => setForm({ ...form, parentLastName: event.target.value })} placeholder="Nom du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
            <input type="email" value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} placeholder="Email du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
            <input value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: event.target.value })} placeholder="Telephone du parent" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" />
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
                  <input value={student.firstName} onChange={(event) => updateStudentDraft(index, 'firstName', event.target.value)} placeholder="Prenom" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input value={student.lastName} onChange={(event) => updateStudentDraft(index, 'lastName', event.target.value)} placeholder="Nom" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input type="email" value={student.email} onChange={(event) => updateStudentDraft(index, 'email', event.target.value)} placeholder="Email eleve" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input type="password" value={student.password} onChange={(event) => updateStudentDraft(index, 'password', event.target.value)} placeholder="Mot de passe" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <input type="date" value={student.dateOfBirth} onChange={(event) => updateStudentDraft(index, 'dateOfBirth', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue" required />
                  <select value={student.gender} onChange={(event) => updateStudentDraft(index, 'gender', event.target.value)} className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue">
                    <option value="F">Fille</option>
                    <option value="M">Garcon</option>
                    <option value="O">Autre</option>
                  </select>
                  <input value={student.address} onChange={(event) => updateStudentDraft(index, 'address', event.target.value)} placeholder="Adresse" className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue md:col-span-2" />
                </div>
              </div>
            ))}
          </div>

          {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button type="submit" disabled={submitting} className="rounded-xl bg-kcs-blue px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {submitting ? 'Enregistrement en cours...' : 'Enregistrer la famille'}
          </button>
        </form>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Effectif actif" value={activeStudents} subtitle="Eleves actuellement visibles" accent="text-cyan-300" />
        <StatCard title="Familles liees" value={linkedFamilies} subtitle="Parents relies aux eleves" accent="text-emerald-300" />
        <StatCard title="Classes couvertes" value={classesCovered} subtitle="Classes detectees dans SAVANEX" accent="text-amber-300" />
      </section>

      <div className="mb-4 card p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher par eleve, classe ou parent..."
          className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue"
        />
      </div>
      {loading ? <p className="mb-4 text-sm text-slate-400">Chargement des eleves...</p> : null}
      <DataTable columns={columns} data={filtered} />
    </DashboardLayout>
  );
};

export default StudentsPage;
