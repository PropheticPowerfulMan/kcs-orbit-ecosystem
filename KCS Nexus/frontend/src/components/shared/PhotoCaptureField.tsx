import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Loader2, UserRound } from 'lucide-react'
import { encodeProfilePhoto, prepareProfilePhoto, profilePhotoError } from '@/utils/profilePhoto'
import { useUIStore } from '@/store/uiStore'
import { usePhotoPreparationStore } from '@/store/photoPreparationStore'

type Props = { label: string; value: string; onChange: (value: string) => void; onError: (message: string) => void; disabled?: boolean }
export default function PhotoCaptureField({ label, value, onChange, onError, disabled = false }: Props) {
  const language = useUIStore(s => s.language), tr = (fr: string, en: string) => language === 'fr' ? fr : en, id = useId()
  const setPending = usePhotoPreparationStore(s => s.setPending)
  const [open, setOpen] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false)
  const video = useRef<HTMLVideoElement | null>(null), stream = useRef<MediaStream | null>(null), sequence = useRef(0)
  useEffect(() => () => { sequence.current++; setPending(id, false); stream.current?.getTracks().forEach(track => track.stop()) }, [id, setPending])
  useEffect(() => { setPending(id, busy || open); return () => setPending(id, false) }, [id, busy, open, setPending])
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(''); setReady(false)
    if (!navigator.mediaDevices?.getUserMedia) { setError(tr('Caméra indisponible. Importez une photo depuis cet appareil.', 'Camera unavailable. Import a photograph from this device.')); return }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(media => {
      if (cancelled) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media; if (video.current) video.current.srcObject = media
    }).catch(() => { if (!cancelled) setError(tr('Caméra indisponible. Vérifiez les permissions ou importez une photo.', 'Camera unavailable. Check permissions or import a photograph.')) })
    return () => { cancelled = true; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null }
  }, [open, language])
  const prepare = async (operation: () => Promise<string>, close = false) => {
    if (disabled || busy) return
    const request = ++sequence.current
    setBusy(true); setPending(id, true); setError('')
    try { const result = await operation(); if (sequence.current === request) { onChange(result); if (close) setOpen(false) } }
    catch (reason) { if (sequence.current === request) { const message = profilePhotoError(reason, language); setError(message); onError(message) } }
    finally { if (sequence.current === request) { setBusy(false) } }
  }
  return <div data-photo-capture data-photo-preparing={busy || undefined} className="rounded-xl border border-kcs-blue-100 bg-white/80 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-950/50">
    <div className="flex min-w-0 items-start gap-4"><div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-kcs-blue-300">{value ? <img src={value} alt={label} className="h-full w-full object-cover"/> : <UserRound className="text-kcs-blue-300"/>}</div>
      <div className="min-w-0"><p className="text-sm font-bold dark:text-white">{label}</p><p className="text-xs text-gray-500 dark:text-gray-300">{tr('JPG, PNG ou WebP · source ≤ 10 Mo · photo optimisée ≤ 200 Ko', 'JPG, PNG or WebP · source ≤ 10 MB · optimized photo ≤ 200 KB')}</p><div className="mt-2 flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white">{tr('Importer', 'Import')}<input type="file" disabled={busy || disabled} accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void prepare(() => prepareProfilePhoto(file)) }}/></label>
        <button type="button" disabled={busy || disabled} onClick={() => { setPending(id, true); setOpen(true) }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold text-kcs-blue-700 dark:text-kcs-blue-200"><Camera size={14}/>{tr('Caméra', 'Camera')}</button>
        {value && <button type="button" disabled={busy || disabled} onClick={() => onChange('')} className="text-xs font-bold text-red-600">{tr('Retirer', 'Remove')}</button>}
      </div>{busy && <p role="status" className="mt-2 flex items-center gap-2 text-xs dark:text-sky-100"><Loader2 size={14} className="animate-spin"/>{tr('Préparation de la photo… Attendez avant d’enregistrer.', 'Preparing the photograph… Please wait before saving.')}</p>}{error && !open && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}</div>
    </div>
    {open && createPortal(<div className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={label}><section className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white p-5 dark:bg-kcs-blue-950"><h3 className="font-bold dark:text-white">{label}</h3><video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(Boolean(video.current?.videoWidth && video.current.readyState >= 2))} className="mt-4 min-h-0 w-full flex-1 rounded-xl bg-black object-contain"/>{error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}<div className="mt-4 flex shrink-0 justify-center gap-3"><button type="button" disabled={busy || disabled} onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 dark:text-white">{tr('Annuler', 'Cancel')}</button><button type="button" disabled={!ready || busy} onClick={() => { const source = video.current; if (source?.videoWidth && source.readyState >= 2) void prepare(() => encodeProfilePhoto(source, source.videoWidth, source.videoHeight), true) }} className="rounded-xl bg-kcs-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? tr('Préparation…', 'Preparing…') : tr('Capturer', 'Capture')}</button></div></section></div>, document.body)}
  </div>
}
