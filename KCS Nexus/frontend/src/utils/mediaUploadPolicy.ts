export const IMAGE_UPLOAD_LIMIT=10*1024*1024
export const VIDEO_UPLOAD_LIMIT=500*1024*1024
export function mediaUploadLimit(file:Pick<File,'type'>){return file.type.startsWith('video/')?VIDEO_UPLOAD_LIMIT:IMAGE_UPLOAD_LIMIT}
export const mediaUploadLimitMessage=(file:Pick<File,'type'>,language:string)=>file.type.startsWith('video/')?(language==='fr'?'Une vidéo ne peut pas dépasser 500 Mo.':'A video must not exceed 500 MB.'):(language==='fr'?'Une image ne peut pas dépasser 10 Mo.':'An image must not exceed 10 MB.')
