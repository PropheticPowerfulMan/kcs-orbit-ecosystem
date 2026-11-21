/** Scope is already restricted to one owned course and exact submitted academic cycle by the caller. */
export function reconcileSubmissionRoster(enrolledIds:string[],gradedIds:string[],previousIds:string[]){
 const enrolled=new Set(enrolledIds)
 const withdrawnIds=[...new Set(previousIds)].filter(id=>!enrolled.has(id)).sort()
 return {withdrawnIds,affectedIds:[...new Set([...gradedIds,...withdrawnIds])].sort()}
}
