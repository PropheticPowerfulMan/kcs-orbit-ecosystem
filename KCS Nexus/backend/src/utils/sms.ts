import { env } from '../config/env.js'

export type SmsResult =
  | { sent: true }
  | { sent: false; reason: 'PHONE_MISSING' | 'SMS_NOT_CONFIGURED' | 'SMS_SEND_FAILED' }

export async function sendSchoolSms(to: string | null | undefined, message: string, options: { brand?: boolean } = {}): Promise<SmsResult> {
  const phone = (to || '').replace(/[\s()-]/g, '')
  const cleanMessage = message.normalize('NFC').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const outboundMessage = options.brand === false
    ? cleanMessage
    : (/^\s*(?:\[?KCS Nexus\]?\s*[:—-])/i.test(cleanMessage) ? cleanMessage : `KCS Nexus : ${cleanMessage}`)
  const apiUrl = env.AFRICASTALKING_API_URL || env.SMS_API_URL
  const apiKey = env.AFRICASTALKING_API_KEY || env.SMS_API_KEY
  const username = env.AFRICASTALKING_USERNAME || env.SMS_USERNAME
  const isAfricasTalkingApi = /africastalking/i.test(apiUrl || '')
  const sender = isAfricasTalkingApi ? env.AFRICASTALKING_SENDER : env.SMS_SENDER
  if (!phone) return { sent: false, reason: 'PHONE_MISSING' }
  if (!apiUrl || !apiKey || !username) {
    console.warn(`[sms] SMS is not configured. Message was not sent to ${phone}.`)
    return { sent: false, reason: 'SMS_NOT_CONFIGURED' }
  }
  try {
    const isAfricasTalking = isAfricasTalkingApi
    const submit = async (includeSender: boolean) => {
      const body = isAfricasTalking
        ? new URLSearchParams({ username, to: phone, message: outboundMessage, ...(includeSender && sender ? { from: sender } : {}) })
        : JSON.stringify({ to: phone, message: outboundMessage, sender })
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: isAfricasTalking
          ? { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', apiKey }
          : { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body,
      })
      return { response, responseText: await response.text() }
    }
    const providerResult = (response: Response, responseText: string) => {
      if (!response.ok) return { accepted: false, summary: `HTTP ${response.status}` }
      if (!isAfricasTalking) return { accepted: true, summary: 'accepted' }
      let payload: any = {}
      try { payload = JSON.parse(responseText || '{}') } catch { return { accepted: false, summary: 'invalid provider response' } }
      const recipients = Array.isArray(payload?.SMSMessageData?.Recipients) ? payload.SMSMessageData.Recipients : []
      const accepted = recipients.some((recipient: any) =>
        String(recipient?.statusCode || '') === '101'
        || /success|sent|submitted/i.test(String(recipient?.status || ''))
      )
      const summary = recipients.map((recipient: any) => `${String(recipient?.statusCode || 'unknown')}:${String(recipient?.status || 'unknown')}`).join(', ') || 'no recipient status'
      return { accepted, summary }
    }

    let submission = await submit(Boolean(sender))
    let result = providerResult(submission.response, submission.responseText)
    if (result.accepted) return { sent: true }

    const senderRejected = Boolean(sender) && /sender|from|short ?code|not allowed|not registered|invalid/i.test(submission.responseText)
    if (isAfricasTalking && senderRejected) {
      console.warn('[sms] Sender ID rejected; retrying without Sender ID', { providerStatus: result.summary })
      submission = await submit(false)
      result = providerResult(submission.response, submission.responseText)
      if (result.accepted) return { sent: true }
    }
    console.error('[sms] Provider rejected delivery', { providerStatus: result.summary })
    return { sent: false, reason: 'SMS_SEND_FAILED' }

  } catch (error) {
    console.error('[sms] Delivery failed', error)
    return { sent: false, reason: 'SMS_SEND_FAILED' }
  }
}
