export function splitClassName(className?: string | null) {
  const cleanClassName = (className ?? '').trim().replace(/\s+/g, ' ')
  if (!cleanClassName) {
    return { grade: 'Grade 1', section: '' }
  }

  const sectionMatch = cleanClassName.match(/^(.*?)(?:\s+([A-Z]))?$/)
  const rawGrade = sectionMatch?.[1]?.trim() || cleanClassName
  const section = sectionMatch?.[2] || ''
  const kindergartenMatch = rawGrade.match(/^(?:kindergarten\s+)?k(?:indergarten)?\s*([3-5])$/i)
  if (kindergartenMatch) {
    return { grade: `K${kindergartenMatch[1]}`, section }
  }

  const gradeMatch = rawGrade.match(/^grade\s*(\d{1,2})(?:\s+grade\s*\1)?$/i)
  if (gradeMatch) {
    return { grade: `Grade ${Number(gradeMatch[1])}`, section }
  }

  return { grade: rawGrade, section }
}
