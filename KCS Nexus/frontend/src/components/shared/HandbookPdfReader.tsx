import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl
/** Render locally: the site's anti-framing policy intentionally forbids PDF iframes. */
export default function HandbookPdfReader({ src, initialPage = 1, title, language }: { src: string; initialPage?: number; title: string; language: string }) {
  const fr = language === 'fr', tr = (a: string, b: string) => fr ? a : b
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(initialPage), [zoom, setZoom] = useState(1), [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true), [rendering, setRendering] = useState(false), [error, setError] = useState('')
  const [text, setText] = useState(''), [width, setWidth] = useState(600)
  const host = useRef<HTMLDivElement>(null)
  const [surface, setSurface] = useState<HTMLCanvasElement | null>(null)
  const sequence = useRef(0)
  useEffect(() => {
    const box = host.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(180, Math.floor(entry.contentRect.width - 24))))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let active = true
    setPdf(null); setLoading(true); setError(''); setText(''); setPage(initialPage); setZoom(1)
    const task = getDocument({ url: src, isEvalSupported: false, useWasm: false, useSystemFonts: true })
    task.promise.then(document => { if (active) { setPdf(document); setPage(Math.min(Math.max(1, initialPage), document.numPages)) } }).catch(() => {
      if (active) setError(tr('Le document n’a pas pu être chargé. Réessayez ou utilisez le téléchargement ci-dessus.', 'The document could not be loaded. Retry or use the download link above.'))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; void task.destroy().catch(() => undefined) }
  }, [src, initialPage, retry])
  useEffect(() => {
    if (!pdf || !surface) return
    const current = ++sequence.current
    let stopped = false, renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    setRendering(true); setError(''); setText('')
    void pdf.getPage(page).then(async sheet => {
      if (stopped || current !== sequence.current) return
      const natural = sheet.getViewport({ scale: 1 }), scale = width / natural.width * zoom
      const viewport = sheet.getViewport({ scale }), outputScale = Math.min(window.devicePixelRatio || 1, 2)
      surface.width = Math.floor(viewport.width * outputScale); surface.height = Math.floor(viewport.height * outputScale)
      surface.style.width = `${Math.floor(viewport.width)}px`; surface.style.height = `${Math.floor(viewport.height)}px`
      const context = surface.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      renderTask = sheet.render({ canvasContext: context, canvas: surface, viewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0] })
      await renderTask.promise
      const content = await sheet.getTextContent()
      if (!stopped && current === sequence.current) setText(content.items.map(item => 'str' in item ? item.str : '').join(' '))
    }).catch(reason => {
      if (!stopped && current === sequence.current && reason?.name !== 'RenderingCancelledException') setError(tr('Impossible d’afficher cette page. Réessayez ou téléchargez le PDF.', 'This page could not be displayed. Retry or download the PDF.'))
    }).finally(() => { if (!stopped && current === sequence.current) setRendering(false) })
    return () => { stopped = true; renderTask?.cancel() }
  }, [pdf, surface, page, width, zoom])
  const move = (target: number) => setPage(Math.max(1, Math.min(pdf?.numPages || 1, target)))
  return <div className="handbook-pdf-viewer" data-pdf-reader aria-busy={loading || rendering}>
    <div className="handbook-pdf-toolbar" role="group" aria-label={tr('Commandes du lecteur PDF', 'PDF reader controls')}>
      <button type="button" data-kcs-no-processing="true" disabled={!pdf || page <= 1} onClick={() => move(page - 1)} aria-label={tr('Page précédente', 'Previous page')}><ChevronLeft size={18}/></button>
      <label>{tr('Page', 'Page')} <select aria-label={tr('Choisir une page', 'Choose a page')} disabled={!pdf} value={pdf ? page : ''} onChange={event => move(Number(event.target.value))}>{!pdf && <option value="">—</option>}{pdf && Array.from({ length: pdf.numPages }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select><span> / {pdf?.numPages || '—'}</span></label>
      <button type="button" data-kcs-no-processing="true" disabled={!pdf || page >= pdf.numPages} onClick={() => move(page + 1)} aria-label={tr('Page suivante', 'Next page')}><ChevronRight size={18}/></button>
      <span className="handbook-pdf-toolbar-space"/>
      <button type="button" data-kcs-no-processing="true" disabled={!pdf || zoom <= .75} onClick={() => setZoom(value => Math.max(.75, value - .25))} aria-label={tr('Réduire', 'Zoom out')}><ZoomOut size={17}/></button>
      <output aria-label={tr('Niveau de zoom', 'Zoom level')}>{Math.round(zoom * 100)}%</output>
      <button type="button" data-kcs-no-processing="true" disabled={!pdf || zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + .25))} aria-label={tr('Agrandir', 'Zoom in')}><ZoomIn size={17}/></button>
    </div>
    {(loading || rendering) && <p className="handbook-pdf-status" role="status"><Loader2 size={17} className="animate-spin"/>{tr('Chargement de la page…', 'Loading page…')}</p>}
    {error && <div className="handbook-pdf-error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}><RotateCw size={16}/>{tr('Réessayer', 'Retry')}</button></div>}
    <div ref={host} className="handbook-pdf-sheet" tabIndex={0} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'PageDown' || event.key === 'PageUp') { event.preventDefault(); move(page + (event.key === 'PageDown' ? 1 : -1)) } }} aria-label={`${title} · ${tr('page', 'page')} ${page}`}>
      {pdf && <canvas key={`${src}-${page}-${zoom}-${width}`} ref={setSurface} role="img" aria-label={`${title} · ${tr('page', 'page')} ${page}`} data-pdf-page={page}/>}
    </div>
    {text && <p className="sr-only" data-pdf-page-text>{text}</p>}
  </div>
}
