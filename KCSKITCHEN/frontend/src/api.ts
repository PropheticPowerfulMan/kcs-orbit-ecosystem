const API_BASE = import.meta.env.VITE_API_URL || '/kitchen/api'

export function getToken() { return localStorage.getItem('kcs-kitchen-token') }
export function setToken(token: string | null) {
  if (token) localStorage.setItem('kcs-kitchen-token', token)
  else localStorage.removeItem('kcs-kitchen-token')
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = String(options.method || 'GET').toUpperCase()
  const attempts = method === 'GET' ? 3 : 1
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch(API_BASE + path, {
        ...options,
        signal: options.signal || controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(getToken() ? { authorization: 'Bearer ' + getToken() } : {}),
          ...(options.headers || {})
        }
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw Object.assign(new Error(body.message || 'Request failed'), { status: response.status, fields: body.fields })
      return body as T
    } catch (error: any) {
      lastError = error
      const retryable = method === 'GET' && (!error?.status || error.status >= 500)
      if (!retryable || attempt === attempts - 1) throw error
      await new Promise(resolve => window.setTimeout(resolve, 500 * (2 ** attempt)))
    } finally {
      window.clearTimeout(timeout)
    }
  }
  throw lastError
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(API_BASE + path, {
    headers: getToken() ? { authorization: 'Bearer ' + getToken() } : {}
  })
  if (!response.ok) throw new Error('Official profile photo is unavailable')
  return response.blob()
}

export function money(value: unknown, currency = 'CDF') {
  return new Intl.NumberFormat('fr-CD', { style: 'currency', currency, maximumFractionDigits: currency === 'CDF' ? 0 : 2 }).format(Number(value || 0))
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat(document.documentElement.lang || 'fr', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
