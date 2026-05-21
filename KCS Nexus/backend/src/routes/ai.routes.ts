import { Router } from 'express'
import OpenAI from 'openai'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null

export const aiRouter = Router()

type ChatLanguage = 'en' | 'fr'

const schoolFacts = {
  name: 'Kinshasa Christian School',
  shortName: 'KCS',
  address: 'Avenue de la République No. 1, Macampagne, Ngaliema, Kinshasa',
  email: env.SCHOOL_EMAIL,
  phone: '+243 895 326 011',
  instagram: 'https://www.instagram.com/kinshasachristianschoolknights',
  youtube: 'https://www.youtube.com/@kinshasachristianschool',
  divisions: [
    'Kindergarten: K3-K5',
    'Elementary School: Grade 1-Grade 5',
    'Middle School: Grade 6-Grade 8',
    'High School: Grade 9-Grade 12',
  ],
  academics: [
    'American international Christian education in Kinshasa',
    'Bible curriculum and character formation',
    'STEAM, literacy, numeracy, arts, athletics, and leadership activities',
    'Advanced Placement opportunities for high school students',
  ],
  admissionsDocuments: [
    'student birth certificate / certificat de naissance',
    'previous school transcript or report card / bulletin ou relevé précédent',
    'requested grade/class / classe souhaitée',
    'parent or guardian contact information / contacts du parent ou tuteur',
    'medical or identity documents when requested by admissions / documents médicaux ou d’identité si demandés',
  ],
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const detectLanguage = (language?: string, text = ''): ChatLanguage => {
  if (language === 'fr' || language === 'en') return language
  const normalized = normalize(text)
  return /\b(comment|quoi|quel|quelle|frais|ecole|inscription|admission|horaire|adresse|contact|programme)\b/.test(normalized)
    ? 'fr'
    : 'en'
}

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word))

const formatList = (items: string[]) => items.map((item) => `- ${item}`).join('\n')

const buildLocalSchoolAnswer = (question: string, language?: string) => {
  const lang = detectLanguage(language, question)
  const q = normalize(question)
  const isFr = lang === 'fr'

  if (hasAny(q, ['admission', 'inscription', 'inscrire', 'apply', 'enroll', 'registration', 'postuler'])) {
    return isFr
      ? `Pour postuler à ${schoolFacts.shortName} :\n${formatList([
          'ouvrez la page Admissions et complétez le formulaire',
          `préparez : ${schoolFacts.admissionsDocuments.join(', ')}`,
          `contactez le bureau des admissions au ${schoolFacts.phone}`,
          `ou écrivez à ${schoolFacts.email}`,
        ])}\n\nSi vous me donnez l'âge ou la classe souhaitée, je peux vous orienter vers la bonne division.`
      : `To apply to ${schoolFacts.shortName}:\n${formatList([
          'open the Admissions page and complete the application form',
          `prepare: ${schoolFacts.admissionsDocuments.join(', ')}`,
          `call admissions at ${schoolFacts.phone}`,
          `or email ${schoolFacts.email}`,
        ])}\n\nTell me the learner age or requested grade and I can point you to the right division.`
  }

  if (hasAny(q, ['fee', 'fees', 'tuition', 'cost', 'price', 'prix', 'cout', 'frais', 'scolarite', 'paiement'])) {
    return isFr
      ? `Les frais peuvent dépendre de la classe, du dossier et des modalités de paiement. Pour obtenir le montant officiel et à jour, contactez l'administration :\n- Email : ${schoolFacts.email}\n- Téléphone : ${schoolFacts.phone}\n\nVous pouvez aussi demander les options de paiement et les documents requis.`
      : `Tuition and fees can depend on the grade, application file, and payment option. For the official current amount, contact administration:\n- Email: ${schoolFacts.email}\n- Phone: ${schoolFacts.phone}\n\nYou can also ask for payment options and required documents.`
  }

  if (hasAny(q, ['program', 'programme', 'grade', 'classe', 'division', 'curriculum', 'academ', 'ap ', 'college board', 'maternelle', 'primaire', 'secondaire'])) {
    return isFr
      ? `${schoolFacts.shortName} accueille les élèves dans ces divisions :\n${formatList(schoolFacts.divisions)}\n\nLe programme met l'accent sur :\n${formatList(schoolFacts.academics)}`
      : `${schoolFacts.shortName} serves students through these divisions:\n${formatList(schoolFacts.divisions)}\n\nThe program emphasizes:\n${formatList(schoolFacts.academics)}`
  }

  if (hasAny(q, ['contact', 'phone', 'email', 'address', 'adresse', 'telephone', 'mail', 'where', 'location', 'situe', 'localisation'])) {
    return isFr
      ? `Voici les contacts de ${schoolFacts.shortName} :\n- Adresse : ${schoolFacts.address}\n- Téléphone : ${schoolFacts.phone}\n- Email : ${schoolFacts.email}\n- Instagram : ${schoolFacts.instagram}\n- YouTube : ${schoolFacts.youtube}`
      : `Here is how to contact ${schoolFacts.shortName}:\n- Address: ${schoolFacts.address}\n- Phone: ${schoolFacts.phone}\n- Email: ${schoolFacts.email}\n- Instagram: ${schoolFacts.instagram}\n- YouTube: ${schoolFacts.youtube}`
  }

  if (hasAny(q, ['schedule', 'calendar', 'event', 'horaire', 'calendrier', 'evenement', 'rentre', 'rentree', 'meeting', 'reunion'])) {
    return isFr
      ? `Pour les horaires, réunions parents-professeurs, événements et dates importantes, consultez les pages News/Events de Nexus ou contactez l'école au ${schoolFacts.phone}. Pour une date précise, donnez-moi l'événement que vous cherchez.`
      : `For schedules, parent-teacher meetings, events, and important dates, check the Nexus News/Events pages or call the school at ${schoolFacts.phone}. If you need a specific date, tell me which event you are looking for.`
  }

  if (hasAny(q, ['portal', 'login', 'connexion', 'parent', 'student', 'teacher', 'dashboard', 'nexus', 'compte', 'mot de passe'])) {
    return isFr
      ? `KCS Nexus regroupe les portails parents, élèves, enseignants et administration. Si vous avez un problème de connexion, vérifiez votre email ou votre code d'accès, puis contactez l'administration avec votre nom complet et votre rôle.`
      : `KCS Nexus includes parent, student, teacher, and administration portals. If you cannot sign in, check your email/access code, then contact administration with your full name and role.`
  }

  return isFr
    ? `Je peux vous aider sur les admissions, les frais, les programmes, le calendrier, les contacts et l'utilisation de KCS Nexus.\n\nPour une réponse précise, posez-moi une question comme : "Comment inscrire mon enfant en Grade 6 ?" ou "Où se trouve l'école ?"\n\nContact direct : ${schoolFacts.phone} | ${schoolFacts.email}`
    : `I can help with admissions, fees, programs, calendar items, contact details, and KCS Nexus portal questions.\n\nFor a precise answer, ask something like: "How do I enroll my child in Grade 6?" or "Where is the school located?"\n\nDirect contact: ${schoolFacts.phone} | ${schoolFacts.email}`
}

