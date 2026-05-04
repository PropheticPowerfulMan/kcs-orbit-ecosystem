# KCS Orbit API

Central backend API for the KCS Orbit ecosystem.

## Features

- Authentication with JWT
- Roles: ADMIN, STAFF, TEACHER, PARENT, STUDENT
- Students, parents, teachers, classes
- Payments for EduPay
- Grades and attendance for Academics
- Announcements for Nexus and AI Assistant
- Event bus starter

## Local setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Default admin:

```txt
email: admin@kcs-orbit.local
password: Admin@12345
```

## Environment variables

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="your_secret"
PORT=4000
CORS_ORIGIN="http://localhost:5173,https://propheticpowerfulman.github.io"
```

## Main endpoints

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me

GET  /api/students
POST /api/students

GET  /api/payments
POST /api/payments

GET  /api/grades
POST /api/grades

GET  /api/attendance
POST /api/attendance

GET  /api/announcements
POST /api/announcements
```
