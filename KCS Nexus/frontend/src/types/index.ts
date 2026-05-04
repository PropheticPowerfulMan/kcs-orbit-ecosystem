// =============================================
// KCS Nexus — Global TypeScript Types
// =============================================

// --- User & Auth ---
export type UserRole = 'admin' | 'staff' | 'teacher' | 'student' | 'parent';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  staffFunction?: 'principal' | 'academic_coordinator' | 'registrar' | 'accountant' | 'discipline' | 'communications' | 'admissions' | 'office';
  permissions?: string[];
  avatar?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
}

// --- Student ---
export interface Student {
  id: string;
  userId: string;
  user: User;
  studentId: string;
  grade: string;
  section: string;
  parentId?: string;
  enrollmentDate: string;
  status: 'active' | 'inactive' | 'graduated' | 'transferred';
  gpa?: number;
  attendanceRate?: number;
}

// --- Teacher ---
export interface Teacher {
  id: string;
  userId: string;
  user: User;
  employeeId: string;
  department: string;
  subjects: string[];
  qualification: string;
  yearsOfExperience: number;
  bio?: string;
  photoUrl?: string;
}

// --- Course & Assignment ---
export interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  grade: string;
  teacherId: string;
  teacher?: Teacher;
  credits: number;
  schedule: Schedule[];
  students?: Student[];
  syllabus?: string;
}

export interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  course?: Course;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
  type: 'homework' | 'quiz' | 'exam' | 'project' | 'lab';
  attachments?: string[];
  status?: 'pending' | 'submitted' | 'graded' | 'late';
  score?: number;
  feedback?: string;
}

// --- Grade ---
export interface Grade {
  id: string;
  studentId: string;
  courseId: string;
  course?: Course;
  assignmentId?: string;
  score: number;
  maxScore: number;
  percentage: number;
  letterGrade: string;
  period: string;
  createdAt: string;
}

// --- News & Events ---
export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: NewsCategory;
  author: User;
  coverImage?: string;
  tags: string[];
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  views?: number;
}

export type NewsCategory = 'news' | 'event' | 'announcement' | 'achievement' | 'sports' | 'arts';

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  type: 'academic' | 'spiritual' | 'sports' | 'cultural' | 'administrative';
  coverImage?: string;
  registrationRequired: boolean;
  maxAttendees?: number;
  liveStreamEnabled?: boolean;
  liveStreamUrl?: string;
  liveStreamPlatform?: string;
  liveStreamStatus?: 'scheduled' | 'live' | 'ended' | 'cancelled';
  liveStreamStartsAt?: string;
  replayUrl?: string;
}

// --- Admission ---
export interface AdmissionApplication {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  nationality: string;
  gradeApplying: string;
  previousSchool?: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  relationship: string;
  address: string;
  documents: UploadedDocument[];
  status: ApplicationStatus;
  notes?: string;
  submittedAt: string;
  updatedAt: string;
}

export type ApplicationStatus = 
  | 'draft' 
  | 'submitted' 
  | 'under_review' 
  | 'interview_scheduled' 
  | 'accepted' 
  | 'waitlisted' 
  | 'rejected';

export interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

// --- Media Gallery ---
export interface MediaItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  category: string;
  tags: string[];
  uploadedAt: string;
}

export interface GalleryCategory {
  id: string;
  name: string;
  slug: string;
  coverImage?: string;
  count: number;
}

// --- Notification ---
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'message';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// --- AI ---
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  language?: 'en' | 'fr';
}

export interface AITutorSession {
  id: string;
  studentId: string;
  subject: string;
  topic: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentAnalytics {
  studentId: string;
  overallGPA: number;
  attendanceRate: number;
  assignmentCompletion: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors?: string[];
  recommendations?: string[];
  performanceTrend: 'improving' | 'stable' | 'declining';
  subjectPerformance: SubjectPerformance[];
}

export interface SubjectPerformance {
  subject: string;
  grade: number;
  trend: 'up' | 'down' | 'stable';
}

// --- API Response ---
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  statusCode: number;
}

// --- UI ---
export type Theme = 'light' | 'dark' | 'system';
export type Language = 'en' | 'fr';

export interface UIState {
  theme: Theme;
  language: Language;
  sidebarOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
}

// --- Contact Form ---
export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  type: 'general' | 'admissions' | 'academic' | 'technical';
}

// --- Stats ---
export interface SchoolStats {
  totalStudents: number;
  totalTeachers: number;
  yearsOfExcellence: number;
  nationalities: number;
  graduationRate: number;
  collegeAcceptanceRate: number;
}
