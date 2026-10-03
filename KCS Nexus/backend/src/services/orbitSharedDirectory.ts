import { env } from '../config/env.js'
import { ApiError } from '../utils/api.js'

export type OrbitExternalId = {
  appSlug: string
  externalId: string
}

export type OrbitFamilyContact = {
  kind?: string
  firstName?: string
  middleName?: string | null
  lastName?: string
  relationship?: string
  role?: string
  email?: string | null
  phone?: string | null
  physicalAddress?: string
  authorizedPickup?: boolean
  emergencyContact?: boolean
}

export type OrbitDirectoryParent = {
  id: string
  displayId?: string | null
  fullName: string
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  phone?: string | null
  email?: string | null
  photoData?: string | null
  accessCode?: string | null
  familyContacts?: OrbitFamilyContact[]
  mustChangePassword?: boolean
  organizationId?: string | null
  studentIds: string[]
  externalIds: OrbitExternalId[]
}

export type OrbitDirectoryStudent = {
  id: string
  displayId?: string | null
  fullName: string
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  studentNumber?: string | null
  email?: string | null
  phone?: string | null
  dateOfBirth?: string | null
  status?: string | null
  photoData?: string | null
  accessCode?: string | null
  mustChangePassword?: boolean
  classId?: string | null
  className?: string | null
  parentId?: string | null
  organizationId?: string | null
  externalIds: OrbitExternalId[]
}

export type OrbitDirectoryTeacher = {
  id: string
  displayId?: string | null
  fullName: string
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  phone?: string | null
  email?: string | null
  photoData?: string | null
  accessCode?: string | null
  subject?: string | null
  employeeId?: string | null
  employeeType?: string | null
  department?: string | null
  jobTitle?: string | null
  mustChangePassword?: boolean
  organizationId?: string | null
  externalIds: OrbitExternalId[]
}

export type OrbitSharedDirectory = {
  source: 'orbit'
  visibility: 'shared-directory'
  counts: {
    families: number
    parents: number
    students: number
    teachers: number
  }
  families?: unknown[]
  parents: OrbitDirectoryParent[]
  students: OrbitDirectoryStudent[]
  teachers: OrbitDirectoryTeacher[]
}

type DirectoryCacheEntry = {
  value: OrbitSharedDirectory
  generation: number
  freshUntil: number
  staleUntil: number
}

type DirectoryFlight = {
  generation: number
  requireFresh: boolean
  promise: Promise<OrbitSharedDirectory>
}

const FRESH_TTL_MS = 30_000
const STALE_WHILE_REVALIDATE_MS = 5 * 60_000
const FAILURE_RETRY_TTL_MS = 15_000
const WARM_ORBIT_TIMEOUT_MS = 5_000
const COLD_ORBIT_TIMEOUT_MS = 12_000

let cacheGeneration = 0
let directoryCache: DirectoryCacheEntry | null = null
let lastCoherentDirectory: OrbitSharedDirectory | null = null
let directoryFlight: DirectoryFlight | null = null

function normalizeExternalIds(value: unknown): OrbitExternalId[] {
  return Array.isArray(value) ? value as OrbitExternalId[] : []
}

function canonicalSharedDirectory(value: unknown): OrbitSharedDirectory {
  const payload = value && typeof value === 'object'
    ? value as Partial<OrbitSharedDirectory>
    : {}
  const parents = Array.isArray(payload.parents)
    ? payload.parents.map((parent) => ({
        ...parent,
        studentIds: Array.isArray(parent.studentIds) ? parent.studentIds : [],
        externalIds: normalizeExternalIds(parent.externalIds),
      }))
    : []
  const students = Array.isArray(payload.students)
    ? payload.students.map((student) => ({
        ...student,
        externalIds: normalizeExternalIds(student.externalIds),
      }))
    : []
  const teachers = Array.isArray(payload.teachers)
    ? payload.teachers.map((teacher) => ({
        ...teacher,
        externalIds: normalizeExternalIds(teacher.externalIds),
      }))
    : []
  const families = Array.isArray(payload.families) ? payload.families : undefined

  return {
    ...payload,
    source: 'orbit',
    visibility: 'shared-directory',
    counts: {
      families: families?.length ?? parents.length,
      parents: parents.length,
      students: students.length,
      teachers: teachers.length,
    },
    ...(families ? { families } : {}),
    parents,
    students,
    teachers,
  }
}

function cacheDirectory(value: OrbitSharedDirectory, generation: number, freshForMs = FRESH_TTL_MS) {
  if (generation !== cacheGeneration) return
  const now = Date.now()
  directoryCache = {
    value,
    generation,
    freshUntil: now + freshForMs,
    staleUntil: now + freshForMs + STALE_WHILE_REVALIDATE_MS,
  }
}

function coherentPopulation(directory: OrbitSharedDirectory) {
  return directory.parents.length + directory.students.length
}

type DirectoryCollectionName = 'parents' | 'students' | 'teachers'

function protectDirectoryCollection<T>(
  collection: DirectoryCollectionName,
  next: T[],
  previous: T[] | undefined,
) {
  if (!previous?.length) return { value: next, protected: false }
  const collapsedToEmpty = next.length === 0
  const abnormallyShrunk = previous.length >= 10 && next.length < Math.floor(previous.length * 0.7)
  if (!collapsedToEmpty && !abnormallyShrunk) return { value: next, protected: false }
  console.warn('[orbit-directory] Abnormal collection collapse blocked', {
    collection,
    previousCount: previous.length,
    nextCount: next.length,
  })
  return { value: previous, protected: true }
}

