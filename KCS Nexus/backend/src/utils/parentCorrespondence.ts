import { createHash } from 'node:crypto'

// A delivery keeps the same wording when retried. A new communication may use
// another courteous formulation without rewriting the administrator's message.
export function personalizeParentCorrespondence(body: string, name: string | null | undefined, language: 'fr' | 'en', deliveryKey: string) {
  const cleanName = (name || '').normalize('NFC').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
  const variant = createHash('sha256').update(deliveryKey).digest()[0] % 4
  const content = body.normalize('NFC').trim()
    .replace(/^(?:Bonjour|Bonsoir|Madame,? Monsieur|Chers? parents?(?:\/tuteurs?)?|Dear (?:Parent(?:\/Guardian)?|Parents?(?: and Guardians?)?))[ ,!:.]*\r?\n\s*/i, '')
    .replace(/\n\s*(?:Cordialement|Bien cordialement|Sincerely|Kind regards|Yours sincerely)[,.]?\s*\nKinshasa Christian School[.\s]*$/i, '').trim()
  const greeting = language === 'fr'
    ? cleanName ? `Bonjour ${cleanName},` : 'Madame, Monsieur,'
    : cleanName ? `Dear ${cleanName},` : 'Dear Parent or Guardian,'
  const introductions = language === 'fr' ? [
    'Nous vous adressons cette communication de Kinshasa Christian School.',
    'Nous vous transmettons les informations suivantes.',
    'L’équipe de Kinshasa Christian School vous prie de prendre connaissance du message ci-dessous.',
    'Nous souhaitons porter les informations suivantes à votre attention.',
  ] : [
    'Please find below this communication from Kinshasa Christian School.',
    'We are writing to share the following information with you.',
    'The Kinshasa Christian School team kindly invites you to read the message below.',
    'We would like to bring the following information to your attention.',
  ]
  const closings = language === 'fr' ? [
    'Nous vous remercions pour votre attention et votre collaboration.\n\nBien cordialement,',
    'Merci de votre confiance et de votre partenariat avec notre école.\n\nCordialement,',
    'Nous restons à votre disposition pour toute précision.\n\nAvec nos salutations respectueuses,',
    'Nous vous remercions de votre accompagnement dans la vie scolaire de votre enfant.\n\nBien à vous,',
  ] : [
    'Thank you for your attention and cooperation.\n\nKind regards,',
    'Thank you for your trust and partnership with our school.\n\nSincerely,',
    'Please contact the school if you need any clarification.\n\nYours sincerely,',
    'Thank you for your continued support of your child’s education.\n\nWarm regards,',
  ]
  return `${greeting}\n\n${introductions[variant]}\n\n${content}\n\n${closings[variant]}\nKinshasa Christian School`
}
