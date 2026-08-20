import { create } from 'zustand';

// Authentication is deliberately memory-only. A fresh SAVANEX load must always
// start at the login page instead of silently restoring an earlier session.
localStorage.removeItem('savanex_access');
localStorage.removeItem('savanex_refresh');
localStorage.removeItem('savanex_user');

export const useAuthStore = create((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,

  setAuth: ({ access, refresh, user }) => {
    set({ accessToken: access, refreshToken: refresh, user });
  },

  updateUser: (user) => {
    set({ user });
  },

  clearAuth: () => {
    localStorage.removeItem('savanex_access');
    localStorage.removeItem('savanex_refresh');
    localStorage.removeItem('savanex_user');
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
