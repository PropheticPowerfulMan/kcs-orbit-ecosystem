export const publicLibrary=[
 {id:'reference:first-book-algebra.pdf',title:'A First Book in Algebra',author:'Wallace C. Boyden',file:'first-book-algebra.pdf',scope:'LIBRARY',reference:true},
 {id:'reference:history-of-mathematics.pdf',title:'A History of Mathematics',author:'Florian Cajori',file:'history-of-mathematics.pdf',scope:'LIBRARY',reference:true},
 {id:'reference:euclid-elements.pdf',title:'The Elements of Euclid',author:'Euclid · John Casey',file:'euclid-elements.pdf',scope:'LIBRARY',reference:true},
 {id:'reference:tour-du-monde.txt',title:'Le Tour du monde en 80 jours',author:'Jules Verne',file:'tour-du-monde.txt',scope:'LIBRARY',reference:true}
]
export function pedagogyStatistics(plan:any,progress:any,schoolDate:string){
 const chapters=plan.published?plan.chapters||[]:[],entries=progress.entries||[]
 const done=chapters.filter((c:any)=>entries.some((e:any)=>e.chapterId===c.id&&e.status==='COMPLETED'))
 const due=chapters.filter((c:any)=>c.endDate<schoolDate)
 const overdue=due.filter((c:any)=>!done.some((d:any)=>d.id===c.id))
 return{planned:chapters.length,reported:chapters.filter((c:any)=>entries.some((e:any)=>e.chapterId===c.id)).length,completed:done.length,due:due.length,overdue:overdue.length,completion:chapters.length&&entries.length?Math.round(100*done.length/chapters.length):null,coverage:due.length&&entries.length?Math.round(100*due.filter((c:any)=>done.some((d:any)=>d.id===c.id)).length/due.length):null}
}
