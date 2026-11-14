import { api } from '@/services/api'

type PreviewOptions = { filename: string; language?: 'fr' | 'en'; autoPrint?: boolean; onError?: (message: string) => void; onClose?: () => void }
const fileName = (value: string) => (value.replace(/[\u0000-\u001f\u007f/\\<>:"|?*]/g, '-').replace(/\.pdf$/i, '').trim().slice(0, 140) || 'KCS-document') + '.pdf'
const imageData = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Image unavailable')); reader.readAsDataURL(blob)
})

/** Snapshot the displayed document, excluding preview controls. Never reads another learner's record. */
export async function downloadableDocumentHtml(doc: Document) {
  const copy = doc.documentElement.cloneNode(true) as HTMLElement
  copy.querySelectorAll('[data-kcs-document-controls],script,iframe,object,embed,base,form,link').forEach(node => node.remove())
  for (const node of Array.from(copy.querySelectorAll('*'))) for (const attribute of Array.from(node.attributes)) {
    if (/^on/i.test(attribute.name) || /^(?:srcset|integrity|crossorigin)$/i.test(attribute.name)) node.removeAttribute(attribute.name)
  }
  const images = Array.from(copy.querySelectorAll('img'))
  const embedded = new Map<string, Promise<string>>()
  await Promise.all(images.map(async image => {
    const source = image.getAttribute('src') || ''
    if (source.startsWith('data:image/')) return
    const url = new URL(source, doc.baseURI)
    if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) throw new Error('Document image unavailable')
    if (!embedded.has(url.href)) embedded.set(url.href, fetch(url.href, { credentials: 'same-origin', signal: AbortSignal.timeout(15_000) }).then(async response => {
      if (!response.ok) throw new Error('Document image unavailable')
      const blob = await response.blob()
      if (!blob.type.startsWith('image/') || blob.size > 3 * 1024 * 1024) throw new Error('Invalid document image')
      return imageData(blob)
    }))
    image.setAttribute('src', await embedded.get(url.href)!)
  }))
  return '<!doctype html>' + copy.outerHTML
}

/** Shared, parent-owned controls: print remains available, download creates a real PDF. */
export async function showOfficialDocument(win: Window, html: string, options: PreviewOptions) {
  if (win.closed) return
  const fr = (options.language || document.documentElement.lang).toLowerCase().startsWith('fr')
  const tr = (a: string, b: string) => fr ? a : b
  // Older generators included inline print scripts; controls now own the print lifecycle.
  const cleaned = html.replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|<\\\/script\s*>)/gi, '')
  win.document.open(); win.document.write(cleaned); win.document.close()
  const style = win.document.createElement('style')
  style.dataset.kcsDocumentControls = ''
  style.textContent = '[data-kcs-document-controls]{box-sizing:border-box!important;position:sticky;top:0;z-index:9999;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;padding:12px;background:#073b70;color:white;font:14px Arial,sans-serif;box-shadow:0 3px 12px #10284933}[data-kcs-document-controls] button{border:1px solid #aac8e0;border-radius:9px;padding:10px 18px;background:#e9f5fc;color:#073b70;font:700 14px Arial,sans-serif;cursor:pointer}[data-kcs-document-controls] button[data-download]{background:#b9f4e4;border-color:#75dcc0;color:#064b46}[data-kcs-document-controls] button:disabled{opacity:.65;cursor:wait}[data-kcs-document-controls] [role=status]{flex-basis:100%;text-align:center;font-size:13px}[data-kcs-document-controls] [role=status]:empty{display:none}@media print{[data-kcs-document-controls]{display:none!important}}'
  win.document.head.append(style)
  const toolbar = win.document.createElement('nav'); toolbar.dataset.kcsDocumentControls = ''; toolbar.setAttribute('aria-label', tr('Actions du document', 'Document actions'))
  const button = (label: string, action: () => void) => { const b = win.document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', action); return b }
  const status = win.document.createElement('span'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
  const print = () => { if (!win.closed) { win.focus(); win.print() } }
  const label = tr('Télécharger le PDF', 'Download PDF')
  const download = button(label, () => { void (async () => {
    if (download.disabled) return
    download.disabled = true; download.setAttribute('aria-busy', 'true'); download.textContent = tr('Préparation…', 'Preparing…'); status.textContent = ''
    try {
      const snapshot = await downloadableDocumentHtml(win.document)
      const response = await api.post('/documents/pdf', { html: snapshot, filename: fileName(options.filename) }, { responseType: 'blob', timeout: 75_000, headers: { 'x-silent-feedback': 'true' } })
      const pdf = response.data as Blob
      if (!(pdf instanceof Blob) || await pdf.slice(0, 5).text() !== '%PDF-') throw new Error('Invalid PDF')
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
      const anchor = win.document.createElement('a'); anchor.href = url; anchor.download = fileName(options.filename); win.document.body.append(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      status.textContent = tr('Le fichier PDF a été préparé pour le téléchargement.', 'The PDF file is ready for download.')
    } catch {
      const message = tr('Téléchargement indisponible. Vérifiez votre connexion puis réessayez. L’aperçu reste disponible.', 'Download unavailable. Check your connection and retry. The preview remains available.')
      status.textContent = message; options.onError?.(message)
    } finally { download.disabled = false; download.removeAttribute('aria-busy'); download.textContent = label }
  })() })
  download.dataset.download = ''
  toolbar.append(button(tr('Imprimer / Enregistrer en PDF', 'Print / Save PDF'), print), download, button(tr('Fermer', 'Close'), () => options.onClose ? options.onClose() : win.close()), status)
  win.document.body.prepend(toolbar)
  const loaded = Array.from(win.document.images).map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }) }))
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([Promise.all([win.document.fonts.ready, ...loaded]), new Promise<void>(resolve => { timer = setTimeout(resolve, 4000) })]); if (timer) clearTimeout(timer)
  if (options.autoPrint !== false) print()
}