const buildSystemPrompt = (language: ChatLanguage) => {
  const languageInstruction = language === 'fr'
    ? 'Réponds en français naturel avec les accents, apostrophes, espaces et ponctuation corrects, sauf si le visiteur demande explicitement l’anglais.'
    : 'Answer in English unless the visitor asks for French.'

  return [
    'You are the public visitor assistant for Kinshasa Christian School inside KCS Nexus.',
    languageInstruction,
    'Be warm, concise, accurate, and practical. Prefer short paragraphs and bullet points.',
    'Preserve the user language and do not remove diacritics from French words.',
    'Only answer school-related questions: admissions, programs, fees, contacts, calendar, events, location, portals, and general school life.',
    'If a question needs an official current amount, private student data, legal decision, or live confirmation, say so and route the visitor to the school office.',
    `School facts: ${JSON.stringify(schoolFacts)}`,
  ].join('\n')
}

aiRouter.post('/chat', asyncHandler(async (req, res) => {
  const schema = z.object({
    messages: z
      .array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string().min(1).max(2000) }))
      .min(1)
      .max(12),
    language: z.string().optional(),
  })
  const { messages, language } = schema.parse(req.body)
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
  const chatLanguage = detectLanguage(language, latestUserMessage)
  const localAnswer = buildLocalSchoolAnswer(latestUserMessage, chatLanguage)

  if (!openai) {
    return success(res, { response: localAnswer, source: 'local-school-knowledge' })
  }

  const completionMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(chatLanguage) },
    { role: 'system', content: `Use this local answer as grounded context. Improve it only when helpful; do not invent facts.\n${localAnswer}` },
    ...messages
      .filter((message) => message.role !== 'system')
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content })),
  ]

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: completionMessages,
      temperature: 0.35,
      max_tokens: 500,
    })

    return success(res, {
      response: completion.choices[0]?.message?.content?.trim() || localAnswer,
      source: 'openai-grounded',
    })
  } catch (error) {
    console.error('[ai/chat] OpenAI request failed, using local school answer:', error)
    return success(res, { response: localAnswer, source: 'local-school-knowledge' })
  }
}))

aiRouter.post('/tutor', authenticate, asyncHandler(async (req, res) => {
  const schema = z.object({ subject: z.string(), question: z.string(), studentId: z.string().optional() })
  const { subject, question, studentId } = schema.parse(req.body)

  const response = openai
    ? await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are an expert ${subject} tutor for an American international school in Kinshasa. Explain clearly and step by step.` },
          { role: 'user', content: question },
        ],
        temperature: 0.5,
      })
    : null

  if (studentId) {
    await prisma.aITutorSession.create({
      data: {
        studentId,
        subject,
        topic: question.slice(0, 80),
        messages: {
          create: [
            { role: 'user', content: question },
            { role: 'assistant', content: response?.choices[0]?.message?.content ?? 'AI key not configured. Backend scaffold ready.' },
          ],
        },
      },
    })
  }

  return success(res, { response: response?.choices[0]?.message?.content ?? `AI Tutor scaffold ready for ${subject}. Add OPENAI_API_KEY for live responses.` })
}))

aiRouter.post('/quiz', authenticate, asyncHandler(async (req, res) => {
  const schema = z.object({ subject: z.string(), topic: z.string(), difficulty: z.string() })
  const { subject, topic, difficulty } = schema.parse(req.body)

  const quiz = [
    { question: `Explain the core concept of ${topic} in ${subject}.`, difficulty },
    { question: `Apply ${topic} to a real classroom scenario.`, difficulty },
    { question: `What common mistake should a student avoid in ${topic}?`, difficulty },
  ]

  return success(res, { subject, topic, difficulty, questions: quiz })
}))

aiRouter.get('/recommendations/:studentId', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.studentId)
  const recommendations = await prisma.aIRecommendation.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, recommendations)
}))

aiRouter.get('/analytics/:studentId', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.studentId)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { grades: true, aiRecommendations: true },
  })

  return success(res, {
    studentId,
    overallGPA: student?.gpa ?? 0,
    attendanceRate: student?.attendanceRate ?? 0,
    recommendations: student?.aiRecommendations ?? [],
    trends: student?.grades ?? [],
  })
}))
