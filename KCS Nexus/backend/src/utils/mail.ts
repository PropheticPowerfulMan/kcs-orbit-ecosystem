import nodemailer from 'nodemailer'
import type { Attachment } from 'nodemailer/lib/mailer/index.js'
import { env } from '../config/env.js'

type MailPayload = {
  to?: string
  replyTo?: string
  subject: string
  text: string
  html?: string
  attachments?: Attachment[]
}

export type MailResult =
  | { sent: true }
  | { sent: false; reason: 'SMTP_NOT_CONFIGURED' | 'SMTP_SEND_FAILED' }

const LOGO_URL = 'https://kinshasachristianschool.org/icons/nexus-192.png'
const SCHOOL_URL = 'https://kinshasachristianschool.org/'
const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))

const brandedEmailHtml = (subject: string, text: string, suppliedHtml?: string) => {
  const content = suppliedHtml?.trim() || text.split(/\r?\n/).map((line) => line.trim() ? `<p style="margin:0 0 16px;line-height:1.72;color:#334155">${escapeHtml(line)}</p>` : '<div style="height:12px;line-height:12px">&nbsp;</div>').join('')
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#eef4fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4fb;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border-collapse:separate;border-spacing:0;overflow:hidden;border-radius:26px;box-shadow:0 20px 55px rgba(8,38,76,.16)">
<tr><td style="height:7px;background:#ffcb05"></td></tr><tr><td style="background:#08264c;padding:26px 30px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="width:64px;height:64px;background:#fff;border-radius:50%;padding:2px"><img src="${LOGO_URL}" width="60" height="60" alt="Kinshasa Christian School" style="display:block;width:60px;height:60px;border-radius:50%;object-fit:cover"></td><td style="padding-left:18px"><p style="margin:0 0 5px;color:#ffcb05;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase">KCS NEXUS · MESSAGE OFFICIEL</p><h1 style="margin:0;color:#fff;font-size:24px;line-height:1.25">${escapeHtml(subject)}</h1><p style="margin:7px 0 0;color:#bdd7f5;font-size:13px">Letting Our Light Shine</p></td></tr></table></td></tr>
<tr><td style="background:#fff;padding:30px"><div style="border-left:5px solid #ffcb05;background:#f8fbff;border-radius:16px;padding:18px 20px;margin-bottom:22px"><strong style="color:#004080;font-size:13px">Kinshasa Christian School</strong><p style="margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.55">Une communication securisee de KCS Nexus.</p></div><div style="font-size:15px;line-height:1.65;color:#334155">${content}</div><div style="margin-top:26px"><a href="${SCHOOL_URL}" style="display:inline-block;background:#ffcb05;color:#071d3a;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 22px;font-size:14px">Visiter le site KCS</a></div></td></tr>
<tr><td style="background:#004080;padding:20px 28px;text-align:center"><img src="${LOGO_URL}" width="34" height="34" alt="KCS" style="display:inline-block;vertical-align:middle;background:#fff;border-radius:50%;padding:2px"><p style="margin:9px 0 0;color:#fff;font-size:13px;font-weight:700">Kinshasa Christian School</p><p style="margin:5px 0 0;color:#b9d7f7;font-size:11px">Macampagne, Ngaliema · Notification automatisee KCS Nexus</p></td></tr></table></td></tr></table></body></html>`
}

export const sendSchoolMail = async ({ to = env.SCHOOL_EMAIL, replyTo, subject, text, html, attachments }: MailPayload): Promise<MailResult> => {
  if (!transporter) {
    console.warn(`[mail] SMTP is not configured. Email "${subject}" was not sent to ${to}.`)
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const }
  }
  await transporter.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, replyTo, subject, text, html: brandedEmailHtml(subject, text, html), attachments })
  return { sent: true as const }
}