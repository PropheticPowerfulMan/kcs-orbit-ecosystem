import React, { useEffect, useMemo, useRef } from 'react';
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
    ['Carte KCS', 'kcs_card_id'],
    ['Statut', 'is_active'],
    ['Mot de passe à changer', 'must_change_password'],
  ],
  parent: [
    ['Famille / parent', 'family_name'],
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
  const panelRef = useRef(null);
  const fields = useMemo(() => baseFieldsByType[type] || [], [type]);

  useEffect(() => {
    if (!entity) {
      return;
    }

    window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 20);
  }, [entity]);

  if (!entity) {
    return null;
  }

  return (
    <section ref={panelRef} className="mb-6 card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Consultation</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">{titles[type] || 'Fiche individuelle'}</h3>
          <p className="mt-1 text-sm text-slate-400">{subtitles[type] || 'Informations détaillées de l’entité sélectionnée.'}</p>
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
          <PrintableKcsCard entity={entity} />
        </div>
      </div>
    </section>
  );
};

export default EntityDetailPanel;
