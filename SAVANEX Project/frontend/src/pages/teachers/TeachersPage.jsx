import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import EntityDetailPanel from '../../components/ui/EntityDetailPanel';
import StatCard from '../../components/ui/StatCard';
import { emptyIdentityCapture, IdentityCapturePanel, KcsIdCard } from '../../components/ui/KcsIdentityTools';
import { teachersService } from '../../services/api';
import { useTranslation } from 'react-i18next';

const inputClass = 'w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue';

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  teacherId: '',
  employeeType: 'teacher',
  department: '',
  jobTitle: '',
  specialization: '',
  hireDate: new Date().toISOString().slice(0, 10),
  contractType: 'permanent',
  workLocation: '',
  workEmail: '',
  officePhoneExtension: '',
  payrollReference: '',
  nationalIdNumber: '',
  socialSecurityNumber: '',
  taxNumber: '',
  bankName: '',
  bankAccountNumber: '',
  salaryGrade: '',
  baseSalary: '',
  payFrequency: 'monthly',
  supervisorName: '',
  identity: { ...emptyIdentityCapture },
};

const formatApiError = (error) => {
  const data = error?.response?.data;
  if (!data) return error?.message || "Impossible d'enregistrer cet employé.";
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;

  const flatten = (value, prefix = '') => {
    if (Array.isArray(value)) return [`${prefix}${value.join(', ')}`];
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, nested]) => flatten(nested, `${prefix}${key}: `));
    }
    return [`${prefix}${value}`];
  };

  return flatten(data).join(' | ');
};

