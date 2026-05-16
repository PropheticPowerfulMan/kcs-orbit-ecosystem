import { env } from '../config/env.js'

type AcademicEventEnvelope = {
  organizationId?: string
  externalId?: string
  sourceApp: 'KCS_NEXUS'
  occurredAt: string
  version: '1.0.0'
  payload: Record<string, unknown>
}

export const savanexIntelligenceIsEnabled = () => Boolean(env.SAVANEX_API_URL && env.SAVANEX_INTELLIGENCE_API_KEY)

export const sendAcademicEventToSavanex = async (payload: Record<string, unknown>) => {
  const envelope: AcademicEventEnvelope = {
    organizationId: env.KCS_ORBIT_ORGANIZATION_ID,
    externalId: String(payload.id ?? payload.gradeId ?? payload.assignmentId ?? payload.studentId ?? Date.now()),
    sourceApp: 'KCS_NEXUS',
    occurredAt: new Date().toISOString(),
    version: '1.0.0',
    payload,
  }

  if (!savanexIntelligenceIsEnabled()) {
    return {
      delivered: false,
      reason: 'Missing SAVANEX_API_URL or SAVANEX_INTELLIGENCE_API_KEY',
      envelope,
    }
  }

  const response = await fetch(`${env.SAVANEX_API_URL!.replace(/\/$/, '')}/api/intelligence/ingest/nexus/academic/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.SAVANEX_INTELLIGENCE_API_KEY!,
      'x-app-slug': 'KCS_NEXUS',
    },
    body: JSON.stringify(envelope),
  })

  const body = await response.text()
  return {
    delivered: response.ok,
    status: response.status,
    response: body,
    envelope,
  }
}
