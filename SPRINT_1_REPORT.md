# Sprint 1 Report: Email OTP Auth + User Dashboard

**Status:** Complete
**Commit:** fbf4096
**Deploy:** auto via Railway (push to main)

---

## What was built

### Backend (server/)
| File | Purpose |
|------|---------|
| `server/db.js` | PostgreSQL pool + `initDB()` creating `users` and `auth_codes` tables |
| `server/email.js` | Brevo API integration with branded HTML email template (Russian) |
| `server/auth.js` | OTP generation (6-digit), 60s rate limit, JWT (httpOnly, 30d), `requireAuth` middleware |
| `server.js` | Auth API routes: `POST /api/auth/send-code`, `POST /api/auth/verify`, `GET /api/auth/me`, `POST /api/auth/logout` |

### Frontend (src/)
| File | Purpose |
|------|---------|
| `src/lib/api.js` | fetch wrapper with `credentials: 'include'` |
| `src/lib/auth.jsx` | `AuthProvider` + `useAuth()` (user, loading, login, logout, refresh) |
| `src/pages/LoginPage.jsx` | Two-step form: email input → 6-digit code entry with paste support |
| `src/components/ProtectedRoute.jsx` | Redirects to `/login` if not authenticated |
| `src/pages/DashboardPage.jsx` | Credits display, stats cards, empty project state with CTA |
| `src/components/Layout.jsx` | Header shows email, credits badge (Sparkles icon), logout button |
| `src/App.jsx` | Wrapped in `AuthProvider`, protected routes for dashboard/editor/billing |

---

## Auth flow

1. User enters email → `POST /api/auth/send-code`
2. Server generates 6-digit code, stores in `auth_codes` (10 min expiry), sends via Brevo
3. User enters code → `POST /api/auth/verify`
4. Server validates code, creates user if new (30 credits), returns JWT in httpOnly cookie
5. Frontend stores user in React Context, redirects to `/dashboard`

## Rate limiting
- 1 OTP per email per 60 seconds
- Frontend shows countdown timer for resend

## Environment variables needed on Railway
```
DATABASE_URL        # auto from Railway PostgreSQL
JWT_SECRET          # any random string
BREVO_API_KEY       # from Brevo dashboard
EMAIL_FROM          # verified sender email in Brevo
```

If `BREVO_API_KEY` is not set, OTP codes are logged to console (dev mode).

---

## Definition of Done checklist

- [x] `server/db.js` — tables `users`, `auth_codes`
- [x] `server/email.js` — Brevo integration
- [x] `server/auth.js` — OTP generation, verification, JWT
- [x] API: send-code, verify, me, logout
- [x] `LoginPage.jsx` — two-step form (email → code)
- [x] `AuthProvider` + `useAuth()`
- [x] Protected routes (redirect to `/login`)
- [x] `DashboardPage.jsx` — empty state "Create first project"
- [x] 30 free credits on registration
- [x] Header shows email and credits balance
