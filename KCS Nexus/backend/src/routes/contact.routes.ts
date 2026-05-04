import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { asyncHandler, success } from '../utils/api.js'

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
  const message = await prisma.contactMessage.create({ data: payload })
  return success(res, message, 'Message received', 201)
}))
