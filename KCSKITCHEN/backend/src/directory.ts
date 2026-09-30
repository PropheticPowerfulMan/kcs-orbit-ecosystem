import { env } from './config.js'
import { classifyDirectoryEmployee } from './identity.js'
import { normalizeClassName } from './class-name.js'

export type DirectoryPerson = {
  id: string
  displayId?: string
  fullName: string
  email?: string | null
  phone?: string | null
  status?: string | null
  className?: string | null
  accessCode?: string | null
  employeeType?: string | null
  department?: string | null
  jobTitle?: string | null
  subject?: string | null
  photoData?: string | null
  kind: 'STUDENT' | 'TEACHER' | 'STAFF'
}

type Directory = {
  students: Array<Omit<DirectoryPerson, 'kind'>>
  teachers: Array<Omit<DirectoryPerson, 'kind'>>
  staff?: Array<Omit<DirectoryPerson, 'kind'>>
}

let cached: { at: number; people: DirectoryPerson[] } | null = null

export async function loadDirectory(force = false): Promise<DirectoryPerson[]> {
  const ttl = env.DIRECTORY_CACHE_SECONDS * 1000
  if (!force && cached && Date.now() - cached.at < ttl) return cached.people
  const url = new URL('/api/integration/read/shared-directory', env.ORBIT_API_URL)
  url.searchParams.set('organizationId', env.ORBIT_ORGANIZATION_ID)
  try {
    const response = await fetch(url, {
      headers: { 'x-api-key': env.ORBIT_API_KEY, 'x-app-slug': 'KCS_KITCHEN' },
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) throw new Error('Orbit directory returned ' + response.status)
    const body = await response.json() as Directory
    const people: DirectoryPerson[] = [
      ...(body.students || []).map(person => ({ ...person, className: normalizeClassName(person.className), kind: 'STUDENT' as const })),
      ...(body.teachers || []).map(person => ({ ...person, kind: classifyDirectoryEmployee(person) })),
      ...(body.staff || []).map(person => ({ ...person, kind: 'STAFF' as const }))
    ].filter(person => !person.status || person.status === 'ACTIVE')
    cached = { at: Date.now(), people }
    return people
  } catch (error) {
    if (cached && Date.now() - cached.at < 15 * 60_000) return cached.people
    throw error
  }
}

export async function resolvePerson(identifier: string) {
  const needle = identifier.trim().toLowerCase()
  const people = await loadDirectory()
  return people.find(person =>
    person.id.toLowerCase() === needle ||
    person.email?.toLowerCase() === needle ||
    person.accessCode?.toLowerCase() === needle ||
    person.displayId?.toLowerCase() === needle
  ) || null
}