function strictCollectionCollapse(
  collection: DirectoryCollectionName,
  nextLength: number,
  previousLength: number | undefined,
) {
  if (!previousLength) return
  const collapsedToEmpty = nextLength === 0
  const abnormallyShrunk = previousLength >= 10 && nextLength < Math.floor(previousLength * 0.7)
  if (!collapsedToEmpty && !abnormallyShrunk) return
  throw new ApiError(
    503,
    `Orbit strict freshness check rejected an incomplete ${collection} collection (${nextLength}/${previousLength}). No cached directory was used.`,
  )
}

/**
 * Strict reads are used immediately before a registry write. They must represent
 * the response just received from Orbit: no stale collection may be substituted.
 */
export function validateStrictFreshOrbitSharedDirectory(
  next: OrbitSharedDirectory,
  previous: OrbitSharedDirectory | null,
) {
  strictCollectionCollapse('parents', next.parents.length, previous?.parents.length)
  strictCollectionCollapse('students', next.students.length, previous?.students.length)
  strictCollectionCollapse('teachers', next.teachers.length, previous?.teachers.length)
  if (!next.teachers.length && (next.parents.length > 0 || next.students.length > 0)) {
    throw new ApiError(503, 'Orbit strict freshness check rejected an incomplete shared directory without teachers. No cached directory was used.')
  }
  return next
}

/**
 * Reconciles each registry population independently. A healthy student payload must
 * never legitimize an empty/partial teacher (or parent) collection.
 */
export function reconcileOrbitSharedDirectory(
  next: OrbitSharedDirectory,
  previous: OrbitSharedDirectory | null,
): OrbitSharedDirectory {
  const parents = protectDirectoryCollection('parents', next.parents, previous?.parents)
  const students = protectDirectoryCollection('students', next.students, previous?.students)
  const teachers = protectDirectoryCollection('teachers', next.teachers, previous?.teachers)

  if (!teachers.value.length && (parents.value.length > 0 || students.value.length > 0)) {
    throw new ApiError(503, 'Orbit returned an incomplete shared directory without teachers; the snapshot was rejected.')
  }

  const preservePreviousFamilies = parents.protected && previous?.families
  const families = preservePreviousFamilies || next.families
  return {
    ...next,
    ...(families ? { families } : {}),
    parents: parents.value,
    students: students.value,
    teachers: teachers.value,
    counts: {
      families: families?.length ?? parents.value.length,
      parents: parents.value.length,
      students: students.value.length,
      teachers: teachers.value.length,
    },
  }
}

async function fetchSharedDirectory(generation: number, requireFresh = false) {
  const timeoutMs = lastCoherentDirectory || directoryCache
    ? WARM_ORBIT_TIMEOUT_MS
    : COLD_ORBIT_TIMEOUT_MS
  const response = await fetch(
    env.KCS_ORBIT_API_URL!.replace(/\/$/, '')
      + '/api/integration/read/shared-directory?organizationId='
      + encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID!),
    {
      headers: {
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
      signal: AbortSignal.timeout(timeoutMs),
    },
  )

  if (!response.ok) {
    throw new ApiError(response.status, 'Orbit shared directory request failed with status ' + response.status)
  }

  const canonical = canonicalSharedDirectory(await response.json())
  if (generation !== cacheGeneration) {
    if (requireFresh) {
      throw new ApiError(409, 'Orbit directory changed during the strict freshness check. Retry with a new live snapshot before writing.')
    }
    return canonical
  }

  const value = requireFresh
    ? validateStrictFreshOrbitSharedDirectory(canonical, lastCoherentDirectory)
    : reconcileOrbitSharedDirectory(canonical, lastCoherentDirectory)
  if (coherentPopulation(value) > 0 && value.teachers.length > 0) lastCoherentDirectory = value
  cacheDirectory(value, generation)
  return value
}
async function refreshSharedDirectory(generation: number, requireFresh = false) {
  try {
    return await fetchSharedDirectory(generation, requireFresh)
  } catch (error) {
    if (generation !== cacheGeneration) throw error
    if (requireFresh) {
      if (error instanceof ApiError) throw error
      const reason = error instanceof Error ? error.message : 'unknown Orbit transport failure'
      throw new ApiError(503, `Orbit strict freshness check could not obtain a live directory: ${reason}`)
    }
    const fallback = lastCoherentDirectory ?? directoryCache?.value
    if (!fallback) throw error
    console.warn('[orbit-directory] Orbit unavailable; serving the last coherent directory')
    cacheDirectory(fallback, generation, FAILURE_RETRY_TTL_MS)
    return fallback
  }
}

function startDirectoryRefresh(generation: number, requireFresh = false) {
  if (directoryFlight?.generation === generation && directoryFlight.requireFresh === requireFresh) return directoryFlight.promise

  const promise = refreshSharedDirectory(generation, requireFresh)
  directoryFlight = { generation, requireFresh, promise }
  const clearFlight = () => {
    if (directoryFlight?.promise === promise) directoryFlight = null
  }
  promise.then(clearFlight, clearFlight)
  return promise
}

export function invalidateOrbitSharedDirectory() {
  cacheGeneration += 1
  directoryCache = null
}

export async function getOrbitSharedDirectory(force = false, requireFresh = false) {
  const generation = cacheGeneration
  const now = Date.now()
  const cache = directoryCache?.generation === generation ? directoryCache : null

  // A strict read always reaches Orbit now. It never consumes a cache entry and
  // refreshSharedDirectory deliberately refuses the resilient fallback path.
  if (requireFresh) return startDirectoryRefresh(generation, true)

  if (!force && cache?.freshUntil && cache.freshUntil > now) return cache.value

  if (!force && cache?.staleUntil && cache.staleUntil > now) {
    void startDirectoryRefresh(generation).catch((error) => {
      console.warn('[orbit-directory] Background refresh failed without a usable fallback', error)
    })
    return cache.value
  }

  return startDirectoryRefresh(generation)
}
