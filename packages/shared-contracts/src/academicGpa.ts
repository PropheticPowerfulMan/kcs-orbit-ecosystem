/** Existing KCS 4-point bands; percentages and academic averages are never changed. */
export const gradePoints=(percentage:number)=>percentage>=90?4:percentage>=80?3:percentage>=70?2:percentage>=60?1:0
export const hasNumericGpa=(grade:string)=>/^(?:grade\s*)?(?:[1-9]|1[0-2])(?:\s*[a-z])?$/i.test(grade.trim())
export function creditWeightedGpa(rows:Array<{percentage?:number|null;credits?:number|null;hidden?:boolean}>){
 const graded=rows.filter(row=>!row.hidden&&typeof row.percentage==='number'&&Number.isFinite(row.percentage)&&row.percentage>=0&&row.percentage<=100&&(row.credits==null||Number.isFinite(row.credits)&&row.credits>0))
 const credits=graded.reduce((n,row)=>n+(row.credits??1),0),qualityPoints=graded.reduce((n,row)=>n+gradePoints(row.percentage!)*(row.credits??1),0)
 return{gpa:credits?Math.round((qualityPoints/credits+Number.EPSILON)*100)/100:null,credits,qualityPoints,gradedCourses:graded.length,scale:4}
}
