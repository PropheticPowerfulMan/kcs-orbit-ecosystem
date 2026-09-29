const normalizeClassPart = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ')

export const splitClassLabel = (value: unknown) => {
  const clean = normalizeClassPart(value)
  if (!clean) return { grade: '', section: '' }

  const duplicatedGrade = clean.match(/^grade\s*(1[0-2]|[1-9])\s+grade\s*\1(?:\s+(.+))?$/i)
  if (duplicatedGrade) return { grade: `Grade ${Number(duplicatedGrade[1])}`, section: normalizeClassPart(duplicatedGrade[2]) }

  const numberedGrade = clean.match(/^grade\s*(1[0-2]|[1-9])(?:\s+(.+))?$/i)
  if (numberedGrade) return { grade: `Grade ${Number(numberedGrade[1])}`, section: normalizeClassPart(numberedGrade[2]) }

  const ordinalGrade = clean.match(/^(1[0-2]|[1-9])(?:st|nd|rd|th)\s+grade(?:\s+(.+))?$/i)
  if (ordinalGrade) return { grade: `Grade ${Number(ordinalGrade[1])}`, section: normalizeClassPart(ordinalGrade[2]) }

  const kindergartenGrade = clean.match(/^kindergarten\s+(?:k|grade)\s*([3-5])(?:\s+(.+))?$/i)
  if (kindergartenGrade) return { grade: `K${kindergartenGrade[1]}`, section: normalizeClassPart(kindergartenGrade[2]) }

  const kindergarten = clean.match(/^k(?:indergarten)?\s*([3-5])(?:\s+(.+))?$/i)
  if (kindergarten) return { grade: `K${kindergarten[1]}`, section: normalizeClassPart(kindergarten[2]) }

  return { grade: clean, section: '' }
}

export const schoolClassOptions = [
  'K3',
  'K4',
  'K5',
  ...Array.from({ length: 12 }, (_, index) => 'Grade ' + (index + 1)),
]

export const canonicalClassLabel = (gradeValue: unknown, sectionValue: unknown = '') => {
  const parsedGrade = splitClassLabel(gradeValue)
  if (!parsedGrade.grade) return 'Unassigned'

  const rawSection = normalizeClassPart(sectionValue)
  const parsedSection = splitClassLabel(rawSection)
  const duplicatedGrade = rawSection
    && parsedSection.grade.toLowerCase() === parsedGrade.grade.toLowerCase()
    && !parsedSection.section
  const section = duplicatedGrade ? parsedGrade.section : (rawSection || parsedGrade.section)
  return [parsedGrade.grade, section].filter(Boolean).join(' ')
}

export const classRank = (className: string) => {
  const normalized = splitClassLabel(canonicalClassLabel(className)).grade
  const kindergarten = normalized.match(/^K([3-5])$/i)
  if (kindergarten) return Number(kindergarten[1]) - 3

  const grade = normalized.match(/^Grade\s*(1[0-2]|[1-9])$/i)
  if (grade) return Number(grade[1]) + 2

  return Number.MAX_SAFE_INTEGER
}

export const compareClassLabels = (left: string, right: string) => {
  const rankDifference = classRank(left) - classRank(right)
  return rankDifference || left.localeCompare(right, 'en', { numeric: true })
}
