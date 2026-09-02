import { create } from 'zustand';

// Remove legacy durable credentials. Restore auth only for this browser session.
localStorage.removeItem('savanex_access');
localStorage.removeItem('savanex_refresh');
localStorage.removeItem('savanex_user');

const readStoredUser = () => {
  try {
    const value = sessionStorage.getItem('savanex_user');
    return value ? JSON.parse(value) : null;
  } catch {
    sessionStorage.removeItem('savanex_user');
    return null;
  }
};

export const useAuthStore = create((set) => ({
  accessToken: sessionStorage.getItem('savanex_access'),
  refreshToken: sessionStorage.getItem('savanex_refresh'),
  user: readStoredUser(),

  setAuth: ({ access, refresh, user }) => {
    sessionStorage.setItem('savanex_access', access);
    sessionStorage.setItem('savanex_refresh', refresh);
    sessionStorage.setItem('savanex_user', JSON.stringify(user));
    set({ accessToken: access, refreshToken: refresh, user });
  },

  updateUser: (user) => {
    sessionStorage.setItem('savanex_user', JSON.stringify(user));
    set({ user });
  },

  clearAuth: () => {
    sessionStorage.removeItem('savanex_access');
    sessionStorage.removeItem('savanex_refresh');
    sessionStorage.removeItem('savanex_user');
    localStorage.removeItem('savanex_access');
    localStorage.removeItem('savanex_refresh');
    localStorage.removeItem('savanex_user');
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
