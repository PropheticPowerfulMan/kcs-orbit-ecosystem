type CashierSession={userId:string;role:string;credentialScope?:string;credentialVersion?:number}
type CashierAccount={id:string;isActive:boolean;version:number}|null
export function cashierSessionMatches(session:CashierSession,account:CashierAccount){
 return Boolean(account&&account.isActive&&session.role==='CASHIER'&&session.userId==='kitchen-cashier:'+account.id&&session.credentialScope==='KITCHEN_CASHIER_LOCAL'&&session.credentialVersion===account.version)
}
