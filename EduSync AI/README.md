# EduSync AI - Intelligent School Communication System

EduSync AI is a full-stack communication platform for schools that automates repetitive communication tasks, accelerates responses, and centralizes collaboration between administration, teachers, and staff.

## Vision

Build a smart, adaptive, and evolving communication ecosystem powered by AI to improve institutional efficiency.

## Core Capabilities

- AI chatbot for intent-aware internal support
- Automated announcements and reminders
- Role-based access (Admin, Teacher, Staff)
- Internal notification center with priority tags
- Smart workflow automation for leave and approvals
- Analytics dashboard for communication performance

## Tech Stack

- Backend: FastAPI + SQLAlchemy
- AI/NLP: Modular NLP service (ready for spaCy/Transformers extension)
- Database: SQLite by default (easy switch to PostgreSQL)
- Frontend: React + Vite
- Containerization: Docker + Compose

## Project Structure

- backend/: API, authentication, workflows, AI service, scheduler
- frontend/: Web UI for chatbot, automation and analytics
- infra/: Docker Compose orchestration

## Quick Start (Local)

### 1) Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Optional advanced NLP packages:

```bash
pip install -r requirements-ai.txt
```

Note: `requirements-ai.txt` (spaCy/Transformers) is recommended with Python 3.11 + C/C++ build tools on Windows.
Core `requirements.txt` is kept compatible with newer Python versions (including 3.14) for quick startup.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

Default seeded admin:
- Email: admin@school.edu
- Password: Admin@123

## API Highlights

- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/chat/query
- POST /api/v1/messaging/announcements
- GET /api/v1/messaging/announcements
- GET /api/v1/notifications
- PATCH /api/v1/notifications/{id}/read
- POST /api/v1/workflows
- PATCH /api/v1/workflows/{id}/decision
- GET /api/v1/analytics/dashboard

## Security and Scalability Notes

- JWT authentication and role guards are enabled
- Service-layer architecture keeps modules isolated and testable
- Scheduler handles delayed announcement dispatch
- Swap SQLite for PostgreSQL by changing DATABASE_URL
- NLP engine is pluggable for production-grade models

## Next Evolution Ideas

- WebSocket notifications for real-time push
- LLM/RAG for policy-aware decision support
- Mobile app (Flutter or React Native)
- Observability stack (Prometheus, Grafana, OpenTelemetry)
