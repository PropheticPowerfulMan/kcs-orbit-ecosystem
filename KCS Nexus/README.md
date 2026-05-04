# KCS Nexus

KCS Nexus is a full-stack AI-powered digital platform for Kinshasa Christian School. It combines a polished public-facing website, role-based academic portals, an admissions funnel, media storytelling, and an extensible backend designed to grow into a broader education system.

## Stack

### Frontend
- React 18 + Vite + TypeScript
- Tailwind CSS + Framer Motion
- React Router, Zustand, Axios, React Hook Form, Zod
- Recharts for analytics
- i18next for English and French support

### Backend
- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- JWT authentication
- OpenAI integration scaffold
- Modular REST API aligned with frontend services

## Project Structure

```text
frontend/   Public website + portals + AI tutor UI
backend/    Express API + Prisma schema + route modules
docs/       API reference and deployment notes
```

## Frontend Features

- Elegant public website pages: home, about, academics, news, admissions, gallery, contact
- Dedicated dashboards for student, parent, teacher, and admin roles
- AI Tutor chat experience for students
- Responsive layout with light and dark theme support
- Bilingual UI foundations in English and French

## Backend Features

- Route surface matching the frontend API client
- Prisma schema for users, profiles, courses, grades, admissions, media, notifications, and AI sessions
- Auth flow with access token and refresh token scaffolding
- Admin analytics and export endpoints
- OpenAI-backed chat and tutor endpoints with graceful fallback messaging

## Local Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs by default on `http://localhost:5173`.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The backend runs by default on `http://localhost:5000`.

## Environment Variables

- Frontend example: [frontend/.env.example](frontend/.env.example)
- Backend example: [backend/.env.example](backend/.env.example)

## Documentation

- API reference: [docs/API.md](docs/API.md)
- Deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Current Notes

- Google OAuth and production-grade media storage are scaffolded and need credentials to be enabled.
- The backend is organized to support further hardening such as rate limiting, audit trails, and background jobs.
- The frontend already routes all core public pages and role dashboards.
