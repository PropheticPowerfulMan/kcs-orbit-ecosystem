export function normalizeClassName(value?: string | null) {
  if (!value) return null
  let cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\/_.-]+/g, ' ').replace(/\s+/g, ' ').trim()

  const kindergartenLong = cleaned.match(/^(?:kindergarten|pre\s*k)(?:\s*(?:grade|k))?\s*([3-5])(?:\s*([a-z][a-z0-9]*))?$/i)
  if (kindergartenLong) return 'K' + kindergartenLong[1] + (kindergartenLong[2] ? ' ' + kindergartenLong[2].toUpperCase() : '')

  cleaned = cleaned.replace(/^(\d{1,2})(?:st|nd|rd|th)\s+grade\b/i, 'Grade $1')

  // Orbit has historically emitted duplicated labels, sometimes without a
  // separator (for example "Grade 1Grade 1"). Collapse them first.
  const repeatedGrade = cleaned.match(/^grade\s*(\d{1,2})\s*grade\s*\1(?:\s*([a-z][a-z0-9]*))?$/i)
  if (repeatedGrade) cleaned = 'Grade ' + repeatedGrade[1] + (repeatedGrade[2] ? ' ' + repeatedGrade[2] : '')
  const repeatedKindergarten = cleaned.match(/^k\s*([3-5])\s*k\s*\1(?:\s*([a-z][a-z0-9]*))?$/i)
  if (repeatedKindergarten) cleaned = 'K' + repeatedKindergarten[1] + (repeatedKindergarten[2] ? ' ' + repeatedKindergarten[2] : '')

  // Compact section labels such as Grade 9A and K3A are official formats too.
  const kindergarten = cleaned.match(/^k\s*([3-5])(?:\s*([a-z][a-z0-9]*))?$/i)
  if (kindergarten) return 'K' + kindergarten[1] + (kindergarten[2] ? ' ' + kindergarten[2].toUpperCase() : '')
  const grade = cleaned.match(/^(?:grade\s*)?(\d{1,2})(?:\s*([a-z][a-z0-9]*))?$/i)
  const gradeNumber = grade ? Number(grade[1]) : 0
  if (grade && gradeNumber >= 1 && gradeNumber <= 12) return 'Grade ' + gradeNumber + (grade[2] ? ' ' + grade[2].toUpperCase() : '')
  return cleaned
}

export function compareClassNames(left: string, right: string) {
  const rank = (value: string) => {
    const normalized = normalizeClassName(value) || value
    const kindergarten = normalized.match(/^K([3-5])(?:\s+([A-Z0-9]+))?$/)
    if (kindergarten) return { level: Number(kindergarten[1]) - 3, section: kindergarten[2] || '' }
    const grade = normalized.match(/^Grade (\d{1,2})(?:\s+([A-Z0-9]+))?$/)
    if (grade) return { level: 3 + Number(grade[1]), section: grade[2] || '' }
    return { level: 1000, section: normalized }
  }
  const a = rank(left); const b = rank(right)
  return a.level - b.level || a.section.localeCompare(b.section, undefined, { numeric: true })
}