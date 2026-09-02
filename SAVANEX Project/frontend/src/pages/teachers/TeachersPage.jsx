import LegacyImportLink from '../../components/common/LegacyImportLink';
import InternationalPhoneInput from '../../components/InternationalPhoneInput';
import DateSelect from '../../components/common/DateSelect';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataTable from '../../components/ui/DataTable';
import EntityDetailPanel from '../../components/ui/EntityDetailPanel';
import EntityPdfButton from '../../components/ui/EntityPdfButton';
import SearchField from '../../components/ui/SearchField';
import StatCard from '../../components/ui/StatCard';
import { emptyIdentityCapture, IdentityCapturePanel, KcsIdCard } from '../../components/ui/KcsIdentityTools';
import { teachersService } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { Building2, Landmark, MapPin, Plus, ShieldAlert, Trash2, UserRound, UsersRound } from 'lucide-react';

const inputClass = 'w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue';

const buildTeacherPayload = (form) => ({
  ...(form.firstName ? { first_name: form.firstName } : {}),
  ...(form.middleName !== undefined ? { middle_name: form.middleName } : {}),
  ...(form.lastName ? { last_name: form.lastName } : {}),
  ...(form.email ? { user_email: form.email } : { user_email: '' }),
  ...(form.phone !== undefined ? { phone: form.phone } : {}),
  employee_type: form.employeeType,
  gender: form.gender,
  department: form.department,
  job_title: form.jobTitle,
  specialization: form.specialization,
  hire_date: form.hireDate,
  contract_type: form.contractType,
  contract_duration_months: form.contractDurationMonths || null,
  birth_date: form.birthDate || null,
  birth_place: form.birthPlace,
  nationality: form.nationality,
  identity_document_type: form.identityDocumentType,
  identity_document_other: form.identityDocumentOther,
  residential_address: form.residentialAddress,
  secondary_phone: form.secondaryPhone,
  personal_email: form.personalEmail,
  email_contact_preference: form.emailContactPreference,
  work_location: form.workLocation,
  work_email: form.workEmail,
  office_phone_extension: form.officePhoneExtension,
  payroll_reference: form.payrollReference,
  national_id_number: form.nationalIdNumber,
  social_security_number: form.socialSecurityNumber,
  onem_number: form.onemNumber,
  tax_number: form.taxNumber,
  bank_name: form.bankName,
  bank_account_number: form.bankAccountNumber,
  bank_swift_iban: form.bankSwiftIban,
  salary_grade: form.salaryGrade,
  base_salary: form.baseSalary || null,
  pay_frequency: form.payFrequency,
  supervisor_name: form.supervisorName,
  emergency_contact_name: form.emergencyContactName,
  emergency_contact_relationship: form.emergencyContactRelationship,
  emergency_contact_phone: form.emergencyContactPhone,
  emergency_contact_phone_secondary: form.emergencyContactPhoneSecondary,
  marital_status: form.maritalStatus,
  spouse_full_name: form.spouseFullName,
  spouse_phone: form.spousePhone,
  spouse_occupation: form.spouseOccupation,
  children: form.children,
  photo_data: form.identity.photo_data,
  photo_source: form.identity.photo_source,
});

