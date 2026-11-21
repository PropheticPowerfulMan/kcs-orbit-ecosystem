import {resilientFetch} from './resilientFetch'
const API_BASE = import.meta.env.VITE_API_URL || '/kitchen/api'

const TOKEN_KEY = 'kcs-kitchen-token'
export function getToken() {
  const isolated = sessionStorage.getItem(TOKEN_KEY)
  if (isolated) return isolated
  const legacy = localStorage.getItem(TOKEN_KEY)
  if (!legacy) return null
  sessionStorage.setItem(TOKEN_KEY, legacy)
  localStorage.removeItem(TOKEN_KEY)
  return legacy
}
export function setToken(token: string | null) {
  localStorage.removeItem(TOKEN_KEY)
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return resilientFetch<T>(API_BASE+path,{
    ...options,
    headers:{'content-type':'application/json',...(getToken()?{authorization:'Bearer '+getToken()}:{}),...(options.headers||{})},
  },async response=>{
    const body=await response.json().catch(()=>({}))
    if(!response.ok)throw Object.assign(new Error(body.message||'Request failed'),{status:response.status,fields:body.fields})
    return body as T
  })
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await resilientFetch(API_BASE + path, {
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
