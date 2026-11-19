import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
export function hashLocalPassword(password: string) {
 const salt=crypto.randomBytes(16),digest=crypto.scryptSync(password,salt,64)
 return `scrypt:${salt.toString('hex')}:${digest.toString('hex')}`
}
export function verifyLocalPassword(password:string,stored:string) {
 // Imported recovery hashes remain local; no authentication request is sent to Nexus.
 if(stored.startsWith('bcrypt:')){const value=stored.slice(7);if(!/^\$2[aby]\$(?:0[89]|1[0-4])\$[./A-Za-z0-9]{53}$/.test(value))return false;try{return bcrypt.compareSync(password,value)}catch{return false}}
 const [algorithm,saltHex,digestHex]=stored.split(':')
 if(algorithm!=='scrypt'||!/^[a-f0-9]{32}$/.test(saltHex??'')||!/^[a-f0-9]{128}$/.test(digestHex??''))return false
 try{const expected=Buffer.from(digestHex,'hex'),actual=crypto.scryptSync(password,Buffer.from(saltHex,'hex'),64);return crypto.timingSafeEqual(expected,actual)}catch{return false}
}
