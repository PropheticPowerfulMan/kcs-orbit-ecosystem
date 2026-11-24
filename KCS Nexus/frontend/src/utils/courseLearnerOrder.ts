const names=new Intl.Collator(['fr','en'],{sensitivity:'base',numeric:true})
/** Sort the displayed full name without changing attendance records or their identifiers. */
export function alphabeticCourseLearners<T extends {name:string;studentId:string;courseName?:string}>(rows:readonly T[]):T[]{
 return [...rows].sort((a,b)=>names.compare(a.name.trim(),b.name.trim())||names.compare(a.courseName||'',b.courseName||'')||a.studentId.localeCompare(b.studentId))
}
