import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { PrintableKcsCard } from './KcsIdentityTools';

const normalizeValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'Non renseigné';
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  return String(value);
};

const baseFieldsByType = {
  student: [
    ['ID élève', 'student_id'],
    ['Nom complet', 'full_name'],
    ['Email', 'email'],
    ['Classe', 'class_name'],
    ['Parent responsable', 'parent_name'],
    ['Date de naissance', 'date_of_birth'],
    ['Sexe', 'gender'],
    ['Adresse', 'address'],
    ['Carte KCS', 'kcs_card_id'],
    ['Statut', 'is_active'],
    ['Mot de passe à changer', 'must_change_password'],
  ],
  parent: [
    ['ID parent', 'parent_external_id'],
    ['Famille / parent', 'family_name'],
    ['Email', 'email'],
    ['Téléphone', 'phone'],
    ['Élèves liés', 'students_label'],
    ['Classes', 'classes_label'],
    ['Effectif', 'student_count'],
    ['Élèves actifs', 'activeStudents'],
    ['Carte KCS', 'kcs_card_id'],
  ],
  employee: [
    ['ID employé', 'employee_id'],
    ['Nom complet', 'full_name'],
    ['Type', 'employee_label'],
    ['Poste', 'job_title'],
    ['Département', 'department'],
    ['Email', 'email'],
    ['Téléphone', 'phone'],
    ['Email professionnel', 'work_email'],
    ['Lieu de travail', 'work_location'],
    ['Date embauche', 'hire_date'],
    ['Superviseur', 'supervisor_name'],
    ['Statut', 'employment_status'],
    ['Carte KCS', 'kcs_card_id'],
    ['Mot de passe à changer', 'must_change_password'],
  ],
};

const titles = {
  student: 'Fiche individuelle élève',
  parent: 'Fiche individuelle parent',
  employee: 'Fiche individuelle employé',
};

const subtitles = {
  student: 'Identité, classe, parent responsable, biométrie et carte KCS.',
  parent: 'Famille, enfants liés, classes associées, biométrie et carte KCS.',
  employee: 'Identité professionnelle, statut RH, biométrie et carte KCS.',
};

const EntityDetailPanel = ({ entity, type, onClose }) => {
  const fields = useMemo(() => baseFieldsByType[type] || [], [type]);

  useEffect(() => {
    if (!entity) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [entity, onClose]);

  if (!entity) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <section className="card max-h-[92vh] w-full max-w-5xl overflow-y-auto p-5 shadow-2xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Consultation</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">{titles[type] || 'Fiche individuelle'}</h3>
            <p className="mt-1 text-sm text-slate-400">{subtitles[type] || "Informations détaillées de l'entité sélectionnée."}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
            <X className="h-4 w-4" />
            Fermer
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map(([label, key]) => (
              <div key={key} className="rounded-xl border border-github-border bg-slate-950/45 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className="mt-2 break-words text-sm font-semibold text-slate-100">{normalizeValue(entity[key])}</p>
              </div>
            ))}
          </div>

          <div className="xl:w-[360px]">
            <div className="sticky top-0">
              <PrintableKcsCard entity={entity} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EntityDetailPanel;
