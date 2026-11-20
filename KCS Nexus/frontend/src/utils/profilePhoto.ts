export const MAX_PHOTO_SOURCE_BYTES = 10 * 1024 * 1024
export const MAX_PHOTO_BYTES = 200 * 1024
export class ProfilePhotoError extends Error {
  constructor(public code: 'FORMAT' | 'SIZE' | 'DECODE' | 'CANVAS') { super(code) }
}
export function profilePhotoError(error: unknown, language: string) {
  const code = error instanceof ProfilePhotoError ? error.code : 'DECODE'
  const messages = { FORMAT: ['Choisissez une photo JPG, PNG ou WebP.', 'Choose a JPG, PNG or WebP photograph.'], SIZE: ['La photo source doit peser 10 Mo maximum.', 'The source photograph must be at most 10 MB.'], DECODE: ['La photo ne peut pas être lue. Choisissez une autre image JPG, PNG ou WebP.', 'This photograph could not be read. Choose another JPG, PNG or WebP image.'], CANVAS: ['La photo n’a pas pu être préparée. Réessayez sans fermer cette fenêtre.', 'The photograph could not be prepared. Retry without closing this window.'] }
  return messages[code][language === 'fr' ? 0 : 1]
}
/** Bounded, orientation-aware browser decoding; the resulting JPEG carries no original EXIF metadata. */
export async function encodeProfilePhoto(source: CanvasImageSource, width: number, height: number): Promise<string> {
  if (!width || !height || width * height > 80_000_000) throw new ProfilePhotoError('DECODE')
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const canvas = document.createElement('canvas'), ratio = Math.min(1, 1024 / Math.max(width, height))
  canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio))
  const context = canvas.getContext('2d')
  if (!context) throw new ProfilePhotoError('CANVAS')
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(source, 0, 0, canvas.width, canvas.height)
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const quality of [.86, .78, .70, .62]) {
      const result = canvas.toDataURL('image/jpeg', quality)
      if (result.startsWith('data:image/jpeg;base64,') && Math.ceil((result.length - 23) * .75) <= MAX_PHOTO_BYTES) return result
    }
    const smaller = document.createElement('canvas'); smaller.width = Math.max(1, Math.round(canvas.width * .8)); smaller.height = Math.max(1, Math.round(canvas.height * .8))
    const smallerContext = smaller.getContext('2d')
    if (!smallerContext) throw new ProfilePhotoError('CANVAS')
    smallerContext.drawImage(canvas, 0, 0, smaller.width, smaller.height)
    canvas.width = smaller.width; canvas.height = smaller.height; context.drawImage(smaller, 0, 0)
  }
  throw new ProfilePhotoError('CANVAS')
}
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new ProfilePhotoError('FORMAT')
  if (file.size > MAX_PHOTO_SOURCE_BYTES) throw new ProfilePhotoError('SIZE')
  const url = URL.createObjectURL(file), image = new Image()
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new ProfilePhotoError('DECODE')); image.src = url })
    return await encodeProfilePhoto(image, image.naturalWidth, image.naturalHeight)
  } finally { image.onload = null; image.onerror = null; URL.revokeObjectURL(url) }
}
