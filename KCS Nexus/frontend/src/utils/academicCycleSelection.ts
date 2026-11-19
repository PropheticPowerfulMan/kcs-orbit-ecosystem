type CycleAccess={activeAcademicYear?:string|null;activeEntryTerm?:string|null;closedPeriods?:Array<{academicYear:string;term:string}>}
export function officialAcademicCycle(access:CycleAccess|null|undefined){
 if(!access?.activeAcademicYear||!Object.prototype.hasOwnProperty.call(access,'activeEntryTerm'))return null
 const term=access.activeEntryTerm||'Annual final'
 return {academicYear:access.activeAcademicYear,term}
}
export function globallyClosedCycle(access:CycleAccess|null|undefined,year:string,term:string){
 const normalized=term.replace(/Trimester/gi,'Quarter'),q=/Quarter (\d)/.exec(normalized)
 const semester=q?'Semester '+(Number(q[1])<=2?1:2):normalized
 return (access?.closedPeriods||[]).some(row=>row.academicYear===year&&['Annual final',normalized,semester].includes(row.term.replace(/Trimester/gi,'Quarter')))
}
