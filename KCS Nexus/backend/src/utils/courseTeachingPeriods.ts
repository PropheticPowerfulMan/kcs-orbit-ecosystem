export type TeachingPeriod = { academicYear: string; semesters: number[] };
export type CoursePeriodState = { periods: TeachingPeriod[]; revision: number };
export function validAcademicYear(value: string) {
  const match = /^(\d{4})-(\d{4})$/.exec(value);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1 && Number(match[1]) >= 1900 && Number(match[2]) <= 2701);
}
export function normalizeTeachingPeriods(value: unknown): TeachingPeriod[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is TeachingPeriod => p && typeof p.academicYear === 'string' && validAcademicYear(p.academicYear) && Array.isArray(p.semesters) && p.semesters.length > 0 && p.semesters.every((s: unknown) => s === 1 || s === 2)).map(p => ({ academicYear:p.academicYear, semesters:[...new Set(p.semesters)].sort() }));
}
export function updateTeachingPeriods(previous: TeachingPeriod[], year: string, semesters: number[], mode: 'add'|'replace'): TeachingPeriod[] {
  const old = previous.find(p => p.academicYear === year)?.semesters || [];
  const next = [...new Set(mode === 'add' ? [...old,...semesters] : semesters)].sort();
  return [...previous.filter(p => p.academicYear !== year), { academicYear:year, semesters:next }].sort((a,b)=>a.academicYear.localeCompare(b.academicYear));
}
export function courseMatchesPeriod(periods: TeachingPeriod[], year: string, term: string) {
  if (!periods.length) return true; // Unclassified historical courses remain accessible.
  const configured = periods.find(p => p.academicYear === year);
  if (!configured) return false;
  const quarter = /Quarter\s*(\d)/i.exec(term.replace(/Trimester/gi,'Quarter'));
  const semester = quarter ? Number(quarter[1]) <= 2 ? 1 : 2 : Number(/Semester\s*([12])/i.exec(term)?.[1]);
  return semester ? configured.semesters.includes(semester) : configured.semesters.length > 0;
}
