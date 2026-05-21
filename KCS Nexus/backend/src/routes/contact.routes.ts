import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { asyncHandler, success } from '../utils/api.js'
import { sendSchoolMail } from '../utils/mail.js'

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(2),
  message: z.string().min(10),
})

export const contactRouter = Router()

contactRouter.post('/', asyncHandler(async (req, res) => {
  const payload = contactSchema.parse(req.body)
  const message = await prisma.contactMessage.create({ data: payload }).catch((error) => {
    console.error('[contact] Message email will continue, but database archive failed:', error)
    return null
  })
  const safeLines = [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone || 'Not provided'}`,
    `Subject: ${payload.subject}`,
    '',
    payload.message,
  ]
  const mailResult = await sendSchoolMail({
    replyTo: payload.email,
    subject: `KCS contact message - ${payload.subject}`,
    text: safeLines.join('\n'),
    html: safeLines.map((line) => line ? `<p>${line.replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char] || char))}</p>` : '<br />').join(''),
  })
  return success(res, { message, emailDelivery: mailResult }, mailResult.sent ? 'Message received and emailed' : 'Message received; email delivery needs SMTP configuration', 201)
}))
