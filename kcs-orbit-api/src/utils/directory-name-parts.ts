type Parts={firstName:string;middleName:string|null;lastName:string}
const clean=(value:unknown)=>typeof value==='string'?value.trim():''
export function directoryNameParts(person:{firstName?:unknown;middleName?:unknown;lastName?:unknown},fallback:Parts):Parts{
 const firstName=clean(person.firstName),lastName=clean(person.lastName),middleName=clean(person.middleName)
 // A structured name with no middle name is complete. Do not invent a middle
 // name by splitting compound first/last names from the display label.
 return {firstName:firstName||fallback.firstName,lastName:lastName||fallback.lastName,middleName:middleName||((firstName&&lastName)?null:fallback.middleName)}
}
