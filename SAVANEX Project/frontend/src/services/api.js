import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import {
  classDistribution as demoClassDistribution,
  students as demoStudents,
  teachers as demoTeachers,
} from '../data/demoSchoolData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
const DEMO_ACCESS_TOKEN = 'demo-access-token';
const DEMO_MODE_ENABLED = String(import.meta.env.VITE_ENABLE_DEMO_MODE || '').trim().toLowerCase() === 'true';
const DIRECTORY_REQUEST_TIMEOUT_MS = 10000;

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
  total_students: demoStudents.length,
  total_teachers: demoTeachers.length,
  total_classes: demoClassDistribution.length,
  attendance_rate_30d: 92,
  average_grade: 74,
};

const demoWarnings = {
  students: [
    {
      id: 1,
      student_name: 'Amina K.',
      attendance_rate: 71,
      average_normalized: 72,
      average_excellence_percentage: 72,
      risk_flags: ['Attendance watch'],
    },
    {
      id: 2,
      student_name: 'David M.',
      attendance_rate: 83,
      average_normalized: 64,
      average_excellence_percentage: 64,
      risk_flags: ['Average excellence below 70%'],
    },
    {
      id: 3,
      student_name: 'Sarah N.',
      attendance_rate: 68,
      average_normalized: 68,
      average_excellence_percentage: 68,
      risk_flags: ['Attendance below 70%', 'Average excellence below 70%'],
    },
  ],
};

const buildDemoLivingProfile = (studentId) => {
  const student = demoStudents.find((entry) => entry.id === Number(studentId));
  if (!student) {
    return null;
  }

  const scienceAverage = Math.round(student.average * (student.id % 2 === 0 ? 4.85 : 5.2));
  const nonScienceAverage = Math.round(student.average * (student.id % 2 === 0 ? 5.15 : 4.8));
  const riskScore = Math.min(100, Math.max(0,
    (100 - scienceAverage) * 0.22 +
    (100 - nonScienceAverage) * 0.22 +
    (100 - student.attendance) * 0.5 +
    (student.risk.includes('lev') ? 22 : student.risk.includes('Moy') ? 10 : 0)
  ));
  const level = riskScore >= 65 ? 'critical' : riskScore >= 42 ? 'warning' : riskScore <= 18 ? 'strong' : 'stable';
  const preference = scienceAverage >= nonScienceAverage + 4
    ? 'scientific'
    : nonScienceAverage >= scienceAverage + 4
      ? 'non_scientific'
      : 'balanced';
  const disciplineLevel = student.attendance < 70 ? 'warning' : student.attendance < 85 ? 'watch' : 'clear';

  return {
    student: { id: student.id, student_id: `DEMO-${student.id}`, full_name: student.name },
    severity: level,
    metrics: {
      risk_score: Math.round(riskScore),
      prediction_level: level,
      science_average: scienceAverage,
      non_science_average: nonScienceAverage,
      learning_preference: preference,
      discipline_level: disciplineLevel,
      discipline_flags: disciplineLevel === 'clear' ? [] : ['attendance_pattern'],
      absences: student.attendance < 80 ? 3 : 0,
      lates: student.attendance < 90 ? 2 : 0,
      recommendations: [
        student.average < 12
          ? 'Ouvrir un plan de soutien academique hebdomadaire avec objectifs mesurables.'
          : preference === 'scientific'
            ? 'Orienter vers laboratoire, STEM, projets pratiques et mentorat scientifique.'
            : 'Conserver un suivi mixte avec exercices cibles et point parent hebdomadaire.',
      ],
      alert_channels: {
        in_app: true,
        email: riskScore >= 42,
        sms: riskScore >= 65 || disciplineLevel === 'warning',
      },
    },
    prediction: { risk_score: Math.round(riskScore), level },
    learning_profile: {
      preference,
      science_average: scienceAverage,
      non_science_average: nonScienceAverage,
      subject_breakdown: {},
    },
    discipline: {
      level: disciplineLevel,
      flags: disciplineLevel === 'clear' ? [] : ['attendance_pattern'],
      absences: student.attendance < 80 ? 3 : 0,
      lates: student.attendance < 90 ? 2 : 0,
    },
    recommendations: [
      student.average < 12
        ? 'Ouvrir un plan de soutien academique hebdomadaire avec objectifs mesurables.'
        : preference === 'scientific'
          ? 'Orienter vers laboratoire, STEM, projets pratiques et mentorat scientifique.'
          : 'Conserver un suivi mixte avec exercices cibles et point parent hebdomadaire.',
    ],
    alert_channels: {
      in_app: true,
      email: riskScore >= 42,
      sms: riskScore >= 65 || disciplineLevel === 'warning',
    },
    timeline: [],
  };
};

