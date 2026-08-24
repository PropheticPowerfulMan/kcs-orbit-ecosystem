import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_MEDIA_UPLOAD_BYTES, safeMediaFilename, validateMediaUpload } from './mediaUpload.js'

function file(name: string, mimetype: string, bytes: number[]): Express.Multer.File {
  const buffer = Buffer.from(bytes)
  return { fieldname: 'file', originalname: name, encoding: '7bit', mimetype, size: buffer.length, buffer } as Express.Multer.File
}

test('accepts an image whose extension, MIME and signature agree', () => {
  assert.equal(validateMediaUpload(file('photo.png', 'image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true)
})

test('rejects a forged MIME type', () => {
  assert.equal(validateMediaUpload(file('photo.png', 'image/png', [0x4d, 0x5a, 0x90, 0x00])), false)
})

test('rejects forbidden executable extensions and sanitizes names', () => {
  assert.equal(validateMediaUpload(file('payload.exe', 'application/octet-stream', [0x4d, 0x5a])), false)
  assert.match(safeMediaFilename('../../evil name.png'), /^\d+-evil-name\.png$/)
})

test('defines a bounded in-memory upload limit', () => {
  assert.equal(MAX_MEDIA_UPLOAD_BYTES, 10 * 1024 * 1024)
})