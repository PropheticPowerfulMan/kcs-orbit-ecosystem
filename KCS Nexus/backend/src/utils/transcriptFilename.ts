/** Same ordering as report cards: document, class, period/coverage, school years, learner. */
export function transcriptFilename(input:{grade:string;academicYears:string[];studentName:string}){
 const clean=(v:string)=>v.normalize('NFC').replace(/[\u0000-\u001f\u007f/\\<>:"|?*]/g,'-').replace(/\s+/g,' ').trim()
 const years=[...new Set(input.academicYears.filter(y=>/^\d{4}-\d{4}$/.test(y)))].sort()
 const span=years.length>1?years[0]+' to '+years[years.length-1]:years[0]||''
 return ['TR',clean(input.grade),'Grades 9-12',span,clean(input.studentName)].filter(Boolean).join(' - ').slice(0,200)+'.pdf'
}
