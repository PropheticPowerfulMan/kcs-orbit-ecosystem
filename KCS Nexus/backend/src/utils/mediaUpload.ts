import path from 'node:path'

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024

const allowedMedia = new Map([
  ['.gif', { mime: 'image/gif', signatures: [[0x47, 0x49, 0x46, 0x38]] }],
  ['.jpg', { mime: 'image/jpeg', signatures: [[0xff, 0xd8, 0xff]] }],
  ['.jpeg', { mime: 'image/jpeg', signatures: [[0xff, 0xd8, 0xff]] }],
  ['.png', { mime: 'image/png', signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] }],
  ['.webp', { mime: 'image/webp', signatures: [[0x52, 0x49, 0x46, 0x46]] }],
  ['.mp4', { mime: 'video/mp4', signatures: [[0x66, 0x74, 0x79, 0x70]] }],
  ['.webm', { mime: 'video/webm', signatures: [[0x1a, 0x45, 0xdf, 0xa3]] }],
] as const)

function hasSignature(buffer: Buffer, signature: readonly number[], offset = 0) {
  return signature.every((byte, index) => buffer[index + offset] === byte)
}

export function validateMediaUpload(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase()
  const rule = allowedMedia.get(extension as keyof typeof allowedMedia)
  if (!rule || rule.mime !== file.mimetype) return false
  if (extension === '.webp') {
    return hasSignature(file.buffer, rule.signatures[0]) && file.buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  if (extension === '.mp4') return hasSignature(file.buffer, rule.signatures[0], 4)
  return rule.signatures.some((signature) => hasSignature(file.buffer, signature))
}

export function safeMediaFilename(originalName: string) {
  const extension = path.extname(originalName).toLowerCase()
  const base = path.basename(originalName, extension)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'media'
  return `${Date.now()}-${base}${extension}`
}