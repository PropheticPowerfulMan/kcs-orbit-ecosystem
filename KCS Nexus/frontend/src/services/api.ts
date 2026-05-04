import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'
import { getRouteUrl } from '@/utils/assets'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api')

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

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
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const { refreshToken, token: currentToken } = useAuthStore.getState()
        if (currentToken?.startsWith('demo-') || refreshToken?.startsWith('demo-')) {
          return Promise.reject(error)
        }
        if (!refreshToken) throw new Error('No refresh token')

        const response = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
        const { token, user } = response.data.data

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
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: object) =>
    api.post('/auth/register', data),
  googleAuth: (token: string) =>
    api.post('/auth/google', { token }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
  me: () =>
    api.get('/auth/me'),
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
  getAll: (params?: object) => api.get('/students', { params }),
  getById: (id: string) => api.get(`/students/${id}`),
  create: (data: object) => api.post('/students', data),
  getGrades: (id: string) => api.get(`/students/${id}/grades`),
  getAssignments: (id: string) => api.get(`/students/${id}/assignments`),
  getTimetable: (id: string) => api.get(`/students/${id}/timetable`),
  getAnalytics: (id: string) => api.get(`/students/${id}/analytics`),
  update: (id: string, data: object) => api.put(`/students/${id}`, data),
  delete: (id: string) => api.delete(`/students/${id}`),
}

// --- Registry API ---
export const registryAPI = {
  getFamilies: () => api.get('/registry/families'),
  registerFamily: (data: object) => api.post('/registry/families', data),
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
  getDashboardStats: () => api.get('/admin/stats'),
  getAnalytics: (period?: string) => api.get('/admin/analytics', { params: { period } }),
  exportData: (type: string) => api.get(`/admin/export/${type}`, { responseType: 'blob' }),
}
