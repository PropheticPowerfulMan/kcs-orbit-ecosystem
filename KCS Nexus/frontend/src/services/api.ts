import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'
import { getRouteUrl } from '@/utils/assets'

export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api')

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

type AuthenticatedUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>
let refreshSessionPromise: Promise<{ token: string; user: AuthenticatedUser }> | null = null

const refreshSession = async () => {
  if (!refreshSessionPromise) {
    const { refreshToken } = useAuthStore.getState()
    if (!refreshToken) throw new Error('No refresh token')
    refreshSessionPromise = axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
      .then((response) => response.data.data)
      .finally(() => { refreshSessionPromise = null })
  }
  return refreshSessionPromise
}

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle token refresh
api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toUpperCase()
    if (method && ['PUT', 'PATCH', 'DELETE'].includes(method)) {
      window.dispatchEvent(new CustomEvent('ecosystem:mutation-success', { detail: { message: response.data?.message || (method === 'DELETE' ? 'Entité supprimée dans le registre partagé.' : 'Modification répercutée dans le registre partagé.') } }))
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const skipAuthLogout = originalRequest?.headers?.['x-skip-auth-logout'] === 'true'

    // A 410 returned by a dashboard resource means that resource is gone; it
    // must not be interpreted as deletion of the signed-in identity. Only the
    // authentication endpoints are allowed to invalidate the whole session.
    const requestPath = originalRequest?.url ?? ''
    const identityNeedsRevalidation = error.response?.status === 410
      && requestPath.includes('/auth/me')
    if (error.response?.status === 401 && skipAuthLogout) {
      return Promise.reject(error)
    }

    if ((error.response?.status === 401 || identityNeedsRevalidation) && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const { refreshToken, token: currentToken } = useAuthStore.getState()
        if (currentToken?.startsWith('demo-') || refreshToken?.startsWith('demo-')) {
          useAuthStore.getState().logout()
          window.location.replace(getRouteUrl('login'))
          return Promise.reject(new Error('Legacy demo session cleared. Please sign in again.'))
        }
        if (!refreshToken) throw new Error('No refresh token')

        const { token, user } = await refreshSession()

        useAuthStore.getState().login(user, token, refreshToken)
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().logout()
        window.location.replace(getRouteUrl('login'))
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

// --- Auth API ---
export const authAPI = {
  login: (identifier: string, password: string, twoFactorCode?: string) =>
    api.post('/auth/login', { email: identifier, password, ...(twoFactorCode ? { twoFactorCode } : {}) }),
  register: (data: object) =>
    api.post('/auth/register', data),
  googleAuth: (token: string) =>
    api.post('/auth/google', { token }),
  forgotPassword: (email: string, channel: 'email' | 'sms' = 'email') =>
    api.post('/auth/forgot-password', { email, channel }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
  me: () =>
    api.get('/auth/me'),
  updateProfile: (data: { firstName?: string; middleName?: string | null; lastName?: string; phone?: string; avatar?: string; bio?: string }) =>
    api.put('/auth/profile', data),
  updateEmail: (data: { newEmail: string; currentPassword?: string }) =>
    api.put('/auth/email', data),
  toggle2FA: (enabled: boolean) =>
    api.post('/auth/2fa/toggle', { enabled }),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (code: string) =>
    api.post('/auth/2fa/verify', { code }),
}

// --- News API ---
export const newsAPI = {
  getAll: (params?: object) => api.get('/news', { params }),
  getById: (id: string) => api.get(`/news/${id}`),
  getBySlug: (slug: string) => api.get(`/news/slug/${slug}`),
  create: (data: object) => api.post('/news', data),
  update: (id: string, data: object) => api.put(`/news/${id}`, data),
  delete: (id: string) => api.delete(`/news/${id}`),
}

// --- Events API ---
export const eventsAPI = {
  getAll: (params?: object) => api.get('/events', { params }),
  getById: (id: string) => api.get(`/events/${id}`),
  create: (data: object) => api.post('/events', data),
  update: (id: string, data: object) => api.put(`/events/${id}`, data),
  updateLiveStream: (id: string, data: object) => api.patch(`/events/${id}/live-stream`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
}

// --- Students API ---
export const studentsAPI = {
  getAll: (params?: object, config?: object) => api.get('/students', { params, ...config }),
  getMyChildren: () => api.get('/students/me/children'),
  getMyOverview: () => api.get('/students/me/overview'),
  getById: (id: string) => api.get(`/students/${id}`),
  create: (data: object) => api.post('/students', data),
  getGrades: (id: string) => api.get(`/students/${id}/grades`),
  getAssignments: (id: string) => api.get(`/students/${id}/assignments`),
  getTimetable: (id: string) => api.get(`/students/${id}/timetable`),
  getAnalytics: (id: string) => api.get(`/students/${id}/analytics`),
  getMyAssignments: () => api.get('/students/me/assignments'),
  getMyTimetable: () => api.get('/students/me/timetable'),
  submitMyAssignment: (submissionId: string, fileName: string) => api.patch(`/students/me/assignments/${submissionId}/submit`, { fileName }),
  update: (id: string, data: object) => api.put(`/students/${id}`, data),
  delete: (id: string) => api.delete(`/students/${id}`),
}

// --- Registry API ---
export const registryAPI = {
  getFamilies: () => api.get('/registry/families'),
  getDirectory: () => api.get('/registry/directory'),
  createEntity: (entityType: 'parent' | 'student' | 'teacher', data: object) => api.post(`/registry/entities/${entityType}`, data),
  updateEntity: (entityType: 'parent' | 'student' | 'teacher', identifier: string, data: object, identifierType: 'orbitId' | 'externalId' = 'orbitId') => api.patch(`/registry/entities/${entityType}/${identifier}`, data, { params: { identifierType } }),
  resetAccess: (entityType: 'parent' | 'student', identifier: string) => api.post(`/registry/entities/${entityType}/${identifier}/reset-access`),
  deleteEntity: (entityType: 'parent' | 'student' | 'teacher', identifier: string, identifierType: 'orbitId' | 'externalId' = 'orbitId') => api.delete(`/registry/entities/${entityType}/${identifier}`, { params: { identifierType } }),
  registerFamily: (data: object) => api.post('/registry/families', data),
}

export const diagnosticAPI = {
  getTests: () => api.get('/diagnostic-tests'),
  createTest: (data: object) => api.post('/diagnostic-tests', data),
  publishTest: (id: string) => api.post(`/diagnostic-tests/${id}/publish`),
  assignTest: (id: string, data: object) => api.post(`/diagnostic-tests/${id}/assign`, data),
  getSubmissions: () => api.get('/diagnostic-submissions'),
  startSubmission: (data: object) => api.post('/diagnostic-submissions/start', data),
  submit: (id: string, answers: object[]) => api.post(`/diagnostic-submissions/${id}/submit`, { answers }),
  approve: (id: string, data: object) => api.post(`/diagnostic-submissions/${id}/approve`, data),
  requestRetake: (id: string, data: object) => api.post(`/diagnostic-submissions/${id}/request-retake`, data),
  getAnalytics: () => api.get('/diagnostic-analytics'),
}

// --- Parent Forum API ---
export const forumAPI = {
  getPosts: () => api.get('/forum/posts'),
  createPost: (data: object) => api.post('/forum/posts', data),
  addComment: (postId: string, data: object) => api.post(`/forum/posts/${postId}/comments`, data),
  getAIReport: () => api.get('/forum/ai-report'),
}

// --- Student Forum API ---
export const studentForumAPI = {
  getPosts: () => api.get('/student-forum/posts'),
  createPost: (data: object) => api.post('/student-forum/posts', data),
  addComment: (postId: string, data: object) => api.post(`/student-forum/posts/${postId}/comments`, data),
  getAIReport: () => api.get('/student-forum/ai-report'),
}

// --- Teachers API ---
export const teachersAPI = {
  getAll: (params?: object) => api.get('/teachers', { params }),
  getById: (id: string) => api.get(`/teachers/${id}`),
  create: (data: object) => api.post('/teachers', data),
  update: (id: string, data: object) => api.put(`/teachers/${id}`, data),
}

export const teacherWorkspaceAPI = {
  overview: () => api.get('/teachers/me/overview'),
  get: () => api.get('/teachers/me/workspace'),
  save: (state: Record<string, unknown>, revision?: number) => api.put('/teachers/me/workspace', { state, revision }),
}

export const suggestionsAPI = {
  submit: (data: { category: string; message: string }) => api.post('/suggestions', data),
  getAll: () => api.get('/suggestions'),
  updateStatus: (id: string, status: 'New' | 'Under review' | 'Resolved') => api.patch(`/suggestions/${id}/status`, { status }),
}

// --- Courses API ---
export const coursesAPI = {
  getAll: (params?: object) => api.get('/courses', { params }),
  getById: (id: string) => api.get(`/courses/${id}`),
  create: (data: object) => api.post('/courses', data),
  update: (id: string, data: object) => api.put(`/courses/${id}`, data),
  delete: (id: string) => api.delete(`/courses/${id}`),
}

// --- Admissions API ---
export const admissionsAPI = {
  getAll: (params?: object) => api.get('/admissions', { params }),
  getById: (id: string) => api.get(`/admissions/${id}`),
  getByNumber: (number: string) => api.get(`/admissions/track/${number}`),
  create: (data: object | FormData) =>
    api.post('/admissions', data),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/admissions/${id}/status`, { status, notes }),
  approve: (id: string) => api.post('/admissions/' + id + '/approve'),
  uploadDocument: (id: string, formData: FormData) =>
    api.post(`/admissions/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// --- Media API ---
export const mediaAPI = {
  getAll: (params?: object) => api.get('/media', { params }),
  getCategories: () => api.get('/media/categories'),
  upload: (formData: FormData) =>
    api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: string) => api.delete(`/media/${id}`),
}

// --- Contact API ---
export const contactAPI = {
  send: (data: object) => api.post('/contact', data),
}

// --- Notifications API ---
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
}

// --- AI API ---
export const aiAPI = {
  chat: (messages: object[], language?: string) =>
    api.post('/ai/chat', { messages, language }),
  teacherAssistant: (
    task: 'lesson-plan' | 'quiz' | 'feedback' | 'intervention' | 'meeting-summary',
    context?: string,
  ) => api.post('/ai/teacher-assistant', { task, context }),
  tutor: (subject: string, question: string, studentId?: string) =>
    api.post('/ai/tutor', { subject, question, studentId }),
  generateQuiz: (subject: string, topic: string, difficulty: string) =>
    api.post('/ai/quiz', { subject, topic, difficulty }),
  getRecommendations: (studentId: string) =>
    api.get(`/ai/recommendations/${studentId}`),
  analyzePerformance: (studentId: string) =>
    api.get(`/ai/analytics/${studentId}`),
}

// --- Admin API ---
export const adminAPI = {
  getOverview: () => api.get('/admin/overview'),
  getStaffOverview: () => api.get('/admin/staff-overview'),
  getDashboardStats: () => api.get('/admin/stats'),
  getAnalytics: (period?: string) => api.get('/admin/analytics', { params: { period } }),
  exportData: (type: string) => api.get(`/admin/export/${type}`, { responseType: 'blob' }),
}

export const dataMigrationAPI = {
  preview: (data: FormData) => api.post('/data-migration/preview', data),
  jobs: () => api.get('/data-migration/jobs'),
  job: (id: string) => api.get(`/data-migration/jobs/${id}`),
  confirmation: (id: string) => api.get(`/data-migration/jobs/${id}/confirmation`),
  confirm: (id: string, data: { confirmation: string; batchSize?: number }) => api.post(`/data-migration/jobs/${id}/confirm`, data),
  rollback: (id: string, confirmation: string) => api.post(`/data-migration/jobs/${id}/rollback`, { confirmation }),
  mappingTemplates: () => api.get('/data-migration/mapping-templates'),
  saveMappingTemplate: (data: object) => api.post('/data-migration/mapping-templates', data),
  errorReport: (id: string) => api.get(`/data-migration/jobs/${id}/errors.csv`, { responseType: 'blob' }),
  successReport: (id: string) => api.get(`/data-migration/jobs/${id}/success.csv`, { responseType: 'blob' }),
  rollbackReport: (id: string) => api.get(`/data-migration/jobs/${id}/rollback.csv`, { responseType: 'blob' }),
  template: (entity: string) => api.get(`/data-migration/templates/${entity}`, { responseType: 'blob' }),
}

export const financeAPI = {
  getEduPaySummary: () => api.get('/finance/edupay-summary'),
  getStudentClearance: () => api.get('/finance/student-clearance'),
}

export const messagesAPI = {
  getAll: (params?: { q?: string; box?: string }) => api.get('/messages', { params }),
  getContacts: () => api.get('/messages/contacts'),
  send: (data: { recipientId: string; subject: string; body: string }) => api.post('/messages', data),
  markRead: (id: string) => api.patch(`/messages/${id}/read`),
}


export const incidentReportsAPI = {
  list: () => api.get('/incident-reports'),
  create: (data: FormData) => api.post('/incident-reports', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  attachment: (id: string) => api.get(`/incident-reports/${id}/attachment`, { responseType: 'blob' }),
  updateStatus: (id: string, data: { status: 'SUBMITTED' | 'UNDER_REVIEW' | 'CLOSED'; adminNotes?: string }) => api.patch(`/incident-reports/${id}/status`, data),
  verify: (reference: string) => api.get(`/incident-reports/verify/${encodeURIComponent(reference)}`),
}

export const academyAPI = {
  launch: () => api.post<{ data: { url: string } }>("/academy/launch"),
}
