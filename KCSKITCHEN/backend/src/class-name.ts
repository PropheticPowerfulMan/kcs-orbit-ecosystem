export function normalizeClassName(value?: string | null) {
  if (!value) return null
  let cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  const repeated = cleaned.match(/^(.+?)\s*\1$/i)
  if (repeated?.[1]) cleaned = repeated[1].trim()
  const kindergarten = cleaned.match(/^k\s*([3-5])(?:\s*[- ]?\s*([a-z]))?$/i)
  if (kindergarten) return 'K' + kindergarten[1] + (kindergarten[2] ? kindergarten[2].toUpperCase() : '')
  const grade = cleaned.match(/^(?:grade\s*)?(\d{1,2})(?:\s*[- ]?\s*([a-z]))?$/i)
  if (grade) return 'Grade ' + Number(grade[1]) + (grade[2] ? grade[2].toUpperCase() : '')
  return cleaned
}

export function compareClassNames(left: string, right: string) {
  const rank = (value: string) => {
    const normalized = normalizeClassName(value) || value
    const kindergarten = normalized.match(/^K([3-5])([A-Z])?$/)
    if (kindergarten) return { level: Number(kindergarten[1]) - 3, section: kindergarten[2] || '' }
    const grade = normalized.match(/^Grade (\d{1,2})([A-Z])?$/)
    if (grade) return { level: 3 + Number(grade[1]), section: grade[2] || '' }
    return { level: 1000, section: normalized }
  }
  const a = rank(left); const b = rank(right)
  return a.level - b.level || a.section.localeCompare(b.section, undefined, { numeric: true })
}
