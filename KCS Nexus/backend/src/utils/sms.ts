import { env } from '../config/env.js'

export type SmsResult =
  | { sent: true }
  | { sent: false; reason: 'PHONE_MISSING' | 'SMS_NOT_CONFIGURED' | 'SMS_SEND_FAILED' }

export async function sendSchoolSms(to: string | null | undefined, message: string): Promise<SmsResult> {
  const phone = (to || '').replace(/[\s()-]/g, '')
  const apiUrl = env.AFRICASTALKING_API_URL || env.SMS_API_URL
  const apiKey = env.AFRICASTALKING_API_KEY || env.SMS_API_KEY
  const username = env.AFRICASTALKING_USERNAME || env.SMS_USERNAME
  const sender = env.AFRICASTALKING_SENDER || env.SMS_SENDER
  if (!phone) return { sent: false, reason: 'PHONE_MISSING' }
  if (!apiUrl || !apiKey || !username) {
    console.warn(`[sms] SMS is not configured. Message was not sent to ${phone}.`)
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' }
  }
  try {
    const isAfricasTalking = /africastalking/i.test(apiUrl)
    const body = isAfricasTalking
      ? new URLSearchParams({ username, to: phone, message, ...(sender ? { from: sender } : {}) })
      : JSON.stringify({ to: phone, message, sender })
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: isAfricasTalking
        ? { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', apiKey }
        : { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body,
    })
    if (!response.ok) throw new Error(`SMS provider responded with ${response.status}`)
    return { sent: true }
  } catch (error) {
    console.error('[sms] Delivery failed', error)
    return { sent: false, reason: 'SMS_SEND_FAILED' }
  }
}
