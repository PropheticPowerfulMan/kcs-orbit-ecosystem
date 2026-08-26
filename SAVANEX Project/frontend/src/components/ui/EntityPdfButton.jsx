import React, { useState } from 'react';
import { CheckCircle2, FileDown } from 'lucide-react';
import { generateEntityPdf } from '../../utils/entityPdf';

const EntityPdfButton = ({ entity, type }) => {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');

  const print = async () => {
    setBusy(true);
    try {
      const result = await generateEntityPdf(entity, type);
      setSuccess(`Téléchargement terminé : ${result.filename}`);
      window.setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      window.alert(error?.response?.data?.detail || error?.message || 'Impossible de générer le dossier PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" disabled={busy} onClick={() => void print()} className="savanex-entity-action inline-flex items-center gap-1.5 border border-cyan-300/40 bg-cyan-300/10 text-cyan-100 disabled:opacity-60">
        <FileDown className="h-3.5 w-3.5" />
        {busy ? 'Préparation...' : 'Imprimer'}
      </button>
      {success ? (
        <div role="status" className="fixed bottom-5 right-5 z-[1200] flex max-w-sm items-center gap-3 rounded-lg border border-emerald-300/40 bg-emerald-950/95 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-2xl">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}
    </>
  );
};

export default EntityPdfButton;
