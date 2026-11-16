type Identity={id:string;avatar?:string|null}
/** Auth responses intentionally omit the personal photo; omission is not deletion. */
export function preserveSessionPortrait<T extends Identity>(incoming:T,current?:Identity|null):T{
 if(current?.id===incoming.id&&incoming.avatar==null&&current.avatar)return{...incoming,avatar:current.avatar}
 return incoming
}
