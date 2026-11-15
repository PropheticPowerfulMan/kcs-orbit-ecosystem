import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { academicCalendarAPI,api } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

export type PublishedPeriod = { type: 'SEMESTER' | 'QUARTER'; sequence: number; code: string; name: string; startDate: string; endDate: string }
export type PublishedCalendar = { name: string; startDate: string; endDate: string; isCurrent: boolean; status: string; periods: PublishedPeriod[]; updatedAt?: string }
export const CALENDAR_PUBLISHED_EVENT = 'kcs-academic-calendar-published'
const signalKey = 'kcs:academic-calendar:published'
export function notifyAcademicCalendarPublished() {
  window.dispatchEvent(new Event(CALENDAR_PUBLISHED_EVENT))
  window.dispatchEvent(new Event('kcs-academic-period-closed'))
  window.dispatchEvent(new Event('kcs-attendance-calendar-updated'))
  try { localStorage.setItem(signalKey, `${Date.now()}-${Math.random()}`) } catch { /* Server refresh remains available. */ }
}
export function calendarFingerprint(calendar: PublishedCalendar) {
  return JSON.stringify([calendar.name, calendar.startDate, calendar.endDate, calendar.isCurrent, calendar.status,
    [...(calendar.periods || [])].sort((a, b) => a.type.localeCompare(b.type) || a.sequence - b.sequence).map(p => [p.type, p.sequence, p.code, p.name, p.startDate, p.endDate])])
}
export function usePublishedAcademicCalendar(publicView=false) {
  const userId = useAuthStore(state => state.user?.id || '')
  const query = useQuery({
    queryKey: ['published-academic-calendar', publicView?'public':userId],
    enabled: publicView||Boolean(userId), staleTime: 15_000, refetchInterval: 30_000,
    refetchOnWindowFocus: true, refetchOnReconnect: true, retry: 1,
    queryFn: async () => {
      const { data } = await (publicView?api.get('/published-school-calendar'):academicCalendarAPI.current())
      const calendar = data.calendar as PublishedCalendar
      if (!calendar?.name || !calendar.startDate || !calendar.endDate || !Array.isArray(calendar.periods)) throw new Error('Published academic calendar unavailable')
      return calendar
    },
  })
  const { refetch } = query
  useEffect(() => {
    const refresh = () => { void refetch() }
    const sync = (event: StorageEvent) => { if (event.key === signalKey) { window.dispatchEvent(new Event('kcs-academic-period-closed')); window.dispatchEvent(new Event('kcs-attendance-calendar-updated')); refresh() } }
    window.addEventListener(CALENDAR_PUBLISHED_EVENT, refresh)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(CALENDAR_PUBLISHED_EVENT, refresh); window.removeEventListener('storage', sync) }
  }, [refetch])
  return { calendar: query.data, loading: query.isPending, refreshing: query.isFetching, error: query.isError, refresh: refetch }
}
