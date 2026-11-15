# Smart Educational Institute Management System – API

Node.js + Express + PostgreSQL REST API. One system for General line (Bangla
medium, English version), English medium, Alia madrasa, Qawmi madrasa,
kindergarten and college, built from the consolidated SRS v3.0, the School &
Madrasa SRS v1.0 and the AeroSchool feature list.

## Modules

- Institution setup: profile & branding (logo, signature, seal), education-line presets, sessions (activate/close/archive), branches, shifts, groups, rooms
- RBAC: module × action permissions, multiple roles per user, class scope, sensitive-field masking, maker–checker approvals, delegation, append-only audit log
- Admission: circulars, online application portal, duplicate detection, status pipeline, test marks, merit / lottery / waiting list, admit cards, confirmation → student + guardian + enrollment + invoices
- Students & guardians: 360° profile, enrollment history, sibling detection, primary guardian, portal accounts, documents, status history, promotion (approval), roll assignment, Excel/CSV import with validation, certificates (TC, testimonial, character, study, sanad)
- ID Card Center: 5 student + 5 teacher templates, customization (colours, fonts, fields, drag positioning, front/back, QR/barcode, size/orientation), draft/publish versions, validation, bulk generation, print jobs, reprint, replacement, public QR verification
- Attendance: students (edit window, correction approval, guardian SMS), period-wise, staff in/out, leave with balances, devices (face / fingerprint / RFID / QR / mobile), entry-exit alerts, reports, consecutive-absence alerts
- Exams & results: exam setup, routine, admit cards, component marks entry with lock/unlock, grading engine (NCTB GPA 5.0 + 4th subject, BMEB, Qawmi divisions, Cambridge A*–U, kindergarten), merit & tie-break, combined weighted results, review → approval → publish, correction versions, tabulation & analytics, online result lookup
- Fees & accounts: fee heads/structures, invoice generation, late fines, discounts/scholarships/waivers (approval), partial/advance/combined sibling payments, serial receipts, cancellation & refunds (approval), cash closing, online gateways with idempotent callbacks, chart of accounts, vouchers, cash book, ledger, trial balance, bank reconciliation, fund-wise (Zakat rule)
- HR & payroll, communication (notices, SMS/email/push queue, templates, delivery log, guardian–teacher messaging, complaints, PTM), library, inventory & assets, visitors, transport & GPS, madrasa (halaqa, hifz, salah, hostel, meals, donations), online classes, dashboards, report library, analytics
- Portals: guardian portal and teacher “My Day”; background worker for notifications, invoices, reminders, late fines, auto-lock, expiry and daily backups

## Setup

```bash
cd backend
copy .env.example .env
npm install
docker compose up -d        # PostgreSQL (project: smart-educational-institute-management-system)
npm run db:setup            # migrations + admin + system defaults (roles, grading, 10 ID card templates…)
npm run dev
```

API: `http://localhost:4000/api/v1` · Health: `http://localhost:4000/health`

After the first login go to **Settings → Institution Setup → Institution Type** and apply one or more education lines.

## Integrations

Providers are configured in `.env`. Without them the system stays honest: SMS/email
messages remain *Queued*/*Failed* with the reason in the delivery log, and online
payments are only possible through the development sandbox.

- Attendance devices: `POST /api/v1/public/devices/events` with header `X-Device-Key` (generate per device in Attendance → Devices).
  Body: `{ "events": [{ "credential": "<RFID UID / device user id / QR>", "type": "IN", "time": "ISO-8601" }] }`
- GPS trackers: `POST /api/v1/public/gps` with `X-GPS-Key`, body `{ "deviceId", "lat", "lng", "speed" }`
- Payment callback: `POST /api/v1/public/payments/callback/:gateway` signed with `X-Signature = HMAC-SHA256(PAYMENT_CALLBACK_SECRET, rawBody)`

## Backups

Daily JSON snapshots (with checksum) are written to `BACKUP_DIR`; Settings → Backup
runs a non-destructive restore drill. For disaster recovery also schedule:

```bash
docker exec edumanage-postgres pg_dump -U postgres -Fc madrasha_edumanage > backup.dump
```

## Data reset

`npm run db:clean` removes business data but keeps the schema, the admin account and system configuration.

## Default admin

`admin@school.edu` / `Admin@123` (from `.env`) – change it after the first login.
