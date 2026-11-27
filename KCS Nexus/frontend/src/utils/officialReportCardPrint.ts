import { seniorAcademicPresentation } from './seniorAcademicPresentation'
import { showOfficialDocument } from './officialDocumentPreview'
import { academicRecordsAPI,academicPortalAPI } from '@/services/api'
type ReportSubject = {
  id: string
  courseId?: string
  percentage: number
  letterGrade: string
  termResults?: Record<string, number | null>
  course: { name: string; code: string; credits?: number; teacherName?: string }
}

// Presentation only. The teacher's saved course title remains unchanged.
export const courseDisplayName = (value?: string | null) => {
  const title = (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
  return title.replace(/(^|[\s'’/-])(\p{L}+)/gu, (_match, separator: string, word: string, offset: number) =>
    separator + (offset > 0 && ['and', 'et'].includes(word) ? word : word[0].toLocaleUpperCase('fr') + word.slice(1)))
}

export const teacherDisplayName = (value?: string | null) => {
  const name = (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
  return name.replace(/(^|[\s'’-])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase('fr'))
}

export type PrintableReportCard = {
  id: string
  term: string
  average: number
  teacherComment?: string | null
  conduct?: string | null
  publicationStatus: string
  attendanceSummary?: {
    total: number
    present: number
    absent: number
    late: number
    excused: number
    sick: number
    suspended: number
    attendanceRate: number | null
  } | null
  subjects?: ReportSubject[]
  student: {
    id?: string
    studentNumber: string
    grade?: string | null
    section?: string | null
    officialAvatar?: string | null
    user: { firstName: string; middleName?: string | null; lastName: string; avatar?: string | null }
  }
}

export async function printOfficialReportCard(card: PrintableReportCard, onBlocked: (message: string) => void, reservedWindow?: Window | null, review?: { teacherComment: string; conduct: string }, presentation?: 'senior') {
  const language = document.documentElement.lang.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const printWindow = reservedWindow ?? window.open('', '_blank', 'width=1100,height=900')
  if (!printWindow) {
    onBlocked(language === 'fr' ? 'Autorisez les fenêtres d’impression puis réessayez.' : 'Allow print windows and try again.')
    return
  }
  try {
    await displayOfficialReportCardDocument(card.id,printWindow,language,onBlocked,{review,presentation})
  } catch {
    printWindow.close()
    onBlocked(language === 'fr' ? 'Impossible de préparer le bulletin officiel. Réessayez.' : 'Unable to prepare the official report card. Please retry.')
  }
}

/** Parents and school leadership share the exact official renderer and preview controls. */
export async function displayOfficialReportCardDocument(id:string,win:Window,language:'fr'|'en',onError:(message:string)=>void,options:{portal?:boolean;review?:{teacherComment:string;conduct:string};presentation?:'senior'}={}){
 const response=options.portal?await academicPortalAPI.reportDocument(id):await academicRecordsAPI.reportCardPrintDocument(id,language,options.review)
 const document=response.data.data,html=document.html as string
 if(!html.startsWith('<!doctype html>'))throw Error('Invalid official report document')
 await showOfficialDocument(win,options.presentation==='senior'?seniorAcademicPresentation(html):html,{filename:document.filename||`KCS-report-card-${id}`,language,onError,autoPrint:!options.portal})
}
