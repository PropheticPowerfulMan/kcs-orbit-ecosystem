import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, UserRole } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Actions
  login: (user: User, token: string, refreshToken: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setLoading: (loading: boolean) => void
  hasRole: (role: UserRole | UserRole[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: (user, token, refreshToken) => {
        set({ user, token, refreshToken, isAuthenticated: true, isLoading: false })
      },

      logout: () => {
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
        // Clear any cached data
        if (typeof window !== 'undefined') {
          sessionStorage.clear()
        }
      },

      updateUser: (updates) => {
        const current = get().user
        if (current) {
          set({ user: { ...current, ...updates } })
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

      hasRole: (role) => {
        const user = get().user
        if (!user) return false
        if (Array.isArray(role)) {
          return role.includes(user.role)
        }
        return user.role === role
      },
    }),
    {
      name: 'kcs-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