const TeachersPage = () => {
  const { t } = useTranslation();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeFormVisible, setEmployeeFormVisible] = useState(true);
  const [lastTemporaryCredentials, setLastTemporaryCredentials] = useState(null);

  const loadTeachers = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await teachersService.getAll();
      setTeachers(data);
    } catch {
      setError('Impossible de charger les employés pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeachers();
  }, []);

  const activeTeachers = teachers.filter((teacher) => teacher.is_active !== false).length;
  const teachingEmployees = teachers.filter((teacher) => teacher.employee_type === 'teacher').length;
  const biometricReady = teachers.filter((teacher) => teacher.has_photo || teacher.has_biometrics).length;
  const departments = useMemo(() => new Set(teachers.map((teacher) => teacher.department).filter(Boolean)).size, [teachers]);

  const columns = [
    { key: 'full_name', label: 'Employé' },
    { key: 'employee_id', label: 'ID employé', render: (value) => value || 'Auto' },
    { key: 'employee_label', label: 'Type', render: (value, row) => value || row.employee_type || 'Employé' },
    { key: 'job_title', label: 'Poste', render: (value) => value || 'Non renseigné' },
    { key: 'department', label: 'Département', render: (value) => value || 'Non assigné' },
    { key: 'employment_status', label: 'Statut', render: (value) => value || 'active' },
    { key: 'kcs_card_id', label: 'Carte KCS', render: (value) => value || 'À générer' },
    { key: 'bio', label: 'Bio', render: (_value, row) => (row.has_photo || row.has_biometrics ? 'Prêt' : 'À compléter') },
    { key: 'details', label: 'Action', render: (_value, row) => <button type="button" onClick={() => setSelectedEmployee({ ...row, role: row.employee_label || 'Employé' })} className="rounded-lg border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10">Voir</button> },
  ];

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submitTeacher = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback('');
    setError('');

    try {
      const response = await teachersService.create({
        user: {
          first_name: form.firstName,
          last_name: form.lastName,
          ...(form.email ? { email: form.email } : {}),
          phone: form.phone,
          ...form.identity,
        },
        ...(form.teacherId ? { teacher_id: form.teacherId } : {}),
        employee_type: form.employeeType,
        department: form.department,
        job_title: form.jobTitle,
        specialization: form.specialization,
        hire_date: form.hireDate,
        contract_type: form.contractType,
        work_location: form.workLocation,
        work_email: form.workEmail,
        office_phone_extension: form.officePhoneExtension,
        payroll_reference: form.payrollReference,
        national_id_number: form.nationalIdNumber,
        social_security_number: form.socialSecurityNumber,
        tax_number: form.taxNumber,
        bank_name: form.bankName,
        bank_account_number: form.bankAccountNumber,
        salary_grade: form.salaryGrade,
        base_salary: form.baseSalary || null,
        pay_frequency: form.payFrequency,
        supervisor_name: form.supervisorName,
      });

      const credentials = response.temporaryCredentials;
      const accessSummary = credentials?.temporaryPassword
        ? ` Accès temporaire: ${credentials.username} / ${credentials.temporaryPassword}.`
        : '';
      setLastTemporaryCredentials(credentials || null);
      setFeedback(`Employé enregistré. Mot de passe généré par le système et à changer à la première connexion.${accessSummary}`);
      setForm({ ...initialForm, hireDate: new Date().toISOString().slice(0, 10), identity: { ...emptyIdentityCapture } });
      await loadTeachers();
    } catch (submissionError) {
      setError(formatApiError(submissionError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <section className="mb-6 page-enter">
        <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Gestion des employés</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.teachers')}</h2>
        <p className="mt-2 text-sm text-slate-400">Gestion globale des employés KCS : enseignants, administration, support, leadership et spécialistes.</p>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Employés actifs" value={activeTeachers} accent="text-cyan-300" />
        <StatCard title="Dont enseignants" value={teachingEmployees} accent="text-sky-300" />
        <StatCard title="Cartes prêtes" value={biometricReady} subtitle="Photo ou biométrie présente" accent="text-emerald-300" />
        <StatCard title="Départements" value={departments} accent="text-amber-300" />
      </section>

      <section className="mb-6 card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-slate-100">Nouvel employé</h3>
            <p className="mt-1 text-sm text-slate-400">Formulaire simplifié : les champs RH sensibles restent optionnels, la carte KCS et l'accès temporaire sont générés automatiquement.</p>
          </div>
          <button
            type="button"
            onClick={() => setEmployeeFormVisible((visible) => !visible)}
            aria-expanded={employeeFormVisible}
            className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/60"
          >
            {employeeFormVisible ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        {employeeFormVisible ? <form onSubmit={submitTeacher} className="space-y-4">
          {lastTemporaryCredentials ? (
            <section className="rounded-2xl border border-emerald-400/35 bg-emerald-400/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Accès temporaire généré</p>
                  <h4 className="mt-1 font-display text-lg font-semibold text-slate-100">Mot de passe à remettre à l'employé</h4>
                </div>
                <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-bold text-slate-950">À changer à la première connexion</span>
              </div>
              <div className="mt-4 rounded-xl border border-emerald-300/25 bg-slate-950/70 p-3">
                <p className="text-sm text-slate-200">Utilisateur: <span className="font-metric font-bold text-white">{lastTemporaryCredentials.username}</span></p>
                <p className="mt-1 text-sm text-slate-200">Mot de passe: <span className="font-metric font-bold text-emerald-200">{lastTemporaryCredentials.temporaryPassword || 'Déjà défini'}</span></p>
              </div>
            </section>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={form.firstName} onChange={(event) => updateForm('firstName', event.target.value)} placeholder="Prénom" className={inputClass} required />
            <input value={form.lastName} onChange={(event) => updateForm('lastName', event.target.value)} placeholder="Nom" className={inputClass} required />
            <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="Email personnel optionnel" className={inputClass} />
            <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="Téléphone" className={inputClass} />
            <input value={form.department} onChange={(event) => updateForm('department', event.target.value)} placeholder="Département" className={inputClass} />
            <input value={form.jobTitle} onChange={(event) => updateForm('jobTitle', event.target.value)} placeholder="Titre du poste" className={inputClass} />
            <input value={form.specialization} onChange={(event) => updateForm('specialization', event.target.value)} placeholder="Spécialité / matière si enseignant" className={inputClass} />
            <input type="date" value={form.hireDate} onChange={(event) => updateForm('hireDate', event.target.value)} className={inputClass} required />
            <select value={form.employeeType} onChange={(event) => updateForm('employeeType', event.target.value)} className={inputClass}>
              <option value="teacher">Teacher</option>
              <option value="administrative">Administrative Staff</option>
              <option value="support">Support Staff</option>
              <option value="leadership">Leadership</option>
              <option value="specialist">Specialist</option>
            </select>
            <select value={form.contractType} onChange={(event) => updateForm('contractType', event.target.value)} className={inputClass}>
              <option value="permanent">Permanent</option>
              <option value="temporary">Temporary</option>
              <option value="part_time">Part Time</option>
              <option value="consultant">Consultant</option>
            </select>
            <input value={form.workLocation} onChange={(event) => updateForm('workLocation', event.target.value)} placeholder="Lieu de travail" className={inputClass} />
            <input type="email" value={form.workEmail} onChange={(event) => updateForm('workEmail', event.target.value)} placeholder="Email professionnel" className={inputClass} />
            <input value={form.supervisorName} onChange={(event) => updateForm('supervisorName', event.target.value)} placeholder="Superviseur" className={inputClass} />
          </div>

          <details className="rounded-2xl border border-github-border bg-slate-950/35 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-100">Options avancees RH, paie et identifiants</summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input value={form.teacherId} onChange={(event) => updateForm('teacherId', event.target.value)} placeholder="ID employé optionnel" className={inputClass} />
              <input value={form.officePhoneExtension} onChange={(event) => updateForm('officePhoneExtension', event.target.value)} placeholder="Extension bureau" className={inputClass} />
              <input value={form.payrollReference} onChange={(event) => updateForm('payrollReference', event.target.value)} placeholder="Reference paie" className={inputClass} />
              <input value={form.nationalIdNumber} onChange={(event) => updateForm('nationalIdNumber', event.target.value)} placeholder="Numéro d'identité" className={inputClass} />
              <input value={form.socialSecurityNumber} onChange={(event) => updateForm('socialSecurityNumber', event.target.value)} placeholder="Sécurité sociale" className={inputClass} />
              <input value={form.taxNumber} onChange={(event) => updateForm('taxNumber', event.target.value)} placeholder="Numéro fiscal" className={inputClass} />
              <input value={form.bankName} onChange={(event) => updateForm('bankName', event.target.value)} placeholder="Banque" className={inputClass} />
              <input value={form.bankAccountNumber} onChange={(event) => updateForm('bankAccountNumber', event.target.value)} placeholder="Compte bancaire" className={inputClass} />
              <input value={form.salaryGrade} onChange={(event) => updateForm('salaryGrade', event.target.value)} placeholder="Grade salarial" className={inputClass} />
              <input type="number" min="0" step="0.01" value={form.baseSalary} onChange={(event) => updateForm('baseSalary', event.target.value)} placeholder="Salaire de base" className={inputClass} />
              <select value={form.payFrequency} onChange={(event) => updateForm('payFrequency', event.target.value)} className={inputClass}>
                <option value="monthly">Mensuel</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="daily">Journalier</option>
                <option value="hourly">Horaire</option>
              </select>
            </div>
          </details>

          <IdentityCapturePanel
            value={form.identity}
            subjectName={`${form.firstName} ${form.lastName}`}
            onChange={(identity) => updateForm('identity', identity)}
          />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-slate-100">Aperçu de la carte biométrique employé</p>
              <p className="mt-1 text-xs text-slate-400">La carte KCS reprend le logo de l'école, la photo, le poste et les empreintes liées au lecteur.</p>
            </div>
            <KcsIdCard entity={{
              full_name: `${form.firstName} ${form.lastName}`.trim() || 'Employé KCS',
              role: form.employeeType === 'teacher' ? 'Enseignant' : 'Employé',
              employee_id: form.teacherId || 'Auto',
              department: form.department,
              job_title: form.jobTitle,
              email: form.email || form.workEmail,
              phone: form.phone,
              ...form.identity,
            }} />
          </div>

          {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button type="submit" disabled={submitting} className="rounded-xl bg-kcs-blue px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {submitting ? 'Enregistrement en cours...' : "Enregistrer l'employé"}
          </button>
        </form> : null}
      </section>

      {loading ? <p className="mb-4 text-sm text-slate-400">Chargement des employés...</p> : null}
      <DataTable columns={columns} data={teachers} />

      <EntityDetailPanel entity={selectedEmployee} type="employee" onClose={() => setSelectedEmployee(null)} />
    </DashboardLayout>
  );
};

export default TeachersPage;
