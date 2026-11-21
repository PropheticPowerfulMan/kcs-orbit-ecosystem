import test from 'node:test'
import assert from 'node:assert/strict'
import {validSchoolPdf,schoolPdfHash,safeSchoolPdfName,schoolDocumentKey,MAX_SCHOOL_PDF_BYTES} from './schoolDocuments.js'
test('PDF uploads reject incomplete documents and oversized buffers',()=>{
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n')
 assert.equal(validSchoolPdf(pdf),true)
 assert.equal(validSchoolPdf(Buffer.from('<html>not a PDF</html>')),false)
 assert.equal(validSchoolPdf(Buffer.from('%PDF-1.4\ntruncated data')),false)
 assert.equal(validSchoolPdf(Buffer.alloc(MAX_SCHOOL_PDF_BYTES+1)),false)
 assert.equal(schoolPdfHash(pdf).length,64)
})
test('edition keys isolate language and year, and filenames remain safe',()=>{
 assert.notEqual(schoolDocumentKey('handbook','en'),schoolDocumentKey('handbook','fr'))
 assert.notEqual(schoolDocumentKey('calendar','en','2026-2027'),schoolDocumentKey('calendar','en','2027-2028'))
 assert.equal(safeSchoolPdfName('Manuel École.pdf'),'Manuel École.pdf')
 assert.doesNotMatch(safeSchoolPdfName('../bad\r\nname?.pdf'),/[\r\n/\\?]/)
})
