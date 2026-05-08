import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { students as demoStudents } from '../data/demoSchoolData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
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

const normalizeDirectoryExternalIds = (externalIds) => {
  if (!Array.isArray(externalIds)) {
    return [];
  }

  return externalIds
    .map((entry) => {
      if (!entry) {
        return null;
      }

      if (typeof entry === 'string') {
        return { appSlug: '', externalId: entry };
      }

      return {
        appSlug: typeof entry.appSlug === 'string' ? entry.appSlug : '',
        externalId: typeof entry.externalId === 'string' ? entry.externalId : '',
      };
    })
    .filter((entry) => entry?.externalId);
};

const buildSharedParentMap = (parents) => {
  if (!Array.isArray(parents)) {
    return new Map();
  }

  return new Map(
    parents.map((parent) => [parent.id, parent])
  );
};

const mapSharedStudentToSavanexStudent = (student, parentMap) => {
  const externalIds = normalizeDirectoryExternalIds(student?.externalIds);
  const parent = parentMap.get(student?.parentId) || null;
  const parentExternalIds = normalizeDirectoryExternalIds(parent?.externalIds);
  const preferredStudentId =
    (typeof student?.studentNumber === 'string' && student.studentNumber.trim())
    || externalIds[0]?.externalId
    || `ORBIT-${student?.id}`;

  return {
    id: `orbit:${student.id}`,
    student_id: preferredStudentId,
    full_name: student?.fullName || 'Élève Orbit',
    email: student?.email || '',
    avatar: null,
    kcs_card_id: null,
    photo_data: '',
    photo_source: 'orbit',
    left_fingerprint_data: '',
    right_fingerprint_data: '',
    has_photo: false,
    has_biometrics: false,
    must_change_password: Boolean(student?.mustChangePassword),
    password_generated_by_system: false,
    date_of_birth: student?.dateOfBirth || null,
    gender: student?.gender || '',
    address: '',
    current_class: student?.classId || null,
    class_name: student?.className || null,
    parent: parent?.id || null,
    parent_name: parent?.fullName || '',
    parent_email: parent?.email || '',
    parent_phone: parent?.phone || '',
    parent_external_id: parentExternalIds[0]?.externalId || '',
    parent_kcs_card_id: null,
    parent_photo_data: '',
    parent_left_fingerprint_data: '',
    parent_right_fingerprint_data: '',
    enrollment_date: null,
    is_active: (student?.status || 'ACTIVE') !== 'INACTIVE',
    notes: '',
    source: 'orbit',
    source_label: 'Orbit',
    is_read_only: true,
    orbit_id: student?.id || null,
    external_ids: externalIds,
  };
};

const mergeLocalAndSharedStudents = (localStudents, sharedDirectory) => {
  const safeLocalStudents = Array.isArray(localStudents) ? localStudents : [];
  const parentMap = buildSharedParentMap(sharedDirectory?.parents);
  const sharedStudents = Array.isArray(sharedDirectory?.students)
    ? sharedDirectory.students.map((student) => mapSharedStudentToSavanexStudent(student, parentMap))
    : [];
  const centralSavanexStudentIds = new Set(
    Array.isArray(sharedDirectory?.students)
      ? sharedDirectory.students
        .flatMap((student) => normalizeDirectoryExternalIds(student?.externalIds))
        .filter((entry) => entry.appSlug.toUpperCase() === 'SAVANEX')
        .map((entry) => entry.externalId.trim().toLowerCase())
        .filter(Boolean)
      : []
  );
  const visibleLocalStudents = safeLocalStudents;

  const localStudentIds = new Set(
    visibleLocalStudents
      .map((student) => typeof student?.student_id === 'string' ? student.student_id.trim().toLowerCase() : '')
      .filter(Boolean)
  );

  const dedupedSharedStudents = sharedStudents.filter((student) => {
    const savanexExternalId = student.external_ids.find((entry) => entry.appSlug.toUpperCase() === 'SAVANEX')?.externalId;
    const comparableId = (savanexExternalId || student.student_id || '').trim().toLowerCase();
    return comparableId ? !localStudentIds.has(comparableId) : true;
  });

  return [
    ...visibleLocalStudents.map((student) => ({
      ...student,
      source: student?.source || 'local',
      source_label: student?.source_label || 'SAVANEX',
      is_read_only: Boolean(student?.is_read_only),
    })),
    ...dedupedSharedStudents,
  ];
};

export const authService = {
  async login(username, password) {
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

export const studentsService = {
  async getAll() {
    if (isDemoSession()) {
      return demoStudents.map((student, index) => ({
        id: index + 1,
        student_id: `DEMO-${index + 1}`,
        full_name: student.name,
        email: undefined,
        class_name: student.className,
        parent_name: student.parent,
        is_active: true,
        source: 'demo',
        source_label: 'Démo',
        is_read_only: false,
      }));
    }

    const [localResult, sharedResult] = await Promise.allSettled([
      api.get('/students/'),
      api.get('/integration/shared-directory/'),
    ]);

    const localStudents = localResult.status === 'fulfilled'
      ? (Array.isArray(localResult.value.data) ? localResult.value.data : (localResult.value.data.results || []))
      : [];
    const sharedDirectory = sharedResult.status === 'fulfilled' ? sharedResult.value.data : null;

    if (localResult.status === 'rejected' && sharedResult.status === 'rejected') {
      throw localResult.reason;
    }

    return mergeLocalAndSharedStudents(localStudents, sharedDirectory);
  },

  async registerFamily(data) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour enregistrer des familles.");
    }

    const res = await api.post('/students/family-registration/', data);
    return res.data;
  },

  async update(id, data) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour modifier des entités.");
    }

    const res = await api.patch(`/students/${id}/`, data);
    return res.data;
  },

  async remove(id) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour supprimer des entités.");
    }

    const res = await api.delete(`/students/${id}/`);
    return res.data;
  },
};

export const teachersService = {
  async getAll() {
    if (isDemoSession()) {
      const { teachers } = await import('../data/demoSchoolData');
      return teachers.map((teacher) => ({
        id: teacher.id,
        teacher_id: `DEMO-TCH-${teacher.id}`,
        full_name: teacher.name,
        employee_type: 'teacher',
        employee_label: 'Enseignant',
        job_title: 'Enseignant',
        specialization: teacher.subject,
        department: teacher.classes,
        employment_status: 'active',
        pay_frequency: 'monthly',
        kcs_card_id: `KCS-TCH-DEMO${teacher.id}`,
        has_photo: false,
        has_biometrics: false,
      }));
    }

    const res = await api.get('/teachers/');
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },

  async create(data) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour enregistrer des employés.");
    }

    const res = await api.post('/teachers/', data);
    return res.data;
  },
};
