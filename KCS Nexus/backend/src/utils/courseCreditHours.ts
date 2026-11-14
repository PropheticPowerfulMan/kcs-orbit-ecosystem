/** Existing credit weights are preserved during roster syncs and grade submissions. */
export function allowsTeacherCourseCredits(credits:number|undefined,existingCredits:number|undefined,submissionPreflight=false){
 if(credits===undefined)return true
 if(credits===1||credits===2)return true
 return existingCredits!==undefined&&(submissionPreflight||credits===existingCredits)
}
