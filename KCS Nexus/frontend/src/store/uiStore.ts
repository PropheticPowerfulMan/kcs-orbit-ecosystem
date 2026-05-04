import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Theme, Language, Notification } from '@/types'

interface UIStore {
  theme: Theme
  language: Language
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  notifications: Notification[]
  unreadCount: number
  chatOpen: boolean
  searchOpen: boolean

  // Actions
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setLanguage: (language: Language) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapse: () => void
  addNotification: (notification: Notification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
  toggleChat: () => void
  toggleSearch: () => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      language: 'en',
      sidebarOpen: false,
      sidebarCollapsed: false,
      notifications: [],
      unreadCount: 0,
      chatOpen: false,
      searchOpen: false,

      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },

      toggleTheme: () => {
        const current = get().theme
        const next = current === 'light' ? 'dark' : 'light'
        set({ theme: next })
        applyTheme(next)
      },

      setLanguage: (language) => set({ language }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      toggleSidebarCollapse: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
          unreadCount: state.unreadCount + 1,
        })),

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        })),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

      toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),

      toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),
    }),
    {
      name: 'kcs-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}
