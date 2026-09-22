const API_BASE = import.meta.env.VITE_API_URL || '/kitchen/api'

export function getToken() { return localStorage.getItem('kcs-kitchen-token') }
export function setToken(token: string | null) {
  if (token) localStorage.setItem('kcs-kitchen-token', token)
  else localStorage.removeItem('kcs-kitchen-token')
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: 'Bearer ' + getToken() } : {}),
      ...(options.headers || {})
    }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(body.message || 'Request failed'), { status: response.status, fields: body.fields })
  return body as T
}

export function money(value: unknown, currency = 'CDF') {
  return new Intl.NumberFormat('fr-CD', { style: 'currency', currency, maximumFractionDigits: currency === 'CDF' ? 0 : 2 }).format(Number(value || 0))
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat(document.documentElement.lang || 'fr', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
