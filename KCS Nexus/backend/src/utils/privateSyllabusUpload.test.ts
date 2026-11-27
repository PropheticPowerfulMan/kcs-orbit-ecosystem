import test from 'node:test'
import assert from 'node:assert/strict'
import {privateSyllabusUploadStatus as check} from './privateSyllabusUpload.js'
test('public static routing excludes direct, encoded and normalized private syllabus aliases',()=>{for(const p of ['/syllabi/file.pdf','/%73yllabi/file.pdf','/%2573yllabi/file.pdf','//syllabi/file.pdf','/public/../syllabi/file.pdf','/public/..%2fsyllabi/file.pdf','/public/..%5csyllabi/file.pdf','/SYLLABI/file.pdf'])assert.equal(check(p),404,p)})
test('public profile images and other ordinary uploads keep their existing route',()=>{for(const p of ['/avatars/profile.png','/elections/photo.webp','/school-documents/calendar.pdf','/syllabi-cover.png'])assert.equal(check(p),null,p)})
test('malformed encoding and null bytes are rejected',()=>{assert.equal(check('/%GG/file'),400);assert.equal(check('/avatars/'+String.fromCharCode(0)),400)})
