export const academicFeatures=['grades','reportCards','transcripts'] as const
export type AcademicFeature=typeof academicFeatures[number]
export type AcademicAudience='student'|'parent'
export type AcademicPermissions=Record<AcademicFeature,boolean>
export type VisibilityRule={id:string;audience:'student'|'parent'|'both';effect?:'ALLOW'|'DENY';grade?:string;section?:string;studentNumbers?:string[];parentIds?:string[];academicYear?:string;term?:string;courseIds?:string[];permissions:AcademicPermissions}
export type VisibilityPolicy={revision:number;enabled:boolean;defaults:Record<AcademicAudience,AcademicPermissions>;rules:VisibilityRule[]}
export const closedPermissions=():AcademicPermissions=>({grades:false,reportCards:false,transcripts:false})
export const closedVisibilityPolicy=():VisibilityPolicy=>({revision:0,enabled:false,defaults:{student:closedPermissions(),parent:closedPermissions()},rules:[]})
export type VisibilityContext={audience:AcademicAudience;parentIds?:string[];studentNumber?:string;grade?:string;section?:string;academicYear?:string;term?:string;courseId?:string}
const norm=(v:string|undefined)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
export function canViewAcademic(policy:VisibilityPolicy,feature:AcademicFeature,c:VisibilityContext){
 if(!policy.enabled)return false
 const matches=(r:VisibilityRule)=>r.permissions[feature]&&(r.audience==='both'||r.audience===c.audience)
  &&(!r.grade||norm(r.grade)===norm(c.grade))&&(!r.section||norm(r.section)===norm(c.section))
  &&(!r.studentNumbers?.length||Boolean(c.studentNumber&&r.studentNumbers.some(n=>norm(n)===norm(c.studentNumber))))
  &&(!r.parentIds?.length||Boolean(c.parentIds?.some(id=>r.parentIds!.includes(id))))
  &&(!r.academicYear||r.academicYear===c.academicYear||(r.effect==='DENY'&&!c.academicYear))
  &&(!r.term||norm(r.term)===norm(c.term)||(r.effect==='DENY'&&!c.term))
  &&(!r.courseIds?.length||Boolean(c.courseId&&r.courseIds.includes(c.courseId))||(r.effect==='DENY'&&!c.courseId))
 if(policy.rules.some(r=>r.effect==='DENY'&&matches(r)))return false
 return policy.defaults[c.audience][feature]||policy.rules.some(r=>r.effect!=='DENY'&&matches(r))
}
