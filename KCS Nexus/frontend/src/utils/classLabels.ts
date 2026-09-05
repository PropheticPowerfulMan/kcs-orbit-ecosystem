const normalizeClassPart = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ')

export const schoolClassOptions = [
  'K3',
  'K4',
  'K5',
  ...Array.from({ length: 12 }, (_, index) => 'Grade ' + (index + 1)),
]

export const canonicalClassLabel = (gradeValue: unknown, sectionValue: unknown = '') => {
  const grade = normalizeClassPart(gradeValue)
  const section = normalizeClassPart(sectionValue)
  const combined = [grade, section].filter(Boolean).join(' ')

  if (!combined) return 'Unassigned'

  const kindergartenContext = /kindergarten|\bk\s*[3-5]\b/i.test(combined)
  if (kindergartenContext) {
    const kindergarten = combined.match(/(?:kindergarten\s*)?(?:k|grade)?\s*([3-5])\b/i)
    if (kindergarten) return 'K' + kindergarten[1]
  }

  const numberedGrade = combined.match(/\bgrade\s*(1[0-2]|[1-9])\b/i)
  if (numberedGrade) return 'Grade ' + Number(numberedGrade[1])

  const ordinalGrade = combined.match(/\b(1[0-2]|[1-9])(?:st|nd|rd|th)\s+grade\b/i)
  if (ordinalGrade) return 'Grade ' + Number(ordinalGrade[1])

  return combined
}

export const classRank = (className: string) => {
  const normalized = canonicalClassLabel(className)
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