const isDemoSession = () => DEMO_MODE_ENABLED && useAuthStore.getState().accessToken === DEMO_ACCESS_TOKEN;

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
  (response) => {
    const method = response.config.method?.toUpperCase();
    if (method && ['PUT', 'PATCH', 'DELETE'].includes(method)) {
      window.dispatchEvent(new CustomEvent('ecosystem:mutation-success', { detail: { message: response.data?.detail || response.data?.message || (method === 'DELETE' ? "Entité supprimée dans tout l'écosystème." : "Modification enregistrée et synchronisée dans l'écosystème.") } }));
    }
    return response;
  },
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
    current_class: student?.classId || null,
    class_name: student?.className || null,
    parent: parent?.id || null,
    parent_name: parent?.fullName || '',
    parent_email: parent?.email || '',
    parent_phone: parent?.phone || '',
    parent_address: parent?.physicalAddress || '',
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
    is_read_only: false,
    orbit_id: student?.id || null,
    external_ids: externalIds,
  };
};

const isOrbitStudentId = (id) => typeof id === 'string' && id.startsWith('orbit:');

const toOrbitStudentId = (id) => String(id || '').replace(/^orbit:/, '');

const mapSavanexStudentPatchToOrbit = (data) => {
  const className = [data?.class_level, data?.class_suffix].filter(Boolean).join(' ').trim();

  return {
    ...(data?.first_name !== undefined ? { firstName: data.first_name } : {}),
    ...(data?.last_name !== undefined ? { lastName: data.last_name } : {}),
    ...(data?.user_email !== undefined ? { email: data.user_email || null } : {}),
    ...(data?.gender !== undefined ? { gender: data.gender } : {}),
    ...(data?.date_of_birth !== undefined ? { dateOfBirth: data.date_of_birth || null } : {}),
    ...(className ? { className } : {}),
    ...(data?.notes !== undefined ? { notes: data.notes } : {}),
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

  const sharedStudentBySavanexId = new Map(
    sharedStudents.flatMap((student) => {
      const savanexId = student.external_ids
        .find((entry) => entry.appSlug.toUpperCase() === 'SAVANEX')
        ?.externalId?.trim()?.toLowerCase();
      return savanexId ? [[savanexId, student]] : [];
    })
  );

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
    ...visibleLocalStudents.map((student) => {
      const localId = typeof student?.student_id === 'string'
        ? student.student_id.trim().toLowerCase()
        : '';
      const sharedStudent = localId ? sharedStudentBySavanexId.get(localId) : null;

      return {
        ...student,
        ...(sharedStudent ? {
          parent_name: sharedStudent.parent_name || student.parent_name,
          parent_email: sharedStudent.parent_email || student.parent_email,
          parent_phone: sharedStudent.parent_phone || student.parent_phone,
          parent_address: sharedStudent.parent_address || student.parent_address,
          parent_external_id: sharedStudent.parent_external_id || student.parent_external_id,
        } : {}),
        source: student?.source || 'local',
        source_label: student?.source_label || 'SAVANEX',
        is_read_only: Boolean(student?.is_read_only),
      };
    }),
    ...dedupedSharedStudents,
  ];
};

