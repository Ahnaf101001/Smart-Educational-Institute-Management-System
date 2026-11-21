# AeroSchool Guardian Mobile App

Flutter app for parents and guardians of the **Smart Educational Institute Management System**.
One guardian account → all linked children → one dashboard, with a child selector that switches
every screen to the selected student.

Built from the three AeroSchool specification documents (Guardian App Spec, Full Workflow, Workflow v2).

## Features

| Area | What the guardian gets |
|---|---|
| Login | Email + password, show/hide, remember me, forgot password (emailed reset link), contact school. No self sign-up. Temporary passwords must be changed on first login. Inactive accounts are told to contact the school. |
| Family Overview | Guardian profile, total children, present today, total due (per-child breakdown), pending homework, child-wise attendance, today's routine, upcoming exams, notices, notifications |
| Student Dashboard | Child selector, attendance %, fee due, pending homework, latest result, today's entry/exit, next exam, class teacher, module grid |
| Student information | ID/roll, class & section, photo, admission info, DOB, blood group, class teacher, emergency contacts |
| Attendance | Monthly calendar, daily status with entry/exit times, late, early leave, leave, percentage, six-month history |
| Academics | Daily and subject-wise routine with teachers, homework/assignments with submission status and marks, class tests, academic calendar, holidays |
| Exams & results | Exam routine, results with subject-wise marks, GPA/grade/position, marksheet PDF, progress report |
| Fees | Total payable, previous due, this month, fee categories, discounts/scholarships, online payment, payment history, receipt PDF |
| Transport | Bus, route, pickup/drop-off, driver contact, schedule, last GPS position (open in Maps) |
| Notifications | Each item names the child; filter by child and by type; unread badge; checked every 60 s while the app is open |
| Profile & support | Contact and address editing, notification preferences, other guardian contacts, school contact, leave application, complaints/feedback, document downloads, change password, sign out (this device or all) |

The server enforces data isolation: a guardian only receives data for students linked to the account,
and the school can hide results or fees per guardian–student link.

## Project layout

```
lib/
  config/      API/web base URLs (dart-define)
  core/        theme, formatting, tolerant JSON parsing
  models/      typed models for every API payload
  services/    ApiClient, auth, guardian portal API, secure token storage, PDF & files
  providers/   AuthProvider, FamilyProvider (child selector), NotificationProvider
  screens/     auth, home, children, attendance, academics, exams, fees, transport,
               notifications, profile, support
  widgets/     async loading/error views, cards, child selector, branding
```

## Run locally

Prerequisites: Flutter 3.50.1, and the backend running (`backend/` → `npm run dev`, port 4001).

```bash
flutter pub get
flutter run                       # Android emulator uses http://10.0.2.2:4001/api/v1
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:4001/api/v1
```

| dart-define | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | web: same origin `/api/v1`; Android emulator: `http://10.0.2.2:4001/api/v1`; others: `http://localhost:4001/api/v1` | Backend REST API |
| `WEB_APP_URL` | web: same origin; Android emulator: `http://10.0.2.2:3001` | School web app (payment sandbox page) |

For `flutter run -d chrome` against the API directly, add the dev origin to `CORS_ORIGIN` in `backend/.env`.

Release builds need an HTTPS API. Plain HTTP is only allowed in Android debug builds and for
local networking on iOS.

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://school.example.com/api/v1
flutter build ipa --release --dart-define=API_BASE_URL=https://school.example.com/api/v1
```

## Docker (web build)

```bash
docker compose up -d --build      # → http://localhost:8088
```

- Container: `AeroSchool_Guardian_Mobile_App`. Compose project: `aeroschool-guardian-mobile-app`. The image is labelled "AeroSchool Guardian Mobile App".
- nginx serves the Flutter web bundle and proxies `/api/` to `BACKEND_URL` (default `http://host.docker.internal:4001`, the API on the Docker host).
- Environment overrides: `BACKEND_URL`, `GUARDIAN_APP_PORT` (default 8088), `WEB_APP_URL` (build arg, default `http://localhost:3001`).
- Rate limiting by guardian IP: the backend trusts `X-Forwarded-For` only from loopback by default. When the API sits behind this container, set `TRUST_PROXY` in `backend/.env` to the proxy's address range (for example the Docker network), so login limits apply per guardian instead of per proxy.

## Admin workflow (web system)

1. **Guardians → App account**: set the guardian's login email and a temporary password, or leave it blank to generate one. The credentials are emailed and shown once to the admin.
2. Link students from the student profile (Guardians tab) or with `POST /guardians/:id/students`. Every child linked to the same guardian appears under one login.
3. **Login history** and **Disable app access** are also row actions on the Guardians page. Disabling access blocks every linked child at once; student records are kept.

## Backend endpoints used / added

Existing: `/auth/login`, `/auth/me`, `/auth/change-password`, `/auth/password/forgot`, `/portal/guardian/home`,
`…/students/:id/{attendance,results,fees,academics,extras}`, `/portal/guardian/complaints`, `/leave/apply`, `/fees/online/*`.

Added for this app (migration `backend/sql/009_guardian_mobile_app.sql`):

- `POST /guardians/:id/account`, `GET /guardians/:id/account`, `GET /guardians/:id/login-history`, `GET /guardians/:id/notification-history`, `POST|PATCH|DELETE /guardians/:id/students[/:studentId]` (admin)
- `GET|PATCH /portal/guardian/profile`, `GET /portal/guardian/school`, `GET /portal/guardian/students/:id/{profile,documents}`, `GET …/documents/:docId/file`, `GET /portal/guardian/receipts/:receiptNo`, `GET /portal/guardian/leave-types`, `GET /portal/guardian/notifications/unread-count`, `POST /portal/guardian/notifications/read`
- First-login password enforcement (`users.must_change_password`), per-link `can_view_results` / `can_view_fees`, `ACCOUNT_INACTIVE` login code, and guardian-scoped `GET /fees/online/:id`.

## Push notifications

The app polls for new notifications every 60 seconds while it is open and shows an in-app alert.
Background push (FCM/APNs) needs a Firebase project and server key, which this repository does not
contain. Add `firebase_messaging` and a backend sender once those credentials exist. SMS and email
alerts keep working through the backend's existing notification queue.
