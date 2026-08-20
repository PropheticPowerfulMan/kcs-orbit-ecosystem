import React, { useEffect, useMemo } from 'react';
import { Edit3, X } from 'lucide-react';
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
    ['Carte KCS', 'kcs_card_id'],
    ['Statut', 'is_active'],
    ['Mot de passe à changer', 'must_change_password'],
  ],
  parent: [
    ['ID parent', 'parent_external_id'],
    ['Famille / parent', 'family_name'],
    ['Email', 'email'],
    ['Téléphone', 'phone'],
    ['Adresse physique', 'address'],
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
    ['Sexe', 'gender'],
    ['Poste', 'job_title'],
    ['Département', 'department'],
    ['Email', 'email'],
    ['Téléphone', 'phone'],
    ['Email professionnel', 'work_email'],
    ['Date embauche', 'hire_date'],
    ['Entree systeme', 'created_at'],
    ['Derniere mise a jour', 'updated_at'],
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

const EntityDetailPanel = ({ entity, type, onClose, onEdit }) => {
  const entityPhoto = entity.photo_data || entity.parent_photo_data || entity.avatar || '';
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
    <div
      className="savanex-modal-backdrop fixed inset-0 z-[1000] grid place-items-center overflow-y-auto px-4 py-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <section className="savanex-modal-panel savanex-entity-detail-panel w-full overflow-y-auto p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-kcs-blue">Consultation</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-slate-100">{titles[type] || 'Fiche individuelle'}</h3>
            <p className="mt-1 text-sm text-slate-400">{subtitles[type] || "Informations détaillées de l'entité sélectionnée."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onEdit ? (
              <button type="button" onClick={() => onEdit(entity)} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-200">
                <Edit3 className="h-4 w-4" />
                Modifier
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
              <X className="h-4 w-4" />
              Fermer
            </button>
          </div>
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
              {entityPhoto ? (
                <div className="mb-4 overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950/60 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-cyan-200">Photo</p>
                  <img src={entityPhoto} alt={entity.full_name || entity.family_name || 'Photo de l’entité'} className="mx-auto aspect-[4/3] max-h-64 w-full rounded-xl object-cover" />
                </div>
              ) : (
                <div className="mb-4 flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 px-4 text-center text-sm text-slate-400">Aucune photo enregistrée</div>
              )}
              <PrintableKcsCard entity={entity} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EntityDetailPanel;
