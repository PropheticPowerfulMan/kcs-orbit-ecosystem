export function splitClassName(className?: string | null) {
  const cleanClassName = (className ?? '').trim().replace(/\s+/g, ' ')
  if (!cleanClassName) {
    return { grade: 'Grade 1', section: '' }
  }

  const duplicatedGradeMatch = cleanClassName.match(/^grade\s*(\d{1,2})\s+grade\s*\1$/i)
  if (duplicatedGradeMatch) {
    const gradeNumber = Number(duplicatedGradeMatch[1])
    if (gradeNumber >= 1 && gradeNumber <= 12) return { grade: `Grade ${gradeNumber}`, section: '' }
  }

  const duplicatedGradeWithSectionMatch = cleanClassName.match(/^grade\s*(\d{1,2})\s+grade\s*\1(?:\s+(.+))?$/i)
  if (duplicatedGradeWithSectionMatch) {
    const gradeNumber = Number(duplicatedGradeWithSectionMatch[1])
    if (gradeNumber >= 1 && gradeNumber <= 12) {
      return { grade: `Grade ${gradeNumber}`, section: duplicatedGradeWithSectionMatch[2]?.trim() || '' }
    }
  }

  const compactGradeSectionMatch = cleanClassName.match(/^grade\s*(\d{1,2})\s*[-/]?\s*([a-z])$/i)
  if (compactGradeSectionMatch) {
    const gradeNumber = Number(compactGradeSectionMatch[1])
    if (gradeNumber >= 1 && gradeNumber <= 12) {
      return { grade: `Grade ${gradeNumber}`, section: compactGradeSectionMatch[2].toUpperCase() }
    }
  }

  const gradeWithSectionMatch = cleanClassName.match(/^grade\s*(\d{1,2})(?:\s+(.+))?$/i)
  if (gradeWithSectionMatch) {
    const gradeNumber = Number(gradeWithSectionMatch[1])
    if (gradeNumber >= 1 && gradeNumber <= 12) {
      return { grade: `Grade ${gradeNumber}`, section: gradeWithSectionMatch[2]?.trim() || '' }
    }
  }

  const compactKindergartenSectionMatch = cleanClassName.match(/^k(?:indergarten)?\s*([3-5])\s*[-/]?\s*([a-z])$/i)
  if (compactKindergartenSectionMatch) {
    return { grade: `K${compactKindergartenSectionMatch[1]}`, section: compactKindergartenSectionMatch[2].toUpperCase() }
  }

  const kindergartenWithSectionMatch = cleanClassName.match(/^k(?:indergarten)?\s*([3-5])(?:\s+(.+))?$/i)
  if (kindergartenWithSectionMatch) {
    return { grade: `K${kindergartenWithSectionMatch[1]}`, section: kindergartenWithSectionMatch[2]?.trim() || '' }
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
  const cleanSection = (section ?? '').trim().replace(/\s+/g, ' ')
  if (cleanSection) {
    const normalizedGrade = splitClassName(grade)
    return splitClassName(`${normalizedGrade.grade} ${cleanSection}`)
  }
  return splitClassName(grade)
}

export function resolveSynchronizedStudentClass(
  incomingClassName?: string | null,
  existing?: { grade: string; section?: string | null } | null,
) {
  if (!incomingClassName?.trim()) return existing ? normalizeClassParts(existing.grade, existing.section) : null
  const incoming = splitClassName(incomingClassName)
  if (!existing) return incoming
  const current = normalizeClassParts(existing.grade, existing.section)
  if (
    current.section
    && !incoming.section
    && current.grade.toLowerCase() === incoming.grade.toLowerCase()
  ) {
    return current
  }
  return incoming
}

export function classAssignmentsOverlap(
  left: { grade?: string | null; section?: string | null },
  right: { grade?: string | null; section?: string | null },
) {
  const leftClass = normalizeClassParts(left.grade, left.section)
  const rightClass = normalizeClassParts(right.grade, right.section)
  return leftClass.grade.toLowerCase() === rightClass.grade.toLowerCase()
    && (!leftClass.section || !rightClass.section || leftClass.section.toLowerCase() === rightClass.section.toLowerCase())
}

export function formatClassName(grade?: string | null, section?: string | null) {
  const normalized = normalizeClassParts(grade, section)
  return [normalized.grade, normalized.section].filter(Boolean).join(' ')
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
