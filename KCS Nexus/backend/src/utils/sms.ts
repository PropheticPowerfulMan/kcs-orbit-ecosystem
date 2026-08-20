import { env } from '../config/env.js'

export type SmsResult =
  | { sent: true }
  | { sent: false; reason: 'PHONE_MISSING' | 'SMS_NOT_CONFIGURED' | 'SMS_SEND_FAILED' }

export async function sendSchoolSms(to: string | null | undefined, message: string): Promise<SmsResult> {
  const phone = (to || '').replace(/[\s()-]/g, '')
  if (!phone) return { sent: false, reason: 'PHONE_MISSING' }
  if (!env.SMS_API_URL || !env.SMS_API_KEY) {
    console.warn(`[sms] SMS is not configured. Message was not sent to ${phone}.`)
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' }
  }
  try {
    const isAfricasTalking = /africastalking/i.test(env.SMS_API_URL)
    const body = isAfricasTalking
      ? new URLSearchParams({ username: env.SMS_USERNAME || 'sandbox', to: phone, message, ...(env.SMS_SENDER ? { from: env.SMS_SENDER } : {}) })
      : JSON.stringify({ to: phone, message, sender: env.SMS_SENDER })
    const response = await fetch(env.SMS_API_URL, {
      method: 'POST',
      headers: isAfricasTalking
        ? { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', apiKey: env.SMS_API_KEY }
        : { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${env.SMS_API_KEY}` },
      body,
    })
    if (!response.ok) throw new Error(`SMS provider responded with ${response.status}`)
    return { sent: true }
  } catch (error) {
    console.error('[sms] Delivery failed', error)
    return { sent: false, reason: 'SMS_SEND_FAILED' }
  }
}
