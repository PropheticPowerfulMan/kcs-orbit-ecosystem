import { Router } from 'express'
import { z } from 'zod'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../utils/api.js'
import { renderOfficialPdf } from '../services/reportPdfRenderer.service.js'

const MAX_SNAPSHOT_BYTES = 6 * 1024 * 1024
const snapshotSchema = z.object({ html: z.string().min(40).max(MAX_SNAPSHOT_BYTES), filename: z.string().min(1).max(180) }).strict()

export function pdfSnapshot(input: unknown) {
  const data = snapshotSchema.parse(input)
  // Format conversion only: no record lookup, approval, publication or authenticity issuance.
  // The isolated renderer disables JavaScript and blocks ALL network/file requests as a second boundary.
  if (Buffer.byteLength(data.html, 'utf8') > MAX_SNAPSHOT_BYTES) throw new ApiError(413, 'Document exceeds the PDF size limit')
  if (!/^<!doctype html>/i.test(data.html) || /<(?:script|iframe|object|embed|base|form|link)\b|\son\w+\s*=|javascript\s*:|@import\b|http-equiv\s*=/i.test(data.html)) throw new ApiError(400, 'Only a static document snapshot is accepted')
  const urls = [...data.html.matchAll(/\b(?:src|href|poster|srcset)\s*=\s*["']([^"']*)["']/gi)]
  if (urls.some(([, value]) => !/^(?:data:image\/(?:png|jpe?g|webp|svg\+xml|gif);|#|https?:\/\/)/i.test(value))) throw new ApiError(400, 'Invalid document resource')
  // External links remain clickable. Images/styles must already be self-contained.
  if (/<(?:img|image)\b[^>]*(?:src|href)\s*=\s*["'](?!data:image\/)/i.test(data.html) || [...data.html.matchAll(/url\(\s*(?:["']([^"']*)["']|([^\s)]+))\s*\)/gi)].some(([, quoted, bare]) => !/^(?:data:|#)/i.test(quoted ?? bare))) throw new ApiError(400, 'Document images and styles must be embedded')
  const filename = data.filename.replace(/[\x00-\x1f\x7f/\\<>:"|?*]/g, '-').replace(/\.pdf$/i, '').trim().slice(0, 140) || 'KCS-document'
  return { html: data.html, filename: filename + '.pdf' }
}

export function createDocumentDownloadHandler(render = renderOfficialPdf) {
  const activeUsers = new Set<string>()
  return asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user?.sub) throw new ApiError(401, 'Authentication required')
    const { html, filename } = pdfSnapshot(req.body)
    if (activeUsers.has(req.user.sub) || activeUsers.size >= 4) throw new ApiError(429, 'A PDF is being prepared. Please retry shortly.')
    activeUsers.add(req.user.sub)
    try {
      const pdf = await render(html)
      if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new ApiError(503, 'PDF service returned an invalid document')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="KCS-document.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`)
      res.setHeader('Cache-Control', 'no-store, private')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.send(pdf)
    } finally { activeUsers.delete(req.user.sub) }
  })
}

export const documentDownloadRouter = Router()
documentDownloadRouter.use(authenticate)
documentDownloadRouter.post('/pdf', createDocumentDownloadHandler())
