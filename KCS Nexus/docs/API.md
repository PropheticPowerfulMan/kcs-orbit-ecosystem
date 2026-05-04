# KCS Nexus API

Base URL: `/api`

## Auth

- `POST /auth/register` — create a user and issue JWT tokens
- `POST /auth/login` — authenticate with email and password
- `POST /auth/google` — reserved for Google OAuth integration
- `POST /auth/refresh` — exchange refresh token for a new access token
- `POST /auth/forgot-password` — start password reset flow
- `POST /auth/reset-password` — complete password reset
- `GET /auth/me` — current authenticated user

## News & Events

- `GET /news`
- `GET /news/:id`
- `GET /news/slug/:slug`
- `POST /news`
- `PUT /news/:id`
- `DELETE /news/:id`
- `GET /events`
- `GET /events/:id`
- `POST /events`
- `PUT /events/:id`
- `DELETE /events/:id`

## Academic Domain

- `GET /students`
- `GET /students/:id`
- `GET /students/:id/grades`
- `GET /students/:id/assignments`
- `GET /students/:id/timetable`
- `GET /students/:id/analytics`
- `PUT /students/:id`
- `GET /teachers`
- `GET /teachers/:id`
- `POST /teachers`
- `PUT /teachers/:id`
- `GET /courses`
- `GET /courses/:id`
- `POST /courses`
- `PUT /courses/:id`
- `DELETE /courses/:id`

## Admissions & Media

- `GET /admissions`
- `GET /admissions/:id`
- `GET /admissions/track/:number`
- `POST /admissions`
- `PATCH /admissions/:id/status`
- `POST /admissions/:id/documents`
- `GET /media`
- `GET /media/categories`
- `POST /media/upload`
- `DELETE /media/:id`

## Communication & AI

- `POST /contact`
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`
- `POST /ai/chat`
- `POST /ai/tutor`
- `POST /ai/quiz`
- `GET /ai/recommendations/:studentId`
- `GET /ai/analytics/:studentId`

## Admin

- `GET /admin/stats`
- `GET /admin/analytics`
- `GET /admin/export/:type`

## Response Shape

Successful responses follow:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Error responses follow:

```json
{
  "success": false,
  "message": "Human-readable error message"
}
```
