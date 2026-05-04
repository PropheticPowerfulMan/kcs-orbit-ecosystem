import nodemailer from 'nodemailer'
import type { Attachment } from 'nodemailer/lib/mailer/index.js'
import { env } from '../config/env.js'

type MailPayload = {
  to?: string
  replyTo?: string
  subject: string
  text: string
  html: string
  attachments?: Attachment[]
}

export type MailResult =
  | { sent: true }
  | { sent: false; reason: 'SMTP_NOT_CONFIGURED' | 'SMTP_SEND_FAILED' }

const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null

export const sendSchoolMail = async ({ to = env.SCHOOL_EMAIL, replyTo, subject, text, html, attachments }: MailPayload): Promise<MailResult> => {
  if (!transporter) {
    console.warn(`[mail] SMTP is not configured. Email "${subject}" was not sent to ${to}.`)
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const }
  }

  await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to,
    replyTo,
    subject,
    text,
    html,
    attachments,
  })

  return { sent: true as const }
}
