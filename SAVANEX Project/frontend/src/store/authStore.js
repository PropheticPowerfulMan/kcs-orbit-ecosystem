import { create } from 'zustand';

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('savanex_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  accessToken: localStorage.getItem('savanex_access') || null,
  refreshToken: localStorage.getItem('savanex_refresh') || null,
  user: getStoredUser(),

  setAuth: ({ access, refresh, user }) => {
    localStorage.setItem('savanex_access', access);
    localStorage.setItem('savanex_refresh', refresh);
    localStorage.setItem('savanex_user', JSON.stringify(user));
    set({ accessToken: access, refreshToken: refresh, user });
  },

  clearAuth: () => {
    localStorage.removeItem('savanex_access');
    localStorage.removeItem('savanex_refresh');
    localStorage.removeItem('savanex_user');
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
