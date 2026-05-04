# Deployment Guide

## Frontend

Recommended target: Vercel

1. Import the `frontend` directory as a Vercel project.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variable:
   - `VITE_API_URL=https://your-api-domain/api`

## Backend

Recommended targets: Railway or Render

1. Import the `backend` directory as a Node service.
2. Build command: `npm run build`
3. Start command: `npm run start`
4. Provision PostgreSQL and set `DATABASE_URL`.
5. Run:
   - `npm run prisma:generate`
   - `npx prisma migrate deploy`

Required environment variables:

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `OPENAI_API_KEY` for live AI features
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google sign-in
- `CLOUDINARY_*` if enabling media uploads

## Production Hardening

- Add rate limiting and request throttling.
- Add structured logging and uptime monitoring.
- Store uploads on S3 or Cloudinary instead of local disk paths.
- Enforce HTTPS and secure cookie handling if switching auth storage strategy.
- Add CI with frontend build, backend typecheck, Prisma migration validation, and smoke tests.
