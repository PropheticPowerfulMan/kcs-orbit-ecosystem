export function splitClassName(className?: string | null) {
  const cleanClassName = (className ?? '').trim().replace(/\s+/g, ' ')
  if (!cleanClassName) {
    return { grade: 'Grade 1', section: '' }
  }

  const sectionMatch = cleanClassName.match(/^(.*?)(?:\s+([A-Z]))?$/)
  const rawGrade = sectionMatch?.[1]?.trim() || cleanClassName
  const section = sectionMatch?.[2] || ''
  const kindergartenMatch = rawGrade.match(/^(?:(?:kindergarten\s+)(?:k|grade)\s*|k(?:indergarten)?\s*)([3-5])$/i)
  if (kindergartenMatch) {
    return { grade: `K${kindergartenMatch[1]}`, section }
  }

  const ordinalGradeMatch = rawGrade.match(/^(\d{1,2})(?:st|nd|rd|th)\s+grade$/i)
  if (ordinalGradeMatch) {
    const gradeNumber = Number(ordinalGradeMatch[1])
    if (gradeNumber >= 1 && gradeNumber <= 12) {
      return { grade: `Grade ${gradeNumber}`, section }
    }
  }

  const gradeMatch = rawGrade.match(/^grade\s*(\d{1,2})(?:\s+grade\s*\1)?$/i)
  if (gradeMatch) {
    return { grade: `Grade ${Number(gradeMatch[1])}`, section }
  }

  return { grade: rawGrade, section }
}

export function normalizeClassParts(grade?: string | null, section?: string | null) {
  return splitClassName([grade, section].filter((value) => Boolean(value?.trim())).join(' '))
}

function classRank(grade: string) {
  const kindergartenMatch = grade.match(/^K([3-5])$/i)
  if (kindergartenMatch) return Number(kindergartenMatch[1]) - 3

  const gradeMatch = grade.match(/^Grade\s*(1[0-2]|[1-9])$/i)
  if (gradeMatch) return Number(gradeMatch[1]) + 2

  return Number.MAX_SAFE_INTEGER
}

export function compareClassParts(
  left: { grade: string; section: string },
  right: { grade: string; section: string },
) {
  const leftClass = normalizeClassParts(left.grade, left.section)
  const rightClass = normalizeClassParts(right.grade, right.section)
  const rankDifference = classRank(leftClass.grade) - classRank(rightClass.grade)
  if (rankDifference) return rankDifference

  const gradeDifference = leftClass.grade.localeCompare(rightClass.grade, 'en', { numeric: true })
  if (gradeDifference) return gradeDifference
  return leftClass.section.localeCompare(rightClass.section, 'en', { numeric: true })
}
