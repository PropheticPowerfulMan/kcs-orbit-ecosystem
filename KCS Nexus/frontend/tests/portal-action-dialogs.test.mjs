import {test,afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const source=readFileSync(new URL('../src/utils/portalActionDialogs.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText
const {confirmPortalAction,promptPortalAction,alertPortalMessage,currentPortalDialog,answerPortalDialog,cancelPortalDialogs}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
afterEach(()=>cancelPortalDialogs())
test('nothing is accepted until the user explicitly confirms',async()=>{const promise=confirmPortalAction('Delete a record?');const item=currentPortalDialog();assert.equal(item.kind,'confirm');answerPortalDialog(item.id,false);assert.equal(await promise,false)})
test('a double click cannot execute a confirmed mutation twice',async()=>{let calls=0;const operation=async()=>{if(await confirmPortalAction('Delete same record?'))calls++};const first=operation(),second=operation();answerPortalDialog(currentPortalDialog().id,true);await Promise.all([first,second]);assert.equal(calls,1)})
test('prompt text is preserved exactly and cancellation returns null',async()=>{const first=promptPortalAction('Type ARCHIVER:');answerPortalDialog(currentPortalDialog().id,'ARCHIVER');assert.equal(await first,'ARCHIVER');const second=promptPortalAction('Official reason:');answerPortalDialog(currentPortalDialog().id,null);assert.equal(await second,null)})
test('navigation cancels all queued questions and never authorizes actions',async()=>{const first=confirmPortalAction('First?'),second=promptPortalAction('Reason?');cancelPortalDialogs();assert.equal(await first,false);assert.equal(await second,null);assert.equal(currentPortalDialog(),null)})
test('a stale response cannot answer the next question',async()=>{const first=confirmPortalAction('First?'),id=currentPortalDialog().id;answerPortalDialog(id,true);assert.equal(await first,true);const next=confirmPortalAction('Next?'),nextId=currentPortalDialog().id;answerPortalDialog(id,true);assert.equal(currentPortalDialog().id,nextId);answerPortalDialog(nextId,false);assert.equal(await next,false)})
test('acknowledging an informational message does not confirm a queued operation',async()=>{const info=alertPortalMessage('Information'),question=confirmPortalAction('Continue?');answerPortalDialog(currentPortalDialog().id,true);await info;assert.equal(currentPortalDialog().kind,'confirm');answerPortalDialog(currentPortalDialog().id,false);assert.equal(await question,false)})