const buildTeacherCreatePayload = (form) => ({
  user: {
    first_name: form.firstName,
    middle_name: form.middleName,
    last_name: form.lastName,
    phone: form.phone,
    ...form.identity,
  },
  employee_type: form.employeeType,
  gender: form.gender,
  department: form.department,
  job_title: form.jobTitle,
  specialization: form.specialization,
  hire_date: form.hireDate,
  contract_type: form.contractType,
  contract_duration_months: form.contractDurationMonths || null,
  birth_date: form.birthDate || null,
  birth_place: form.birthPlace,
  nationality: form.nationality,
  identity_document_type: form.identityDocumentType,
  identity_document_other: form.identityDocumentOther,
  residential_address: form.residentialAddress,
  secondary_phone: form.secondaryPhone,
  personal_email: form.personalEmail,
  email_contact_preference: form.emailContactPreference,
  work_location: form.workLocation,
  work_email: form.workEmail,
  office_phone_extension: form.officePhoneExtension,
  payroll_reference: form.payrollReference,
  national_id_number: form.nationalIdNumber,
  social_security_number: form.socialSecurityNumber,
  onem_number: form.onemNumber,
  tax_number: form.taxNumber,
  bank_name: form.bankName,
  bank_account_number: form.bankAccountNumber,
  bank_swift_iban: form.bankSwiftIban,
  salary_grade: form.salaryGrade,
  base_salary: form.baseSalary || null,
  pay_frequency: form.payFrequency,
  supervisor_name: form.supervisorName,
  emergency_contact_name: form.emergencyContactName,
  emergency_contact_relationship: form.emergencyContactRelationship,
  emergency_contact_phone: form.emergencyContactPhone,
  emergency_contact_phone_secondary: form.emergencyContactPhoneSecondary,
  marital_status: form.maritalStatus,
  spouse_full_name: form.spouseFullName,
  spouse_phone: form.spousePhone,
  spouse_occupation: form.spouseOccupation,
  children: form.children,
});

const mapTeacherToForm = (teacher) => ({
  firstName: teacher?.first_name || '',
  middleName: teacher?.middle_name || '',
  lastName: teacher?.last_name || '',
  email: teacher?.email || '',
  phone: teacher?.contact_phone || teacher?.phone || '',
  teacherId: teacher?.teacher_id || teacher?.employee_id || '',
  employeeType: teacher?.employee_type || 'teacher',
  gender: teacher?.gender || '',
  department: teacher?.department || '',
  jobTitle: teacher?.job_title || '',
  specialization: teacher?.specialization || '',
  hireDate: teacher?.hire_date || new Date().toISOString().slice(0, 10),
  contractType: teacher?.contract_type || 'permanent',
  contractDurationMonths: teacher?.contract_duration_months || '',
  birthDate: teacher?.birth_date || '',
  birthPlace: teacher?.birth_place || '',
  nationality: teacher?.nationality || 'Congolaise',
  identityDocumentType: teacher?.identity_document_type || '',
  identityDocumentOther: teacher?.identity_document_other || '',
  residentialAddress: teacher?.residential_address || '',
  secondaryPhone: teacher?.secondary_phone || '',
  personalEmail: teacher?.personal_email || '',
  emailContactPreference: teacher?.email_contact_preference || 'work',
  workLocation: teacher?.work_location || '',
  workEmail: teacher?.work_email || '',
  officePhoneExtension: teacher?.office_phone_extension || '',
  payrollReference: teacher?.payroll_reference || '',
  nationalIdNumber: teacher?.national_id_number || '',
  socialSecurityNumber: teacher?.social_security_number || '',
  onemNumber: teacher?.onem_number || '',
  taxNumber: teacher?.tax_number || '',
  bankName: teacher?.bank_name || '',
  bankAccountNumber: teacher?.bank_account_number || '',
  bankSwiftIban: teacher?.bank_swift_iban || '',
  salaryGrade: teacher?.salary_grade || '',
  baseSalary: teacher?.base_salary || '',
  payFrequency: teacher?.pay_frequency || 'monthly',
  supervisorName: teacher?.supervisor_name || '',
  emergencyContactName: teacher?.emergency_contact_name || '',
  emergencyContactRelationship: teacher?.emergency_contact_relationship || '',
  emergencyContactPhone: teacher?.emergency_contact_phone || '',
  emergencyContactPhoneSecondary: teacher?.emergency_contact_phone_secondary || '',
  maritalStatus: teacher?.marital_status || 'single',
  spouseFullName: teacher?.spouse_full_name || '',
  spousePhone: teacher?.spouse_phone || '',
  spouseOccupation: teacher?.spouse_occupation || '',
  children: Array.isArray(teacher?.children) ? teacher.children : [],
  identity: {
    photo_data: teacher?.photo_data || '',
    photo_source: teacher?.photo_source || '',
    left_fingerprint_data: teacher?.left_fingerprint_data || '',
    right_fingerprint_data: teacher?.right_fingerprint_data || '',
  },
});

const initialForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  teacherId: '',
  employeeType: 'teacher',
  gender: '',
  department: '',
  jobTitle: '',
  specialization: '',
  hireDate: new Date().toISOString().slice(0, 10),
  contractType: 'permanent',
  contractDurationMonths: '',
  birthDate: '',
  birthPlace: '',
  nationality: 'Congolaise',
  identityDocumentType: '',
  identityDocumentOther: '',
  residentialAddress: '',
  secondaryPhone: '',
  personalEmail: '',
  emailContactPreference: 'work',
  workLocation: '',
  workEmail: '',
  officePhoneExtension: '',
  payrollReference: '',
  nationalIdNumber: '',
  socialSecurityNumber: '',
  onemNumber: '',
  taxNumber: '',
  bankName: '',
  bankAccountNumber: '',
  bankSwiftIban: '',
  salaryGrade: '',
  baseSalary: '',
  payFrequency: 'monthly',
  supervisorName: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
  emergencyContactPhoneSecondary: '',
  maritalStatus: 'single',
  spouseFullName: '',
  spousePhone: '',
  spouseOccupation: '',
  children: [],
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

const FormSection = ({ number, title, description, icon: Icon, children }) => (
  <section className="border-t border-slate-700/80 py-6 first:border-t-0 first:pt-1">
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Icon size={20} /></div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Section {number}</p>
        <h4 className="mt-1 font-display text-lg font-semibold text-slate-100">{title}</h4>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </div>
    {children}
  </section>
);

