import assert from 'node:assert/strict'
import test from 'node:test'
import { personalizeParentCorrespondence as message } from './parentCorrespondence.js'
import { kcsBrandedEmailHtml } from './emailTemplate.js'

test('addresses each parent individually while retaining the exact administrative content', () => {
 const body = 'The meeting is on 20 November at 09:00. Please bring the signed form.'
 const a = message(body, 'Mbuyi Anne', 'en', 'batch:1')
 const b = message(body, 'Lukusa Éric', 'en', 'batch:2')
 assert.ok(a.startsWith('Dear Mbuyi Anne,')); assert.ok(b.startsWith('Dear Lukusa Éric,'))
 assert.ok(a.includes(body)); assert.ok(b.includes(body)); assert.ok(!a.includes('Lukusa'))
})
test('French accents, clean names and neutral missing-name fallback', () => {
 const value = message('Réunion à l’école : présence souhaitée.', '  Lévana\n Lokala  ', 'fr', 'fr')
 assert.ok(value.startsWith('Bonjour Lévana Lokala,')); assert.ok(value.includes('Réunion à l’école'))
 assert.ok(message('Notice', '', 'en', 'missing').startsWith('Dear Parent or Guardian,'))
})
test('generic report-card greetings are replaced, not doubled; no false academic claims', () => {
 const value = message('Dear Parent/Guardian,\n\nOfficial average: 82.50%.\n\nSincerely,\nKinshasa Christian School', 'Parent A', 'en', 'report:1')
 assert.equal(value.match(/Dear /g)?.length, 1); assert.equal(value.match(/Kinshasa Christian School/g)?.length, 1)
 assert.ok(value.includes('Official average: 82.50%.'))
})
test('retries keep wording identical and new deliveries offer varied polite formalisms', () => {
 const a = message('Important notice.', 'Parent A', 'en', 'retry')
 assert.equal(a, message('Important notice.', 'Parent A', 'en', 'retry'))
 assert.ok(new Set(Array.from({length:32}, (_, i) => message('Notice', 'Parent A', 'en', `new:${i}`))).size > 1)
})
test('the shared branded renderer escapes parent names and content', () => {
 const html = kcsBrandedEmailHtml('Notice', message('<script>alert(1)</script>', '<img onerror=x>', 'en', 'safe'), undefined, 'en')
 assert.ok(html.includes('&lt;img onerror=x&gt;')); assert.ok(!html.includes('<script>alert'))
 assert.ok(html.includes('lang="en"'))
})