export const authService = {
  async login(username, password) {
    const res = await api.post('/auth/login/', { username, password });
    return res.data;
  },
  async forgotPassword(email) {
    const res = await api.post('/auth/forgot-password/', { email });
    return res.data;
  },
  async resetPassword(uid, token, password) {
    const res = await api.post('/auth/reset-password/', { uid, token, password });
    return res.data;
  },
  async getProfile() {
    const res = await api.get('/users/me/');
    return res.data;
  },
  async updateProfile(data) {
    const res = await api.patch('/users/me/', data);
    return res.data;
  },
  async changePassword(oldPassword, newPassword) {
    const res = await api.post('/users/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return res.data;
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

export const intelligenceService = {
  async getEvents(params = {}) {
    if (isDemoSession()) {
      return [];
    }

    const res = await api.get('/intelligence/events/', { params });
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },

  async getStudentLivingProfile(studentId) {
    if (isDemoSession()) {
      return buildDemoLivingProfile(studentId);
    }

    const res = await api.get(`/intelligence/students/${studentId}/living-profile/`);
    return res.data;
  },

  getEvolutionReportUrl(params = {}) {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/intelligence/reports/evolution/${query ? `?${query}` : ''}`;
  },

  async exportEvolutionReport(params = {}) {
    if (isDemoSession()) {
      return null;
    }

    const res = await api.get('/intelligence/reports/evolution/', {
      params,
      responseType: 'blob',
    });
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

    const [localResponse, sharedDirectory] = await Promise.all([
      api.get('/students/'),
      sharedDirectoryService.get(),
    ]);
    const localStudents = Array.isArray(localResponse.data)
      ? localResponse.data
      : (localResponse.data?.results || []);
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

    if (isOrbitStudentId(id)) {
      const res = await api.patch(`/integration/entities/student/${toOrbitStudentId(id)}/`, mapSavanexStudentPatchToOrbit(data), {
        params: { identifierType: 'orbitId' },
      });
      return res.data;
    }

    const res = await api.patch(`/students/${id}/`, data);
    return res.data;
  },

  async remove(id) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour supprimer des entités.");
    }

    if (isOrbitStudentId(id)) {
      const res = await api.delete(`/integration/entities/student/${toOrbitStudentId(id)}/`, {
        params: { identifierType: 'orbitId' },
      });
      return res.data;
    }

    const res = await api.delete(`/students/${id}/`);
    return res.data;
  },

  async resetAccess(identifier, options = {}) {
    const path = options.entityType
      ? `/users/reset-access/${options.entityType}/${encodeURIComponent(identifier)}/`
      : `/users/${identifier}/reset-access/`;
    const res = await api.post(path);
    return res.data;
  },
};

export const sharedDirectoryService = {
  async get() {
    const res = await api.get('/integration/shared-directory/', { timeout: DIRECTORY_REQUEST_TIMEOUT_MS });
    return res.data;
  },
};

export const parentsService = {
  async resetAccess(identifier, options = {}) {
    const path = options.entityType
      ? `/users/reset-access/${options.entityType}/${encodeURIComponent(identifier)}/`
      : `/users/${identifier}/reset-access/`;
    const res = await api.post(path);
    return res.data;
  },
  async update(id, data, options = {}) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour modifier des parents.");
    }

    if (options.source === 'orbit') {
      const res = await api.patch(`/integration/entities/parent/${id}/`, {
        ...(data?.first_name !== undefined ? { firstName: data.first_name } : {}),
        ...(data?.last_name !== undefined ? { lastName: data.last_name } : {}),
        ...(data?.email !== undefined ? { email: data.email || null } : {}),
        ...(data?.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data?.address !== undefined ? { physicalAddress: data.address || null } : {}),
      }, {
        params: { identifierType: options.identifierType || 'orbitId' },
      });
      return res.data;
    }

    const res = await api.patch(`/users/${id}/`, data);
    return res.data;
  },

  async remove(id, options = {}) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour supprimer des parents.");
    }

    if (options.source === 'orbit') {
      const res = await api.delete(`/integration/entities/parent/${id}/`, {
        params: { identifierType: options.identifierType || 'orbitId' },
      });
      return res.data;
    }

    const res = await api.delete(`/users/${id}/`);
    return res.data;
  },
};

export const communicationService = {
  async getMessages(box = 'sent') {
    if (isDemoSession()) {
      const { messages } = await import('../data/demoSchoolData');
      return messages.map((message) => ({
        id: message.id,
        subject: message.channel,
        body: message.status,
        receiver_name: message.audience,
        sent_at: new Date().toISOString(),
        priority: message.priority,
        delivery: [
          { channel: 'email', status: 'simulated', detail: 'demo' },
          { channel: 'sms', status: 'simulated', detail: 'demo' },
        ],
      }));
    }

    const res = await api.get('/communication/messages/', { params: { box } });
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },

  async sendParentMessages({ recipients, subject, body, channels = ['email', 'sms'] }) {
    const safeRecipients = Array.isArray(recipients) ? recipients : [];
    if (isDemoSession()) {
      return safeRecipients.map((recipient, index) => ({
        id: Date.now() + index,
        receiver: recipient.id,
        receiver_name: recipient.name || 'Parent demo',
        subject,
        body,
        sent_at: new Date().toISOString(),
        delivery: [
          ...(channels.includes('email') ? [{ channel: 'email', status: 'simulated', detail: recipient.email || 'demo' }] : [{ channel: 'email', status: 'skipped', detail: 'disabled' }]),
          ...(channels.includes('sms') ? [{ channel: 'sms', status: 'simulated', detail: recipient.phone || 'demo' }] : [{ channel: 'sms', status: 'skipped', detail: 'disabled' }]),
        ],
      }));
    }

    const res = await api.post('/communication/messages/', { recipients: safeRecipients, subject, body, channels });
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },

  async sendParentMessage({ receiver, subject, body }) {
    if (isDemoSession()) {
      return {
        id: Date.now(),
        receiver,
        receiver_name: 'Parent demo',
        subject,
        body,
        sent_at: new Date().toISOString(),
        delivery: [
          { channel: 'email', status: 'simulated', detail: 'demo' },
          { channel: 'sms', status: 'simulated', detail: 'demo' },
        ],
      };
    }

    const res = await api.post('/communication/messages/', { receiver, subject, body });
    return res.data;
  },

  async getNotifications() {
    if (isDemoSession()) {
      return [];
    }

    const res = await api.get('/communication/notifications/');
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
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
        gender: '',
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

    const directory = await sharedDirectoryService.get();
    return (Array.isArray(directory?.teachers) ? directory.teachers : []).map((teacher) => ({
      id: `orbit:${teacher.id}`,
      orbit_id: teacher.id,
      teacher_id: teacher.displayId || teacher.employeeId || teacher.id,
      employee_id: teacher.employeeId || teacher.displayId || teacher.id,
      full_name: teacher.fullName,
      first_name: teacher.firstName || '',
      middle_name: teacher.middleName || '',
      last_name: teacher.lastName || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      address: teacher.physicalAddress || '',
      employee_type: teacher.employeeType || 'teacher',
      employee_label: teacher.employeeType || 'Employé',
      job_title: teacher.jobTitle || '',
      specialization: teacher.subject || '',
      department: teacher.department || '',
      employment_status: teacher.status || 'active',
      is_active: (teacher.status || 'ACTIVE') !== 'INACTIVE',
      source: 'orbit',
      source_label: 'Orbit',
      is_read_only: false,
    }));
  },

  async create(data) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour enregistrer des employés.");
    }

    const res = await api.post('/teachers/', data);
    return res.data;
  },

  async update(id, data) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour modifier des employés.");
    }

    const res = await api.patch(`/teachers/${id}/`, data);
    return res.data;
  },

  async remove(id) {
    if (isDemoSession()) {
      useAuthStore.getState().clearAuth();
      throw new Error("Vous étiez en mode démo. La session démo a été fermée; reconnectez-vous au vrai SAVANEX pour supprimer des employés.");
    }

    const res = await api.delete(`/teachers/${id}/`);
    return res.data;
  },
};
