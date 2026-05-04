# 🏫 SAVANEX School Management System (SMS)

A comprehensive, intelligent, and scalable digital platform for managing all aspects of school administration — students, teachers, classes, attendance, grades, timetables, and parent-teacher communication.

---

## 🧠 Architecture Overview

```
savanex-sms/
├── backend/            # Django REST Framework API
│   ├── config/         # Project settings (base, dev, prod)
│   └── apps/           # Modular Django applications
│       ├── users/          # Auth + RBAC (Admin, Teacher, Student, Parent)
│       ├── students/       # Student profiles & enrollment
│       ├── teachers/       # Teacher profiles & assignments
│       ├── classes/        # Classes, Subjects, Academic Years
│       ├── attendance/     # Daily tracking & reports
│       ├── grades/         # Grades, averages, report cards
│       ├── timetable/      # Smart scheduling + conflict detection
│       ├── communication/  # Messaging + notifications
│       └── analytics/      # AI insights + early warning system
└── frontend/           # React 18 + Vite + TailwindCSS
    └── src/
        ├── components/     # Reusable UI components
        ├── pages/          # Role-based dashboards & modules
        ├── services/       # Axios API client
        ├── store/          # Zustand global state
        └── locales/        # i18n (English + French)
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, Django 4.2, Django REST Framework |
| Auth | JWT (djangorestframework-simplejwt) |
| Database | PostgreSQL 15 |
| Frontend | React 18, Vite, TailwindCSS |
| State | Zustand |
| Charts | Recharts |
| i18n | i18next (FR + EN) |
| PDF | ReportLab |
| Container | Docker + Docker Compose |

---

## 👥 User Roles & Permissions

| Role | Permissions |
|------|------------|
| **Admin** | Full access — manage users, classes, subjects, reports |
| **Teacher** | Manage attendance, grades, timetable, send messages |
| **Student** | View own grades, attendance, schedule, receive messages |
| **Parent** | View child's data, communicate with teachers |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### Using Docker (Recommended)

```bash
# 1. Clone repository
git clone <repo-url>
cd savanex-sms

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with your values

# 3. Launch all services
docker-compose up --build

# 4. Run migrations and seed data
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python manage.py loaddata initial_data

# 5. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/api/
# Admin: http://localhost:8000/admin/
```

### Local Development

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

#### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## 📡 API Endpoints

| Module | Endpoint |
|--------|---------|
| Auth | `/api/auth/login/` `/api/auth/refresh/` `/api/auth/logout/` |
| Users | `/api/users/` |
| Students | `/api/students/` |
| Teachers | `/api/teachers/` |
| Classes | `/api/classes/` `/api/subjects/` `/api/academic-years/` |
| Attendance | `/api/attendance/` `/api/attendance/reports/` |
| Grades | `/api/grades/` `/api/report-cards/` |
| Timetable | `/api/timetable/` `/api/timetable/conflicts/` |
| Messages | `/api/messages/` `/api/notifications/` |
| Analytics | `/api/analytics/overview/` `/api/analytics/early-warning/` |

---

## 🗄️ Database Schema

### Core Tables
- `users` — Extended Django user with role, language preference
- `students` — Student profiles linked to users
- `teachers` — Teacher profiles with qualifications
- `academic_years` — School year management
- `classes` — Class groups (Grade 10A, etc.)
- `subjects` — Course subjects with coefficients
- `class_subjects` — Teacher-Class-Subject assignment
- `attendance` — Daily attendance records
- `grades` — Score entries per student/subject/term
- `time_slots` — Timetable schedule entries
- `messages` — Threaded messaging
- `notifications` — In-app notification feed

---

## 🌐 Internationalization

- Default language: **English**
- Full translation support: **French**
- Toggle available in header/profile settings
- Backend: Django i18n (`gettext`)
- Frontend: `react-i18next`

---

## 🔐 Security

- JWT authentication with refresh tokens
- Role-based access control (RBAC) on all endpoints
- Django CSRF protection
- Input validation via DRF serializers
- Environment-variable-based secrets (no hardcoded credentials)
- CORS properly configured for production

---

## 📊 Intelligent Features

- **Attendance Analytics** — Track rates, trends, and patterns
- **Performance Insights** — Identify top/bottom performers
- **Early Warning System** — Flag students with attendance < 75% or average < 50%
- **Automated Summaries** — Weekly/monthly statistical summaries
- **Conflict Detection** — Timetable scheduling conflict alerts

---

## 🚢 Deployment

### Recommended Stack
- **Cloud**: AWS / DigitalOcean / Render
- **Web Server**: Nginx (reverse proxy)
- **WSGI**: Gunicorn
- **DB**: Managed PostgreSQL (RDS / Supabase)
- **Static Files**: AWS S3 / Cloudflare R2
- **Email**: SendGrid / Mailgun

### Environment Variables (Production)
See `.env.example` for all required variables.

---

## 📄 License

MIT License — SAVANEX Educational Technologies

---

*Built with ❤️ for African schools by SAVANEX*
