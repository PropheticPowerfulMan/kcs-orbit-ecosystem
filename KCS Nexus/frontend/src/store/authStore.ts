import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { User, UserRole } from '@/types'

if (typeof window !== 'undefined' && localStorage.getItem('kcs-auth')?.includes('demo-access-token')) {
  localStorage.removeItem('kcs-auth')
}

const resilientAuthStorage: StateStorage = {
  getItem: (name) => sessionStorage.getItem(name) ?? localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
      sessionStorage.removeItem(name)
    } catch {
      localStorage.removeItem(name)
      sessionStorage.setItem(name, value)
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name)
    sessionStorage.removeItem(name)
  },
}

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
        set({
          user: { ...user, role: user.role.toLowerCase() as UserRole },
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        })
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
      storage: createJSONStorage(() => resilientAuthStorage),
      partialize: (state) => ({
        user: state.user ? { ...state.user, avatar: undefined } : null,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState>
        const user = persisted.user
          ? { ...persisted.user, role: persisted.user.role.toLowerCase() as UserRole }
          : null
        const token = persisted.token ?? null
        const refreshToken = persisted.refreshToken ?? null
        return {
          ...currentState,
          ...persisted,
          user,
          token,
          refreshToken,
          isAuthenticated: Boolean(user && token && refreshToken),
        }
      },
    }
  )
)
