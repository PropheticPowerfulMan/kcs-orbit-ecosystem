import type { Response } from 'express'
import { ApiError } from './api.js'

const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/ogg','audio/webm','audio/wav','audio/x-wav','video/mp4','video/webm','video/quicktime','video/ogg','application/pdf','text/plain'])
export const validateForumMedia = (data?: string | null, type?: string | null, name?: string | null) => {
  if (!data) return { attachmentData: null, attachmentType: null, attachmentName: null }
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(data)
  if (!match || !allowed.has(match[1])) throw new ApiError(400, 'Unsupported or invalid forum attachment')
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > 8_388_608) throw new ApiError(400, 'Forum attachments must be 8 MB or less')
  const family = match[1].split('/')[0]
  if (type && ![family, 'document'].includes(type)) throw new ApiError(400, 'Attachment type does not match the uploaded file')
  return { attachmentData: data, attachmentType: family === 'application' || family === 'text' ? 'document' : family, attachmentName: (name || 'attachment').slice(0,255) }
}
export const lightweightForumRecord = <T extends Record<string, any>>(record: T) => {
  const { attachmentData: _attachmentData, comments, ...rest } = record
  return { ...rest, hasAttachment: Boolean(record.attachmentData), ...(comments ? { comments: comments.map((item: Record<string, any>) => { const { attachmentData: _data, ...comment } = item; return { ...comment, hasAttachment: Boolean(item.attachmentData) } }) } : {}) }
}
export const sendForumMedia = (res: Response, record: { attachmentData?: string | null; attachmentName?: string | null }) => {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(record.attachmentData || '')
  if (!match) throw new ApiError(404, 'Forum attachment not found')
  const data = Buffer.from(match[2], 'base64')
  res.setHeader('Content-Type', match[1])
  res.setHeader('Content-Length', String(data.length))
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(record.attachmentName || 'attachment')}`)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.send(data)
}
