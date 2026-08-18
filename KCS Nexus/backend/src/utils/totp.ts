import crypto from 'node:crypto'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const encodeBase32 = (buffer: Buffer) => {
  let bits = ''
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0')
  let output = ''
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)]
  }
  return output
}

const decodeBase32 = (value: string) => {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const character of normalized) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new Error('Invalid base32 secret')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  return Buffer.from(bytes)
}

const codeAt = (secret: string, timestamp: number) => {
  const counter = Math.floor(timestamp / 30_000)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return binary.toString().padStart(6, '0')
}

export const generateTotpSecret = () => encodeBase32(crypto.randomBytes(20))

export const verifyTotp = (secret: string, code: string, now = Date.now()) => {
  if (!/^\d{6}$/.test(code)) return false
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(codeAt(secret, now + window * 30_000))
    const received = Buffer.from(code)
    return expected.length === received.length && crypto.timingSafeEqual(expected, received)
  })
}
