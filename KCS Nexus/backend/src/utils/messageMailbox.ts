import type { Prisma, UserRole } from '@prisma/client'
/** A direct recipient always wins over a legacy role label. Only unaddressed
 * legacy broadcasts can be read by all accounts with that role. */
export function mailboxDirection(userId:string,role:UserRole,box:string):Prisma.InternalMessageWhereInput {
 const sent={senderId:userId,senderArchivedAt:null}
 const received:Prisma.InternalMessageWhereInput={OR:[{recipientId:userId,recipientArchivedAt:null},{recipientId:null,targetRole:role}]}
 return box==='sent'?sent:box==='inbox'?received:{OR:[sent,received]}
}
