import {prisma} from '../config/prisma.js'
export const documentAuthorityTypes=['report_card','transcript','attendance_certificate','completion_certificate','admission_certificate'] as const
export type DocumentAuthorityType=typeof documentAuthorityTypes[number]
export type DocumentAuthorities={defaultName:string;overrides:Partial<Record<DocumentAuthorityType,string>>;configured:boolean}
export const currentPrincipalName='LUPEMBA PEKITA Péguy'
export async function officialDocumentAuthorities(client:Pick<typeof prisma,'auditLog'>=prisma):Promise<DocumentAuthorities>{
 const row=await client.auditLog.findFirst({where:{action:'OFFICIAL_DOCUMENT_AUTHORITIES',targetType:'OfficialDocumentAuthorities',targetId:'global'},orderBy:{createdAt:'desc'},select:{metadata:true}})
 const metadata=(row?.metadata??{}) as {defaultName?:unknown;overrides?:Record<string,unknown>};const overrides:DocumentAuthorities['overrides']={}
 for(const type of documentAuthorityTypes){const value=metadata.overrides?.[type];if(typeof value==='string'&&value.trim())overrides[type]=value.trim()}
 return{defaultName:typeof metadata.defaultName==='string'&&metadata.defaultName.trim()?metadata.defaultName.trim():currentPrincipalName,overrides,configured:Boolean(row)}
}
export function resolveDocumentAuthority(settings:DocumentAuthorities,type:DocumentAuthorityType,legacyName?:string|null){return settings.overrides[type]||settings.defaultName}
export async function officialDocumentAuthorityName(type:DocumentAuthorityType,legacyName?:string|null){return resolveDocumentAuthority(await officialDocumentAuthorities(),type,legacyName)}
