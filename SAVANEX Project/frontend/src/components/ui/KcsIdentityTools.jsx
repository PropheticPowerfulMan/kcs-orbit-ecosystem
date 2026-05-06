import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, Cpu, Fingerprint, Printer, Upload, Usb, X } from 'lucide-react';

const inputClass = 'w-full rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-kcs-blue';
const schoolLogo = `${import.meta.env.BASE_URL}kcs.jpg`;

const encodeBiometricTemplate = (payload) => {
  const encoded = window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return `KCS-BIO:${encoded}`;
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
  const [biometricMessage, setBiometricMessage] = useState('');
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

  const captureFingerprint = async (side) => {
    setBiometricMessage('Connexion au lecteur biométrique...');

    try {
      if (window.KcsBiometric?.captureFingerprint) {
        const template = await window.KcsBiometric.captureFingerprint({ side, subjectName });
        update({ [`${side}_fingerprint_data`]: encodeBiometricTemplate({ side, subjectName, source: 'vendor-sdk', template, capturedAt: new Date().toISOString() }) });
        setBiometricMessage(`Empreinte ${side === 'left' ? 'gauche' : 'droite'} capturee par le SDK du lecteur.`);
        return;
      }

      if (navigator.usb?.requestDevice) {
        const device = await navigator.usb.requestDevice({ filters: [] });
        const product = [device.manufacturerName, device.productName].filter(Boolean).join(' ') || 'Lecteur USB';
        update({
          [`${side}_fingerprint_data`]: encodeBiometricTemplate({
            side,
            subjectName,
            source: 'webusb-device',
            device: {
              product,
              vendorId: device.vendorId,
              productId: device.productId,
            },
            status: 'reader-linked-template-pending',
            capturedAt: new Date().toISOString(),
          }),
        });
        setBiometricMessage(`${product} relié. Installez ou activez le SDK du lecteur pour enregistrer le gabarit biométrique complet.`);
        return;
      }

      if (navigator.serial?.requestPort) {
        const port = await navigator.serial.requestPort();
        const info = port.getInfo?.() || {};
        update({
          [`${side}_fingerprint_data`]: encodeBiometricTemplate({
            side,
            subjectName,
            source: 'webserial-device',
            device: info,
            status: 'reader-linked-template-pending',
            capturedAt: new Date().toISOString(),
          }),
        });
        setBiometricMessage('Lecteur série relié. Installez ou activez le SDK du lecteur pour enregistrer le gabarit biométrique complet.');
        return;
      }

      setBiometricMessage("Aucun pont biométrique disponible. Utilisez Chrome/Edge avec WebUSB/Web Serial ou installez le SDK du lecteur.");
    } catch (error) {
      if (error?.name === 'NotFoundError') {
        setBiometricMessage('Aucun lecteur sélectionné.');
        return;
      }
      setBiometricMessage("Impossible de connecter le lecteur biométrique. Vérifiez le périphérique et son pilote.");
    }
  };

  const biometricStatus = (rawValue) => {
    if (!rawValue) return 'Vide';
    if (String(rawValue).startsWith('KCS-BIO:')) return 'Lecteur relie';
    return 'Ancienne donnee';
  };

  return (
    <div className={compact ? 'space-y-3' : 'rounded-2xl border border-github-border bg-slate-950/35 p-4'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Photo et biométrie KCS</p>
          <p className="mt-1 text-xs text-slate-400">Photo d'identité, capture caméra et liaison avec le lecteur biométrique.</p>
        </div>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
          {value?.photo_data ? 'Photo prête' : 'Photo vide'}
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
            <button type="button" onClick={() => captureFingerprint('left')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
              <Usb className="h-4 w-4" />
              Lecteur gauche
            </button>
            <button type="button" onClick={() => captureFingerprint('right')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
              <Usb className="h-4 w-4" />
              Lecteur droite
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100">
              <p className="text-xs text-slate-400">Empreinte gauche</p>
              <p className="mt-1 flex items-center gap-2"><Fingerprint className="h-4 w-4 text-cyan-300" /> {biometricStatus(value?.left_fingerprint_data)}</p>
            </div>
            <div className="rounded-xl border border-github-border bg-slate-950/70 px-4 py-3 text-sm text-slate-100">
              <p className="text-xs text-slate-400">Empreinte droite</p>
              <p className="mt-1 flex items-center gap-2"><Fingerprint className="h-4 w-4 text-cyan-300" /> {biometricStatus(value?.right_fingerprint_data)}</p>
            </div>
          </div>
          {biometricMessage ? <p className="text-xs text-cyan-200">{biometricMessage}</p> : null}
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
  const functionalId = entity.student_id || entity.employee_id || entity.teacher_id || entity.id || primaryId;
  const secondary = entity.class_name || entity.department || entity.job_title || entity.phone || entity.email || 'Kinshasa Christian School';
  const hasLeft = Boolean(entity.left_fingerprint_data || entity.parent_left_fingerprint_data);
  const hasRight = Boolean(entity.right_fingerprint_data || entity.parent_right_fingerprint_data);
  const photo = entity.photo_data || entity.parent_photo_data;
  const issuedAt = new Date().getFullYear();

  return (
    <div className="kcs-card kcs-biometric-card text-slate-950">
      <div className="kcs-card-header">
        <img src={schoolLogo} alt="Kinshasa Christian School" className="kcs-card-logo" />
        <div className="min-w-0">
          <p className="kcs-card-school">KINSHASA CHRISTIAN SCHOOL</p>
          <p className="kcs-card-subtitle">Carte biométrique officielle</p>
        </div>
        <BadgeCheck className="kcs-card-check" />
      </div>

      <div className="kcs-card-body">
        <div className="kcs-card-photo">
          {photo ? <img src={photo} alt={fullName} /> : <Camera className="h-8 w-8 text-slate-500" />}
        </div>
        <div className="kcs-card-identity">
          <p className="kcs-card-name">{fullName}</p>
          <p className="kcs-card-role">{role}</p>
          <div className="kcs-card-fields">
            <p><span>ID:</span> {functionalId}</p>
            <p><span>Carte:</span> {primaryId}</p>
            <p><span>Ref:</span> {secondary}</p>
          </div>
        </div>
      </div>

      <div className="kcs-card-footer">
        <div className="kcs-card-chip"><Cpu className="h-4 w-4" /></div>
        <div className="kcs-card-barcode" aria-hidden="true">
          {Array.from({ length: 22 }).map((_, index) => (
            <span key={`bar-${index}`} style={{ height: `${index % 3 === 0 ? 18 : index % 2 === 0 ? 13 : 9}px` }} />
          ))}
        </div>
        <div className="kcs-card-bio">
          <Fingerprint className={hasLeft ? 'text-emerald-700' : 'text-slate-400'} />
          <Fingerprint className={hasRight ? 'text-emerald-700' : 'text-slate-400'} />
          <span>{issuedAt}</span>
        </div>
      </div>
    </div>
  );
};

export const PrintableKcsCard = ({ entity }) => {
  const printCard = () => {
    window.print();
  };

  return (
    <div className="space-y-3">
      <div className="kcs-print-sheet">
        <KcsIdCard entity={entity} />
      </div>
      <button type="button" onClick={printCard} className="inline-flex items-center gap-2 rounded-xl border border-github-border px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60">
        <Printer className="h-4 w-4" />
        Imprimer la carte
      </button>
    </div>
  );
};
