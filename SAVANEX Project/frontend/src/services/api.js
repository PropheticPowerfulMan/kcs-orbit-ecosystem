import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const DEMO_ACCESS_TOKEN = 'demo-access-token';

const demoUser = {
  id: 1,
  username: 'admin',
  email: 'admin@savanex.local',
  first_name: 'Demo',
  last_name: 'Admin',
  full_name: 'Demo Admin',
  role: 'admin',
  language: 'fr',
};

const demoOverview = {
  total_students: 428,
  total_teachers: 34,
  total_classes: 18,
  attendance_rate_30d: 92,
  average_grade: 14.8,
};

const demoWarnings = {
  students: [
    {
      student_name: 'Amina K.',
      attendance_rate: 71,
      average_normalized: 10.5,
      risk_flags: ['Attendance below 75%'],
    },
    {
      student_name: 'David M.',
      attendance_rate: 83,
      average_normalized: 8.7,
      risk_flags: ['Average below 10/20'],
    },
    {
      student_name: 'Sarah N.',
      attendance_rate: 68,
      average_normalized: 9.2,
      risk_flags: ['Attendance below 75%', 'Average below 10/20'],
    },
  ],
};

const isDemoSession = () => useAuthStore.getState().accessToken === DEMO_ACCESS_TOKEN;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = useAuthStore.getState().refreshToken;
      if (!refresh) {
        useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
        const newAccess = res.data.access;
        useAuthStore.setState({ accessToken: newAccess });
        localStorage.setItem('savanex_access', newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(username, password) {
    if (username.trim().toLowerCase() === 'admin' && password.trim() === 'admin123') {
      return this.demoLogin();
    }

    const res = await api.post('/auth/login/', { username, password });
    return res.data;
  },
  async demoLogin() {
    return {
      access: DEMO_ACCESS_TOKEN,
      refresh: 'demo-refresh-token',
      user: demoUser,
    };
  },
};

export const analyticsService = {
  async getOverview() {
    if (isDemoSession()) {
      return demoOverview;
    }

    const res = await api.get('/analytics/overview/');
    return res.data;
  },
  async getEarlyWarnings() {
    if (isDemoSession()) {
      return demoWarnings;
    }

    const res = await api.get('/analytics/early-warning/');
    return res.data;
  },
};
