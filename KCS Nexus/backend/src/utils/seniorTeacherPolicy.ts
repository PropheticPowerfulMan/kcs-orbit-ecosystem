export const SENIOR_CHECKLIST = ['goals','shortlist','requirements','documents','statement','references','funding'] as const
export const SENIOR_STATUSES = ['SHORTLISTED','PREPARING','SUBMITTED','INTERVIEW','OFFER','DECLINED','ENROLLED','WITHDRAWN'] as const
export const isFinalYear = (grade: string) => /^(?:grade|g)\s*12$/i.test(grade.trim())
export const readiness = (checklist: Record<string,string>) => {
 const applicable = SENIOR_CHECKLIST.filter(key => checklist[key] !== 'NOT_APPLICABLE')
 return applicable.length ? Math.round(100 * applicable.filter(key => checklist[key] === 'DONE').length / applicable.length) : null
}
export const duplicateApplication = (applications: Array<{university:string;program:string;intake:string;archived:boolean}>) => {
 const seen = new Set<string>(), normalize = (value:string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ')
 for(const row of applications.filter(row=>!row.archived)) {
  const key = [row.university,row.program,row.intake].map(normalize).join('::')
  if(seen.has(key)) return true
  seen.add(key)
 }
 return false
}
