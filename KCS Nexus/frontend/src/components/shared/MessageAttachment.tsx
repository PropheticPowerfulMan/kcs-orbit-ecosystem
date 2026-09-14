import { useEffect, useState } from 'react'
import { Download, FileAudio, FileVideo, Image as ImageIcon, Loader2, Paperclip, Play, X } from 'lucide-react'
import { messagesAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

export type MessageWithAttachment = { id: string; attachmentName?: string | null; attachmentMime?: string | null; attachmentSize?: number | null; hasAttachment?: boolean }
const isIncompleteMp4=async(blob:Blob)=>{if(!blob.type.includes("mp4"))return false;const header=new Uint8Array(await blob.slice(0,64).arrayBuffer());const signature=Array.from(header,(byte)=>String.fromCharCode(byte)).join("");return !signature.includes("ftyp")}
const readableSize = (size?: number | null) => !size ? '' : size < 1048576 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1048576).toFixed(1)} MB`

export default function MessageAttachment({ message, compact = false }: { message: MessageWithAttachment; compact?: boolean }) {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const mime = message.attachmentMime || ''
  const isAudio = mime.startsWith('audio/')
  const isVideo = mime.startsWith('video/')
  const isImage = mime.startsWith('image/')
  const previewable = isAudio || isVideo || isImage
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (!message.hasAttachment && !message.attachmentName) return null
  const load = async () => {
    if (url) return url
    setLoading(true); setError('')
    try { const response = await messagesAPI.attachment(message.id); const mediaBlob = response.data as Blob; if (isAudio && await isIncompleteMp4(mediaBlob)) { setError(tr('Cet ancien enregistrement audio est incomplet et ne peut pas être décodé. Veuillez demander un nouvel enregistrement.', 'This older audio recording is incomplete and cannot be decoded. Please request a new recording.')); return '' } const nextUrl = URL.createObjectURL(mediaBlob); setUrl(nextUrl); return nextUrl }
    catch (reason: any) { setError(reason?.response?.data?.message || tr('Média indisponible.', 'Media unavailable.')); return '' }
    finally { setLoading(false) }
  }
  const download = async () => { const target = url || await load(); if (!target) return; const anchor = document.createElement('a'); anchor.href = target; anchor.download = message.attachmentName || 'attachment'; anchor.click() }
  const Icon = isAudio ? FileAudio : isVideo ? FileVideo : isImage ? ImageIcon : Paperclip
  return <div className={`mt-3 overflow-hidden rounded-xl border border-kcs-blue-100 bg-white/80 dark:border-kcs-blue-700 dark:bg-kcs-blue-950/70 ${compact ? 'p-2' : 'p-3'}`}>
    <div className="flex min-w-0 items-center gap-3"><Icon size={20} className="shrink-0 text-kcs-blue-600 dark:text-sky-300"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold dark:text-white">{message.attachmentName}</p><p className="text-xs text-gray-500 dark:text-gray-300">{isAudio ? tr('Message audio', 'Audio message') : isVideo ? tr('Message vidéo', 'Video message') : tr('Pièce jointe', 'Attachment')} {readableSize(message.attachmentSize) && `- ${readableSize(message.attachmentSize)}`}</p></div>
      {previewable && !url && <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg bg-kcs-blue-700 p-2 text-white" aria-label={tr('Lire le média', 'Play media')}>{loading ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>}</button>}
      {url && <button type="button" onClick={() => { URL.revokeObjectURL(url); setUrl('') }} className="rounded-lg border p-2 dark:border-kcs-blue-700" aria-label={tr('Fermer', 'Close')}><X size={16}/></button>}
      <button type="button" onClick={() => void download()} className="rounded-lg border p-2 dark:border-kcs-blue-700" aria-label={tr('Télécharger', 'Download')}><Download size={16}/></button></div>
    {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    {url && isAudio && <audio className="mt-3 w-full" controls autoPlay preload="auto" src={url} onError={() => setError(tr("Lecture audio impossible sur ce navigateur.", "Audio playback is unavailable in this browser."))}/>}
    {url && isVideo && <video className="mt-3 max-h-[55vh] w-full rounded-lg bg-black object-contain" controls playsInline preload="metadata" src={url}/>}
    {url && isImage && <img className="mt-3 max-h-[55vh] w-full rounded-lg object-contain" src={url} alt={message.attachmentName || tr('Image jointe', 'Attached image')}/>}
  </div>
}