const FormField = ({ label, hint, required = false, className = '', ...props }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-semibold text-slate-300">{label}{required ? <span className="ml-1 text-rose-300">*</span> : null}</span>
    <input {...props} required={required} className={inputClass} />
    {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
  </label>
);

const SelectField = ({ label, children, className = '', ...props }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-semibold text-slate-300">{label}</span>
    <select {...props} className={inputClass}>{children}</select>
  </label>
);
const TeachersPage = () => {
  const { t } = useTranslation();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState(initialForm);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeFormVisible, setEmployeeFormVisible] = useState(true);
  const [lastTemporaryCredentials, setLastTemporaryCredentials] = useState(null);
  const employeeFormRef = useRef(null);

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
  const employeeCategories = useMemo(() => {
    const options = new Map([
      ['all', 'Tous les employés'],
      ['teacher', 'Professeurs'],
      ['administrative', 'Administration'],
      ['support', 'Support'],
      ['leadership', 'Leadership'],
      ['specialist', 'Spécialistes'],
    ]);

    teachers.forEach((teacher) => {
      const job = String(teacher.job_title || '').trim();
      const department = String(teacher.department || '').trim();
      if (job) options.set(`job:${job.toLowerCase()}`, `Poste: ${job}`);
      if (department) options.set(`department:${department.toLowerCase()}`, `Département: ${department}`);
    });

    return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
  }, [teachers]);
  const filteredTeachers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return teachers.filter((teacher) => {
      if (categoryFilter !== 'all') {
        if (categoryFilter.startsWith('job:') && String(teacher.job_title || '').trim().toLowerCase() !== categoryFilter.slice(4)) {
          return false;
        }
        if (categoryFilter.startsWith('department:') && String(teacher.department || '').trim().toLowerCase() !== categoryFilter.slice(11)) {
          return false;
        }
        if (!categoryFilter.includes(':') && teacher.employee_type !== categoryFilter) {
          return false;
        }
      }

      if (!normalizedQuery) return true;

      const haystack = [
        teacher.full_name,
        teacher.teacher_id,
        teacher.employee_id,
        teacher.kcs_card_id,
        teacher.employee_label,
        teacher.employee_type,
        teacher.gender,
        teacher.job_title,
        teacher.department,
        teacher.specialization,
        teacher.email,
        teacher.contact_phone || teacher.phone,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [categoryFilter, query, teachers]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const addChild = () => updateForm('children', [...form.children, { full_name: '', birth_date: '', gender: '' }]);
  const updateChild = (index, field, value) => updateForm('children', form.children.map((child, childIndex) => childIndex === index ? { ...child, [field]: value } : child));
  const removeChild = (index) => updateForm('children', form.children.filter((_child, childIndex) => childIndex !== index));

  const resetTeacherForm = () => {
    setForm({ ...initialForm, hireDate: new Date().toISOString().slice(0, 10), children: [], identity: { ...emptyIdentityCapture } });
    setEditingEmployee(null);
  };

  const openEmployeeEdit = (row) => {
    setEditingEmployee(row);
    setForm(mapTeacherToForm(row));
    setEmployeeFormVisible(true);
    setLastTemporaryCredentials(null);
    setFeedback('');
    setError('');
    window.requestAnimationFrame(() => {
      employeeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const submitTeacher = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback('');
    setError('');

    try {
      if (editingEmployee) {
        await teachersService.update(editingEmployee.id, buildTeacherPayload(form));
        setLastTemporaryCredentials(null);
        setFeedback('Employé modifié avec succès.');
      } else {
        const response = await teachersService.create(buildTeacherCreatePayload(form));

        const credentials = response.temporaryCredentials;
        const accessSummary = credentials?.temporaryPassword
          ? ` Accès temporaire: ${credentials.email || credentials.username} (${credentials.accessCode || 'sans code'}) / ${credentials.temporaryPassword}.`
          : '';
        setLastTemporaryCredentials(credentials || null);
        setFeedback(`Employé enregistré. Mot de passe généré par le système et à changer à la première connexion.${accessSummary}`);
      }

      resetTeacherForm();
      await loadTeachers();
    } catch (submissionError) {
      setError(formatApiError(submissionError));
    } finally {
      setSubmitting(false);
    }
  };

  async function handleDelete(teacher) {
    const confirmed = window.confirm(`Supprimer ${teacher.full_name || teacher.employee_id} ?`);
    if (!confirmed) return;

    setSubmitting(true);
    setFeedback('');
    setError('');
    try {
      await teachersService.remove(teacher.id);
      if (selectedEmployee?.id === teacher.id) {
        setSelectedEmployee(null);
      }
      if (editingEmployee?.id === teacher.id) {
        resetTeacherForm();
      }
      setLastTemporaryCredentials(null);
      setFeedback('Employé désactivé avec succès.');
      await loadTeachers();
    } catch (deleteError) {
      setError(formatApiError(deleteError));
    } finally {
      setSubmitting(false);
    }
  }
  async function handleResetAccess(teacher) {
    const confirmed = window.confirm(`Réinitialiser les accès institutionnels de ${teacher.full_name || teacher.employee_id} ?`);
    if (!confirmed) return;
    setSubmitting(true);
    setFeedback('');
    setError('');
    try {
      const credentials = await teachersService.resetAccess(teacher);
      setEmployeeFormVisible(true);
      setLastTemporaryCredentials(credentials);
      setFeedback(`Accès de ${teacher.full_name || teacher.employee_id} réinitialisés. Les anciennes sessions sont invalidées et les nouveaux identifiants ont été transmis.`);
    } catch (resetError) {
      setError(formatApiError(resetError));
    } finally {
      setSubmitting(false);
    }
  }


  const columns = [
    { key: 'full_name', label: 'Employé' },
    { key: 'employee_id', label: 'ID employé', render: (value) => value || 'Auto' },
    { key: 'employee_label', label: 'Type', render: (value, row) => value || row.employee_type || 'Employé' },
    { key: 'gender', label: 'Sexe', render: (value) => ({ F: 'Feminin', M: 'Masculin', O: 'Autre' }[value] || 'Non renseigne') },
    { key: 'job_title', label: 'Poste', render: (value) => value || 'Non renseigné' },
    { key: 'department', label: 'Département', render: (value) => value || 'Non assigné' },
    { key: 'employment_status', label: 'Statut', render: (value) => value || 'active' },
    { key: 'kcs_card_id', label: 'Carte KCS', render: (value) => value || 'À générer' },
    { key: 'bio', label: 'Bio', render: (_value, row) => (row.has_photo || row.has_biometrics ? 'Prêt' : 'À compléter') },
    {
      key: 'details',
      label: 'Action',
      render: (_value, row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedEmployee({ ...row, role: row.employee_label || 'Employe' })} className="savanex-entity-action savanex-entity-action-view">Voir</button>
          <EntityPdfButton entity={row} type="employee" />
          <button type="button" onClick={() => openEmployeeEdit(row)} className="savanex-entity-action savanex-entity-action-edit">Modifier</button>
          <button type="button" disabled={submitting} onClick={() => void handleResetAccess(row)} className="savanex-entity-action savanex-entity-action-edit">Reset accès</button>
          <button type="button" onClick={() => void handleDelete(row)} className="savanex-entity-action savanex-entity-action-danger">Supprimer</button>
        </div>
      )
    },
  ];

  return (
    <DashboardLayout>
      <section className="mb-6 page-enter">
        <p className="text-xs uppercase tracking-[0.24em] text-kcs-blue">Gestion des employés</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">{t('nav.teachers')}</h2>
        <p className="mt-2 text-sm text-slate-400">Gestion globale des employés KCS : enseignants, administration, support, leadership et spécialistes.</p>
      </section>

      <div className="mb-4"><LegacyImportLink entity="TEACHER" /></div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Employés actifs" value={activeTeachers} accent="text-cyan-300" />
        <StatCard title="Dont enseignants" value={teachingEmployees} accent="text-sky-300" />
        <StatCard title="Cartes prêtes" value={biometricReady} subtitle="Photo ou biométrie présente" accent="text-emerald-300" />
        <StatCard title="Départements" value={departments} accent="text-amber-300" />
      </section>

      <section ref={employeeFormRef} className="mb-6 card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-slate-100">{editingEmployee ? 'Modifier un employé' : 'Nouvel employé'}</h3>
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
          {lastTemporaryCredentials ? createPortal(
            <section role="dialog" aria-modal="true" aria-label="Nouveaux accès de l'employé" className="fixed left-1/2 top-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-400/35 bg-slate-950 p-6 shadow-2xl ring-1 ring-black/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Accès temporaire généré</p>
                  <h4 className="mt-1 font-display text-lg font-semibold text-slate-100">Accès aux applications de l'employé</h4>
                </div>
                <button type="button" onClick={() => setLastTemporaryCredentials(null)} className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-slate-800">Fermer</button>
                <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-bold text-slate-950">À changer à la première connexion</span>
              </div>
              <div className="mt-4 rounded-xl border border-emerald-300/25 bg-slate-950/70 p-3">
                <div className="mb-3 flex flex-wrap gap-2">{(lastTemporaryCredentials.applications || []).map((application) => <span key={application.key} className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100">{application.label}</span>)}</div>
                <p className="text-sm text-slate-200">Identifiant: <span className="font-metric font-bold text-white">{lastTemporaryCredentials.email || lastTemporaryCredentials.username}</span></p>
                <p className="mt-1 text-sm text-slate-200">Code d'accès: <span className="font-metric font-bold text-sky-200">{lastTemporaryCredentials.accessCode || 'Non défini'}</span></p>
                <p className="mt-1 text-sm text-slate-200">Mot de passe: <span className="font-metric font-bold text-emerald-200">{lastTemporaryCredentials.temporaryPassword || 'Déjà défini'}</span></p>
                <div className="mt-3 flex flex-wrap gap-2">{(lastTemporaryCredentials.delivery || []).map((item, index) => <span key={item.channel || index} className={'rounded-full px-3 py-1 text-xs font-bold ' + (['sent','queued'].includes(item.status) ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200')}>{item.channel === 'sms' ? 'SMS' : 'Email'} : {item.status === 'sent' ? 'envoyé' : item.status === 'queued' ? 'programmé' : 'échec'}</span>)}</div>
                <p className="mt-3 text-xs text-slate-400">Ces mêmes identifiants ouvrent Savanex, EduPay et, pour un enseignant, KCS Nexus.</p>
              </div>
            </section>
          ) : null}

          <div className="rounded-lg border border-slate-700/80 bg-slate-950/20 px-4 sm:px-6">
            <FormSection number="1" title="Informations administratives" description="Données réservées aux RH, contrat, affectation et paie." icon={Building2}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Code employé</span><div className={`${inputClass} cursor-not-allowed border-dashed opacity-75`}>{form.teacherId || 'Généré automatiquement par le système'}</div></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Date d'intégration <span className="text-rose-300">*</span></span><DateSelect value={form.hireDate} onChange={(event) => updateForm('hireDate', event.target.value)} className={inputClass} required /></label>
                <SelectField label="Catégorie d'employé" value={form.employeeType} onChange={(event) => updateForm('employeeType', event.target.value)}>
                  <option value="teacher">Enseignant</option><option value="administrative">Personnel administratif</option><option value="support">Personnel de support</option><option value="leadership">Leadership</option><option value="specialist">Spécialiste</option>
                </SelectField>
                <SelectField label="Type de contrat" value={form.contractType} onChange={(event) => updateForm('contractType', event.target.value)}>
                  <option value="permanent">CDI</option><option value="temporary">CDD</option><option value="internship">Stage</option><option value="consultant">Consultant / Prestataire</option><option value="part_time">Temps partiel</option>
                </SelectField>
                {form.contractType === 'temporary' ? <FormField label="Durée du CDD (mois)" type="number" min="1" max="120" value={form.contractDurationMonths} onChange={(event) => updateForm('contractDurationMonths', event.target.value)} /> : null}
                <FormField label="Département / Service" value={form.department} onChange={(event) => updateForm('department', event.target.value)} />
                <FormField label="Intitulé du poste" value={form.jobTitle} onChange={(event) => updateForm('jobTitle', event.target.value)} />
                <FormField label="Spécialité / matière" value={form.specialization} onChange={(event) => updateForm('specialization', event.target.value)} />
                <FormField label="Lieu de travail" value={form.workLocation} onChange={(event) => updateForm('workLocation', event.target.value)} />
                <FormField label="Référence paie" value={form.payrollReference} onChange={(event) => updateForm('payrollReference', event.target.value)} />
                <FormField label="Responsable hiérarchique" value={form.supervisorName} onChange={(event) => updateForm('supervisorName', event.target.value)} />
              </div>
            </FormSection>

            <FormSection number="2" title="État civil et identité" description="Identité officielle selon l'ordre administratif KCS : nom, post-nom, prénom." icon={UserRound}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField label="Nom" required value={form.lastName} onChange={(event) => updateForm('lastName', event.target.value)} />
                <FormField label="Post-nom" value={form.middleName} onChange={(event) => updateForm('middleName', event.target.value)} />
                <FormField label="Prénom" required value={form.firstName} onChange={(event) => updateForm('firstName', event.target.value)} />
                <SelectField label="Genre" value={form.gender} onChange={(event) => updateForm('gender', event.target.value)}><option value="">Non renseigné</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="O">Autre</option></SelectField>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Date de naissance</span><DateSelect value={form.birthDate} onChange={(event) => updateForm('birthDate', event.target.value)} className={inputClass} /></label>
                <FormField label="Lieu de naissance" value={form.birthPlace} onChange={(event) => updateForm('birthPlace', event.target.value)} />
                <FormField label="Nationalité" value={form.nationality} onChange={(event) => updateForm('nationality', event.target.value)} />
                <SelectField label="Pièce d'identité fournie" value={form.identityDocumentType} onChange={(event) => updateForm('identityDocumentType', event.target.value)}><option value="">Non renseignée</option><option value="voter_card">Carte d'électeur</option><option value="passport">Passeport</option><option value="other">Autre</option></SelectField>
                {form.identityDocumentType === 'other' ? <FormField label="Autre pièce d'identité" value={form.identityDocumentOther} onChange={(event) => updateForm('identityDocumentOther', event.target.value)} /> : null}
                <FormField label="Numéro de la pièce" value={form.nationalIdNumber} onChange={(event) => updateForm('nationalIdNumber', event.target.value)} />
              </div>
            </FormSection>

            <FormSection number="3" title="Coordonnées de contact" description="Coordonnées personnelles et canal email à utiliser pour les opérations administratives." icon={MapPin}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block md:col-span-2 xl:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Adresse résidentielle actuelle</span><textarea value={form.residentialAddress} onChange={(event) => updateForm('residentialAddress', event.target.value)} rows="2" className={inputClass} /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Téléphone principal</span><InternationalPhoneInput value={form.phone} onChange={(value) => updateForm('phone', value)} /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Téléphone secondaire</span><InternationalPhoneInput value={form.secondaryPhone} onChange={(value) => updateForm('secondaryPhone', value)} /></label>
                <FormField label="Email personnel" type="email" value={form.personalEmail} onChange={(event) => updateForm('personalEmail', event.target.value)} />
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Email professionnel</span><div className={`${inputClass} cursor-not-allowed border-dashed opacity-75`}>{form.email || form.workEmail || 'Adresse @ourkcs.org générée à la création'}</div></label>
                <SelectField label="Email(s) à utiliser" value={form.emailContactPreference} onChange={(event) => updateForm('emailContactPreference', event.target.value)}><option value="work">Professionnel uniquement</option><option value="personal">Personnel uniquement</option><option value="both">Les deux adresses</option></SelectField>
                <FormField label="Extension bureau" value={form.officePhoneExtension} onChange={(event) => updateForm('officePhoneExtension', event.target.value)} />
              </div>
            </FormSection>

            <FormSection number="4" title="Informations fiscales, bancaires et paie" description="Informations confidentielles réservées aux opérations RH et financières autorisées." icon={Landmark}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField label="Numéro CNSS" value={form.socialSecurityNumber} onChange={(event) => updateForm('socialSecurityNumber', event.target.value)} />
                <FormField label="Numéro ONEM" value={form.onemNumber} onChange={(event) => updateForm('onemNumber', event.target.value)} />
                <FormField label="Numéro fiscal" value={form.taxNumber} onChange={(event) => updateForm('taxNumber', event.target.value)} />
                <FormField label="Nom de la banque" value={form.bankName} onChange={(event) => updateForm('bankName', event.target.value)} />
                <FormField label="Numéro de compte bancaire" value={form.bankAccountNumber} onChange={(event) => updateForm('bankAccountNumber', event.target.value)} />
                <FormField label="Code SWIFT / IBAN" value={form.bankSwiftIban} onChange={(event) => updateForm('bankSwiftIban', event.target.value)} />
                <FormField label="Grade salarial" value={form.salaryGrade} onChange={(event) => updateForm('salaryGrade', event.target.value)} />
                <FormField label="Salaire de base" type="number" min="0" step="0.01" value={form.baseSalary} onChange={(event) => updateForm('baseSalary', event.target.value)} />
                <SelectField label="Fréquence de paie" value={form.payFrequency} onChange={(event) => updateForm('payFrequency', event.target.value)}><option value="monthly">Mensuelle</option><option value="weekly">Hebdomadaire</option><option value="daily">Journalière</option><option value="hourly">Horaire</option></SelectField>
              </div>
            </FormSection>

            <FormSection number="5" title="Contact d'urgence" description="Personne à joindre prioritairement en cas d'urgence concernant l'employé." icon={ShieldAlert}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FormField label="Nom complet du contact" value={form.emergencyContactName} onChange={(event) => updateForm('emergencyContactName', event.target.value)} />
                <FormField label="Lien de parenté" value={form.emergencyContactRelationship} onChange={(event) => updateForm('emergencyContactRelationship', event.target.value)} placeholder="Époux(se), père, mère..." />
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Téléphone d'urgence 1</span><InternationalPhoneInput value={form.emergencyContactPhone} onChange={(value) => updateForm('emergencyContactPhone', value)} /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Téléphone d'urgence 2</span><InternationalPhoneInput value={form.emergencyContactPhoneSecondary} onChange={(value) => updateForm('emergencyContactPhoneSecondary', value)} /></label>
              </div>
            </FormSection>

            <FormSection number="6" title="Situation familiale" description="Situation matrimoniale, conjoint et enfants déclarés par l'employé." icon={UsersRound}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SelectField label="Situation matrimoniale" value={form.maritalStatus} onChange={(event) => updateForm('maritalStatus', event.target.value)}><option value="single">Célibataire</option><option value="married">Marié(e)</option><option value="widowed">Veuf / Veuve</option><option value="divorced">Divorcé(e)</option></SelectField>
                {form.maritalStatus === 'married' ? <><FormField label="Nom complet du conjoint" value={form.spouseFullName} onChange={(event) => updateForm('spouseFullName', event.target.value)} /><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-300">Téléphone du conjoint</span><InternationalPhoneInput value={form.spousePhone} onChange={(value) => updateForm('spousePhone', value)} /></label><FormField label="Profession du conjoint" value={form.spouseOccupation} onChange={(event) => updateForm('spouseOccupation', event.target.value)} /></> : null}
              </div>
              <div className="mt-5 border-t border-slate-700/70 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">Enfants</p><p className="mt-1 text-xs text-slate-400">Ajoutez uniquement les enfants déclarés dans le dossier RH.</p></div><button type="button" onClick={addChild} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10"><Plus size={16} />Ajouter un enfant</button></div>
                <div className="mt-4 space-y-3">
                  {form.children.map((child, index) => <div key={`child-${index}`} className="grid gap-3 border-l-2 border-cyan-300/30 pl-4 md:grid-cols-[1fr_0.7fr_0.55fr_auto] md:items-end"><FormField label={`Nom complet de l'enfant ${index + 1}`} value={child.full_name || ''} onChange={(event) => updateChild(index, 'full_name', event.target.value)} /><FormField label="Date de naissance" type="date" value={child.birth_date || ''} onChange={(event) => updateChild(index, 'birth_date', event.target.value)} /><SelectField label="Genre" value={child.gender || ''} onChange={(event) => updateChild(index, 'gender', event.target.value)}><option value="">Non renseigné</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="O">Autre</option></SelectField><button type="button" onClick={() => removeChild(index)} aria-label={`Supprimer l'enfant ${index + 1}`} title="Supprimer cet enfant" className="flex h-11 w-11 items-center justify-center rounded-lg border border-rose-300/30 text-rose-200 hover:bg-rose-400/10"><Trash2 size={17} /></button></div>)}
                  {form.children.length === 0 ? <p className="text-sm text-slate-500">Aucun enfant renseigné.</p> : null}
                </div>
              </div>
            </FormSection>
          </div>

          <IdentityCapturePanel
            value={form.identity}
            subjectName={`${form.lastName} ${form.middleName} ${form.firstName}`.replace(/\s+/g, ' ').trim()}
            onChange={(identity) => updateForm('identity', identity)}
          />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-slate-100">Aperçu de la carte biométrique employé</p>
              <p className="mt-1 text-xs text-slate-400">La carte KCS reprend le logo de l'école, la photo, le poste et les empreintes liées au lecteur.</p>
            </div>
            <KcsIdCard entity={{
              full_name: `${form.lastName} ${form.middleName} ${form.firstName}`.replace(/\s+/g, ' ').trim() || 'Employé KCS',
              role: form.employeeType === 'teacher' ? 'Enseignant' : 'Employé',
              employee_id: form.teacherId || 'Auto',
              gender: form.gender,
              department: form.department,
              job_title: form.jobTitle,
              email: form.email || form.workEmail,
              phone: form.phone,
              ...form.identity,
            }} />
          </div>

          {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={submitting} className="rounded-xl bg-kcs-blue px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
              {submitting ? 'Enregistrement en cours...' : editingEmployee ? "Enregistrer les modifications" : "Enregistrer l'employé"}
            </button>
            {editingEmployee ? (
              <button type="button" onClick={resetTeacherForm} className="rounded-xl border border-github-border px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/70">
                Annuler
              </button>
            ) : null}
          </div>
        </form> : null}
      </section>

      <div className="mb-4 card p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]">
          <SearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher employé, département, poste, chauffeur, professeur ou ID..."
            inputClassName="pr-4"
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue"
          >
            {employeeCategories.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? <p className="mb-4 text-sm text-slate-400">Chargement des employés...</p> : null}
      <DataTable columns={columns} data={filteredTeachers} />

      <EntityDetailPanel
        entity={selectedEmployee}
        type="employee"
        onClose={() => setSelectedEmployee(null)}
        onEdit={(employee) => {
          setSelectedEmployee(null);
          openEmployeeEdit(employee);
          window.requestAnimationFrame(() => employeeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }}
      />
    </DashboardLayout>
  );
};

export default TeachersPage;
