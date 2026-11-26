export function createPreparedPreviewCache<T>(options?:{now?:()=>number;ttl?:number}):{get:(key:string,create:()=>Promise<T>,force?:boolean)=>Promise<T>;clear:()=>void};
