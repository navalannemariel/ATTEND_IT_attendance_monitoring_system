# ATTEND IT — Attendance Monitoring System

AI-driven attendance monitoring web app for Holy Heart Christian Academy (HHCA), Manila. This repository contains the **frontend** (Next.js App Router) with role-based dashboards for administrators, teachers, and guidance counselors.

> **Live website:** https://hhca-attendance.site
>
> **Mobile app (Android APK):** _paste your Google Drive APK link here_
>
## Test accounts (web)

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@hhca.edu.ph | admin1234 |
| Guidance counselor | mm@gmail.com | Hhca1234 |
| Teacher | t1@gmail.com | Hhca1234 |

## Features

- **Login and account security:** Firebase Authentication, OTP verification, forgot/reset password, forced password change, privacy consent.
- **Admin:** users (employees and students), sections, subjects, school years, calendar, announcements, advisory announcements, teacher attendance, settings, SF2 report export.
- **Teacher:** dashboard, attendance, schedule, learners, compose, profile.
- **Guidance:** student profiles, attendance cases and referrals, announcements, profile.
- **Dev page** (`/dev`) for testing attendance rules (habitual tardiness, consecutive absences, absence percentage, unexcused absences) and creating test cases.

## Tech stack

- Next.js (App Router, JavaScript/JSX) and React
- Tailwind CSS, `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`
- `lucide-react` (icons), `sonner` (toasts), `recharts` (charts), `next-themes`
- Firebase Auth (`firebase`)
- A separate REST backend (see below)

## Prerequisites

- Node.js 18.18+ (20 LTS recommended) and npm
- A running backend API that implements the endpoints the frontend calls (see [Backend](#backend))
- Access to the Firebase project configured in `src/lib/firebase.js`, or your own Firebase project

## Local setup

### 1. Clone

```bash
git clone https://github.com/navalannemariel/ATTEND_IT_attendance_monitoring_system.git
cd ATTEND_IT_attendance_monitoring_system
```

### 2. Add the project scaffolding (one-time)

The repository currently ships only `src/` and `.gitignore`. It has no `package.json` or Next.js config, so create them first:

```bash
npm init -y
npm install next react react-dom firebase lucide-react sonner recharts next-themes \
  clsx tailwind-merge class-variance-authority @base-ui/react
npm install -D tailwindcss @tailwindcss/postcss postcss eslint eslint-config-next
```

Add scripts to `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

Then add the following:

- **`jsconfig.json`**: the code imports with the `@/` alias, so map it to `src/`:

  ```json
  { "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
  ```

- **`postcss.config.mjs`**: for Tailwind v4:

  ```js
  const config = { plugins: { "@tailwindcss/postcss": {} } };
  export default config;
  ```

- **`next.config.mjs`**: an empty config is fine (`export default {};`). Add image domains here if you use remote images with `next/image`.

> Tip: if you still have the original project folder from before this was pushed, copy its `package.json`, `package-lock.json`, `jsconfig.json`, `postcss.config.mjs`, and `next.config.*` into the repo root instead of recreating them. Then commit them so the next person can run `npm install` directly.

### 3. Configure environment variables

Create `.env.local` in the project root:

```env
# Base URL of the backend REST API (must include /api)
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

If unset, the app defaults to `http://localhost:8000/api`.

### 4. Firebase

Firebase config is currently **hard-coded** in `src/lib/firebase.js` (project `hhca-attendance`). To use your own project, replace the values there. For better hygiene, move them into `NEXT_PUBLIC_FIREBASE_*` variables. In the Firebase console, enable **Email/Password** sign-in and add `localhost` (and your deployed domain) under **Authentication → Settings → Authorized domains**.

### 5. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You'll land on the login page.

Production build:

```bash
npm run build
npm start
```

## Backend

The frontend talks to a REST API at `NEXT_PUBLIC_API_URL` and sends the Firebase ID token as `Authorization: Bearer <token>`. The backend is **not part of this repository**. Endpoints referenced in the code include:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth/me` | Current user and role |
| POST | `/auth/otp/send`, `/auth/otp/verify` | Login OTP |
| POST | `/auth/forgot-password/verify-otp`, `/auth/forgot-password/reset` | Password recovery |
| POST | `/auth/change-password` | Forced/voluntary password change |
| POST | `/referrals` | Create a referral |
| PATCH | `/referrals/:id/schedule` | Schedule a conference |
| POST | `/dev/create-case` | Dev-only test case creation |

Other pages call additional endpoints through `src/lib/api.js`. Start the backend on port 8000 (or point `NEXT_PUBLIC_API_URL` at wherever it runs) before logging in. The API should return `401` for expired tokens and `403` with `code: "PASSWORD_CHANGE_REQUIRED"` when a password change is required, since the client handles both.

## Roles and routes

| Role | Base route |
| --- | --- |
| Admin | `/admin` |
| Teacher | `/teacher` |
| Guidance counselor | `/guidance` |

Shared routes: `/login`, `/verify-otp`, `/forgot-password`, `/reset-password/[token]`, `/change-password`, `/privacy`, `/privacy-consent`.

## Project structure

```
src/
├── app/            # Next.js routes (admin, teacher, guidance, auth pages)
├── components/     # UI primitives, dashboard components, auth provider
└── lib/            # API client, Firebase init, auth helpers, exports, config
```

## Deployment

Any Next.js host works (e.g. Vercel):

1. Push the repo with `package.json` committed.
2. Set `NEXT_PUBLIC_API_URL` to your deployed backend URL.
3. Add the deployed domain to Firebase **Authorized domains**.
4. Build command: `npm run build`; output: Next.js default.

Then paste the live URL at the top of this README.

## Notes

- `src/lib/mock-data.js` contains placeholder data used by some dashboards.
- `src/lib/auth.js` contains hard-coded sample credentials (admin/teacher/guidance). At least the admin one matches a real account on the live site, so remove them from the code and change those passwords.
- Firebase web config values are not secret, but access should be locked down with Firebase security settings and authorized domains.
