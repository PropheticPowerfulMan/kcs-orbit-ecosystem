import assert from 'node:assert/strict'
import test from 'node:test'
import { KCS_EMAIL_BRAND_LINKS, kcsBrandedEmailHtml } from './emailTemplate.js'

test('renders the official KCS email identity and social links', () => {
  const html = kcsBrandedEmailHtml('Information importante', 'Bonjour famille KCS')
  assert.match(html, /Kinshasa Christian School/)
  assert.match(html, /Letting Our Light Shine/)
  assert.match(html, /Bonjour famille KCS/)
  assert.match(html, /background-image:/)
  for (const link of Object.values(KCS_EMAIL_BRAND_LINKS)) assert.ok(html.includes(link))
})

test('escapes untrusted subject and plain text while preserving supplied system html', () => {
  const plain = kcsBrandedEmailHtml('<script>alert(1)</script>', '<img src=x>')
  assert.doesNotMatch(plain, /<script>/)
  assert.match(plain, /&lt;script&gt;/)
  assert.match(plain, /&lt;img src=x&gt;/)
  const supplied = kcsBrandedEmailHtml('Titre', 'Texte', '<p><strong>Contenu officiel</strong></p>')
  assert.match(supplied, /<strong>Contenu officiel<\/strong>/)
})

test('includes responsive and accessible email fallbacks', () => {
  const html = kcsBrandedEmailHtml('Titre', 'Aperçu du message')
  assert.match(html, /max-width:620px/)
  assert.match(html, /role="presentation"/)
  assert.match(html, /alt="Logo Kinshasa Christian School"/)
  assert.match(html, /display:none;max-height:0/)
})
