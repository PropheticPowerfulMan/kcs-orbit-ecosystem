import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, Fingerprint, Printer, Upload, X } from 'lucide-react';

const inputClass = 'w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue';

const buildFingerprintToken = (side, name = '') => {
  const seed = `${side}-${name}-${Date.now()}-${Math.random()}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }
  return `KCS-FP-${side.toUpperCase()}-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
};

export const emptyIdentityCapture = {
  photo_data: '',
  photo_source: '',
  left_fingerprint_data: '',
  right_fingerprint_data: '',
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const IdentityCapturePanel = ({ value, onChange, subjectName = '', compact = false }) => {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const update = (patch) => onChange({ ...emptyIdentityCapture, ...value, ...patch });

  useEffect(() => {
    if (!cameraOpen) {
      return undefined;
    }

    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => setCameraError("Camera indisponible. Utilise l'import photo."));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    update({ photo_data: dataUrl, photo_source: 'upload' });
  };

  const capturePhoto = () => {
    if (!videoRef.current) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    update({ photo_data: canvas.toDataURL('image/jpeg', 0.86), photo_source: 'camera' });
    setCameraOpen(false);
  };

  return (
    <div className={compact ? 'space-y-3' : 'rounded-2xl border border-github-border bg-slate-950/35 p-4'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Photo et biometrie KCS</p>
          <p className="mt-1 text-xs text-slate-400">Photo passeport, capture camera et empreintes digitales.</p>
        </div>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
          {value?.photo_data ? 'Photo prete' : 'Photo vide'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[140px_1fr]">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-github-border bg-slate-900">
          {value?.photo_data ? (
            <img src={value.photo_data} alt="Portrait KCS" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-9 w-9 text-slate-500" />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
              <Upload className="h-4 w-4" />
              Importer
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
            <button type="button" onClick={() => setCameraOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
              <Camera className="h-4 w-4" />
              Camera
            </button>
            {value?.photo_data ? (
              <button type="button" onClick={() => update({ photo_data: '', photo_source: '' })} className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/10">
                <X className="h-4 w-4" />
                Effacer
              </button>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <button type="button" onClick={() => update({ left_fingerprint_data: buildFingerprintToken('left', subjectName) })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
              <Fingerprint className="h-4 w-4" />
              Capturer gauche
            </button>
            <button type="button" onClick={() => update({ right_fingerprint_data: buildFingerprintToken('right', subjectName) })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
              <Fingerprint className="h-4 w-4" />
              Capturer droite
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <input value={value?.left_fingerprint_data || ''} onChange={(event) => update({ left_fingerprint_data: event.target.value })} placeholder="Empreinte gauche" className={inputClass} />
            <input value={value?.right_fingerprint_data || ''} onChange={(event) => update({ right_fingerprint_data: event.target.value })} placeholder="Empreinte droite" className={inputClass} />
          </div>
        </div>
      </div>

      {cameraOpen ? (
        <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-slate-950 p-4">
          <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-xl bg-black object-cover" />
          {cameraError ? <p className="mt-2 text-sm text-rose-300">{cameraError}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={capturePhoto} className="rounded-xl bg-kcs-blue px-4 py-2 text-sm font-semibold text-slate-950">Prendre la photo</button>
            <button type="button" onClick={() => setCameraOpen(false)} className="rounded-xl border border-github-border px-4 py-2 text-sm text-slate-200">Fermer</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const KcsIdCard = ({ entity }) => {
  if (!entity) {
    return null;
  }

  const fullName = entity.full_name || entity.fullName || entity.name || 'Identite KCS';
  const role = entity.role || entity.entityType || 'KCS';
  const primaryId = entity.kcs_card_id || entity.student_id || entity.employee_id || entity.id || 'KCS-ID';
  const secondary = entity.class_name || entity.department || entity.phone || entity.email || 'Kinshasa Christian School';
  const hasLeft = Boolean(entity.left_fingerprint_data || entity.parent_left_fingerprint_data);
  const hasRight = Boolean(entity.right_fingerprint_data || entity.parent_right_fingerprint_data);
  const photo = entity.photo_data || entity.parent_photo_data;

  return (
    <div className="kcs-card rounded-2xl border border-cyan-400/40 bg-slate-950 p-4 text-slate-100 shadow-xl shadow-cyan-950/20">
      <div className="flex items-start justify-between gap-3 border-b border-github-border pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">KCS Identity Card</p>
          <p className="mt-1 text-lg font-bold">{fullName}</p>
        </div>
        <BadgeCheck className="h-7 w-7 text-cyan-300" />
      </div>
      <div className="mt-4 grid grid-cols-[96px_1fr] gap-4">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-github-border bg-slate-900">
          {photo ? <img src={photo} alt={fullName} className="h-full w-full object-cover" /> : <Camera className="h-8 w-8 text-slate-500" />}
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="text-slate-400">Carte:</span> {primaryId}</p>
          <p><span className="text-slate-400">Type:</span> {role}</p>
          <p><span className="text-slate-400">Ref:</span> {secondary}</p>
          <p><span className="text-slate-400">Empreintes:</span> {hasLeft ? 'G' : '-'} / {hasRight ? 'D' : '-'}</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-slate-900/80 px-3 py-2 font-mono text-xs tracking-widest text-cyan-200">{primaryId}</div>
    </div>
  );
};

export const PrintableKcsCard = ({ entity }) => {
  const printCard = () => {
    window.print();
  };

  return (
    <div className="space-y-3">
      <KcsIdCard entity={entity} />
      <button type="button" onClick={printCard} className="inline-flex items-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
        <Printer className="h-4 w-4" />
        Imprimer la carte
      </button>
    </div>
  );
};
