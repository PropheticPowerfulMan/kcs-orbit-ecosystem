import { showOfficialDocument } from './officialDocumentPreview'
import { academicRecordsAPI } from '@/services/api'
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

export async function printOfficialReportCard(card: PrintableReportCard, onBlocked: (message: string) => void, reservedWindow?: Window | null, review?: { teacherComment: string; conduct: string }) {
  const language = document.documentElement.lang.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const printWindow = reservedWindow ?? window.open('', '_blank', 'width=1100,height=900')
  if (!printWindow) {
    onBlocked(language === 'fr' ? 'Autorisez les fenêtres d’impression puis réessayez.' : 'Allow print windows and try again.')
    return
  }
  try {
    const response = await academicRecordsAPI.reportCardPrintDocument(card.id, language, review)
    // Only trusted, server-generated report HTML is accepted. All personal fields are escaped there.
    const html = response.data.data.html as string
    if (!html.startsWith('<!doctype html>')) throw new Error('Invalid official report document')
    await showOfficialDocument(printWindow, html, { filename: `KCS-report-card-${card.id}`, language, onError: onBlocked })
  } catch {
    printWindow.close()
    onBlocked(language === 'fr' ? 'Impossible de préparer le bulletin officiel. Réessayez.' : 'Unable to prepare the official report card. Please retry.')
  }
}
