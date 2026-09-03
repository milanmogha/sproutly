# Sproutly — Pre-School Management System

A single application serving four roles — **Super Admin**, **Admin (School)**, **Teacher (Staff)**, and **Parent** — backed by a shared NestJS/MongoDB API, with a native Flutter app (parent/teacher/admin/super-admin on mobile) and a React web admin panel.

This document captures the target workflow (from the four planning diagrams: `SuperAdmin.png`, `Admin(OR)SchoolWorkflow.png`, `TeacherWorkflow.png`, `ParentAppWorkflow.png`) and maps it to what exists in the repo today.

## Repository layout

| Path | What it is | Deployed as |
|---|---|---|
| `Pre-School-app-Frontend/` | Flutter app — all 4 roles (mobile) | — |
| `SchoolSuperAdmin/` | React + Vite web console — Admin & Super Admin | `admin.sproutly.duforge.tech` |
| `School-backend/` | NestJS + MongoDB API used by both frontends | `api.sproutly.duforge.tech` |
| `Pre School Management.pdf` | Original product spec | — |
| `*.png` | Workflow diagrams (source of truth for this README) | — |

Each of the three lives in its own git repository with its own changelog; the detail behind
anything below is in `School-backend/README.md`, `SchoolSuperAdmin/README.md`, or
`Pre-School-app-Frontend/README.md`.

Both deploys run from a **self-hosted GitHub Actions runner on the VPS** — GitHub-hosted runners
can't reach the host on port 22, so the runner dials out instead.

## The two flows of money

These are separate systems and conflating them would be expensive, so they're named apart
everywhere in the code:

| | Direction | Collected into | Where it's configured |
|---|---|---|---|
| **Fees** | parent → school | the **school's own** Razorpay account | super admin enters each school's keys; the school can neither read nor change them |
| **Subscription** | school → Sproutly | the **platform's** Razorpay account | `PLATFORM_RAZORPAY_*` on the server |

A school's subscription is billed per invoice for an arbitrary number of days — there are no fixed
plans, so a 15-day trial and a two-year contract are the same shape. Paying early never loses
days, and a lapsed plan locks the **admin** first (after a grace window) and the rest of the
school much later, because teachers and parents aren't the ones who owe anything.

## Roles

One app, four roles, one login surface:

- **Super Admin** — creates and manages Admins/Schools (multi-school), sees all admin/school info on a dashboard. Has its own web app (`school-admin`).
- **Admin / School** — runs a single school: staff, students, admissions, fees, attendance, communication, events, reports.
- **Teacher / Staff** — added by Admin. Manages attendance, students, academics, daily preschool updates, communication, gallery, leave.
- **Parent** — added by Admin (via student enrollment). Views child data, attendance, fees, academics, daycare updates, communication, transport, events.

> Note from the workflow diagrams: there can be multiple teachers per school; **teachers and students are both added by Admin**, not self-registered.

---

## Super Admin workflow

- Create and manage Admins — one Super Admin can operate **multiple schools**
- Dashboard surfaces all admin/school info: users (admins) and their internal/admin-level data
- Dedicated **Super Admin web app**

## Admin / School workflow

- **Dashboard** — School Dashboard, Enrollment Summary, Fee Collection Summary, Attendance Summary, Staff Summary
- **Admissions** — Admissions Tracking, Inquiry Management, Approval Workflow, Waitlist Management
- **Student Management** — Student Records, Class Allocation, Transfer Management
- **Staff Management** — Staff Management, Teacher Management, Leave Approval, **Payroll Overview**
- **Fee Management** — Fee Monitoring, Outstanding Dues, Payment Reports, Collection Reports
- **Attendance** — Student Attendance Dashboard, **Teacher Attendance Dashboard**
- **Communication** — Push Notifications, Circulars, Emergency Broadcasts, **1:1 chat with teachers and parents** (query resolution)
- **PTM** — decides every meeting: schedules or declines a teacher's request, and can call a PTM for whole classes
- **Event Management** — Push Notifications, Circulars, Emergency Broadcasts
- **Reports & Analytics** — Attendance Reports, Fee Reports, Enrolment Reports, Staff Reports

## Teacher / Staff workflow

- **Dashboard** — Today's Classes, Attendance Summary, Pending Tasks, Upcoming Events
- **Attendance** — Attendance Marking, Attendance Dashboard, **Late Arrival Tracking**
- **Student Management** — Student List, Student Profiles, Health Alerts, Special Instructions
- **Academic** — Activity Updates, Assessments, Homework, Result Entry, Syllabus Management, Lesson Planning
- **Daily Preschool Updates** — Meal Tracking, Nap Tracking, Daily Activity Logs, Behavioral Observations
- **Communication** — Messaging & Circulars, Parent Communication, chat with the **school office**, PTM requests (one student or a whole class — the office schedules them)
- **Gallery** — Upload Photos, Upload Videos
- **Events / Reports** — Event Participation Updates, Event Attendance
- **Transport** — Student Transport Information
- **Leave Management** — Apply Leave, Leave Status View

## Parent workflow

- **Dashboard** — Child Summary, Today's Attendance, Upcoming Events, Pending Fees, Recent Notifications
- **Student Profile** — Child Profile, Parent/Guardian Details, Emergency Contacts, Medical Information, Vaccination Records, School Contacts, Settings, FAQ, About Us, Logout
- **Attendance** — Attendance View, Check-in/Check-out Time, Monthly Attendance Report, **school holidays on the calendar** (blue dot)
- **Fees & Payments** — Fee Payments, Fee Receipts, Fee History, Pending Dues, Payment Reminders
- **Daycare (\*)** — Meal Updates, Nap/Sleep Updates, Daily Activity Report, Health Updates, Digital Preschool Diary
- **Academic** — Child Progress, Assessments, Result/Progress Report, Syllabus/Curriculum, Homework, Learning Milestones, Teacher Remarks
- **Communication** — Notifications, Messaging & Circulars (chat with the class teacher **and the school office**), **PTM: notified only** — a parent does not request or accept a meeting, they are told what the school decided — Emergency Alerts
- **Transport** — Transport Details, Vehicle Information, Driver Contact, Pickup/Drop Notifications
- **SMS Integration OR WhatsApp** — Fee reminders, Attendance alerts, Homework notifications, Event reminders
- **Gallery** — Photo Gallery, Video Gallery
- **Events** — Event Calendar, Event Registration, Event Reminders
- **Leave Management** — Apply Leave, Leave Status Tracking

---

## Fee Management — how it works end to end

There is **no payment gateway**. The parent pays at the school (cash / card / UPI / bank transfer / cheque) and the admin records it. The app is the record-keeping system, not a payment processor.

```
1. Structure  →  2. Invoices   →  3. Payment   →  4. Receipt
   created         generated        recorded        issued
```

1. **Admin creates a Fee Structure** (a *template* — nobody is charged yet). Name, frequency (monthly/quarterly/term/annual/one-time), academic year (`2026-2027`), components (Tuition ₹15,000 + Materials ₹3,000 …), due day of month. `totalAmount` is auto-calculated by the backend.
2. **Admin generates invoices** — pick a structure, a class, a period (`2026-07`) and a due date. The backend creates **one invoice per student in that class**, each auto-numbered (`INV-2026-00001`) and snapshotting the structure's line items. Re-running the same period is safe: already-invoiced students are **skipped**, and the call returns `{created, skipped}`.
3. **Parent sees their dues** — Pending tab (outstanding total, each unpaid invoice) and History tab (paid), with a per-invoice breakdown.
4. **Admin records the payment** — full or partial, with method and an optional note. The backend creates a `Payment`, updates `amountPaid`, moves the invoice to **Partial** or **Paid**, and issues a `Receipt` (`RCP-2026-00001`). Every payment gets its own receipt, so ₹12,000 cash + ₹8,000 UPI on a ₹20,000 invoice produces two receipts.

**Status lifecycle:** `Pending → Partial → Paid`, with `Overdue` once the due date passes while a balance remains.

**Guard rails (verified live):** overpaying is rejected (*"Amount exceeds outstanding balance"*), and paying an already-settled invoice returns **409**.

> **Note:** an invoice snapshots its line items, so *the invoice — not the structure — is what a student owes*. Per-student variation (transport opt-out, sibling discount, mid-year joiner) belongs on the invoice, which is why fee structures are per **class**, not per student. See "Known gaps" below.

---

## Communication & PTM — how it works end to end

### Chat

One private 1:1 thread per pair of people. `Message` is just `sender` → `recipient` (plain `User` refs, no role checks), so the same chat serves three pairings:

```
Parent ──── Teacher        (about a child)
Parent ──── School office  (a query)
Teacher ─── School office  (a query)
```

**Admin↔teacher and admin↔parent are separate conversations, and neither shows the teacher↔parent one** — the admin can't read a chat they're not in. Who you may open a thread with comes from `GET /communication/messages/contacts`: the office sees every teacher and parent; teachers and parents see the office. (Teacher↔parent pickers stay roster-driven — a teacher's classes, a parent's class teacher — so nobody gains a new peer to message.)

Real-time over the Socket.IO `/chat` namespace (typing indicators, presence, read receipts). When the recipient isn't connected, the message falls back to an in-app notification, typed `message` and carrying the sender, so tapping it opens the thread.

### PTM

One rule: **the school calls a meeting; the parent is told.**

```
Teacher raises a request   →   Admin schedules   →   Parent is notified
(one student, or a whole       or declines it        (read-only: they see it,
 class they teach)                                    they don't accept it)

Admin calls a PTM directly →   already scheduled →   Parent is notified
(whole classes at once)        (no approval step)
```

Afterwards, the meeting is marked done by the admin or by the teacher it was with.

- **A parent never requests a meeting and never accepts one.** Both routes exclude `PARENT` server-side, not just in the UI. Their PTM tab is a read-only list; a pending meeting reads *"Awaiting confirmation from the school"*.
- **The admin decides.** Scheduling and declining are office-only, and scheduling asks for a date and time — that date is what every parent is told.
- **Class-wide PTMs create one meeting per student**, not one broadcast, so each parent sees their own child's meeting and it can be completed individually. Students with no linked parent account are skipped and reported back as `{created, skipped}`.
- **Marking done** is the admin's or the meeting's teacher's — and only once the booked day has arrived. Judged by day, not minute: a 3pm meeting can be closed off that afternoon, but tomorrow's cannot be closed today.

---

## Current state vs. target workflow

**Legend:** ✅ built · 🟡 partial/stub · ❌ missing

| Area | Flutter app | Web admin | Backend | Notes |
|---|---|---|---|---|
| Students / Classes / Attendance / Fees / Admissions / Academic / Daycare / Communication | ✅ | ✅ | ✅ fully built | Core loop is solid on all three layers |
| Leave · Events · Gallery · Transport · Notifications (in-app list) · Holidays | ✅ | — | ✅ built | Real modules with persistence (see backend changelog v1.0.4 → v1.1.5). *Device* delivery of notifications is the separate push row below |
| Fee Management (structures → invoices → payments → receipts) | ✅ | ✅ | ✅ | Full flow verified end-to-end against a live server, incl. partial payments and duplicate-generation guard |
| Real-time chat — Parent ↔ Teacher, **Admin ↔ both** | ✅ | — | ✅ | Socket.IO `/chat` namespace; typing indicators, presence, read receipts. The admin resolves teacher/parent queries in-app; threads stay private 1:1 |
| **PTM** (teacher requests → admin decides → parent notified) | ✅ | 🟡 list only | ✅ | Incl. class-wide PTMs (one meeting per student) and date-gated completion. The web panel's PTM tab predates this and still offers Schedule/Decline without a date |
| Notification deep-links (tap → the thing it's about) | ✅ | — | ✅ | All 9 notification types route per role; previously only `profile_change_request` went anywhere |
| **Push notifications** — delivered to the device, app open / backgrounded / **closed** | ✅ Android<br>❌ iOS | — | ✅ | Firebase Cloud Messaging. Every existing trigger (attendance, fees, homework, events, circulars, messages, PTM) pushes, since they all already routed through `NotificationsService`. Needs a service account key on the server; iOS needs an APNs key + Apple account + a Mac |
| School holidays on the attendance calendars | ✅ | — | ✅ | Blue dot; an attendance record still wins over it. Same calendar (present/absent/late/holiday dots) now also backs the admin's & teacher's per-student reports and the admin's per-teacher reports |
| Notification unread badge on the bell (all four roles) | ✅ | — | ✅ | Count badge on the home-screen bell; refreshes on read/dismiss, on returning from the list, on foreground pushes, and on app resume. Uses the existing `GET /notifications/me` — no new endpoint |
| Staff (Teacher mgmt, Leave approval) | ✅ | 🟡 placeholder | 🟡 stub | Leave approval is real; the dedicated `staff` module is still a stub |
| **Payroll Overview** (Admin) | ❌ | ❌ | ❌ | Not present anywhere — new requirement from the diagram |
| Reports & Analytics (real aggregation) | 🟡 | — | 🟡 stub | Fee collection/outstanding reports are real; the generic `reports` module is still a stub |
| Teacher Attendance Dashboard (analytics, not just marking) | ✅ | — | ✅ | Admin marks the roster and can open a per-teacher monthly report (parent-style calendar) from Attendance → Teachers; Reports shows separate student/teacher today-summaries. Late-arrival tracking is the remaining gap |
| Late Arrival Tracking | ❌ | — | ❌ | Not implemented |
| **WhatsApp / SMS Integration** | ✅ OTP | — | ✅ wired, 🟡 blocked | Parent login codes go out over WhatsApp via a provider abstraction (`meta` \| `buzzflow`). The dev-only email/terminal fallbacks are gone. **Currently blocked on the vendor account** — see gap 4. SMS remains a logging stub |
| **Subscription billing** (school → Sproutly) | ✅ | ✅ | ✅ | Per-invoice, arbitrary durations, online or office payment; tiered lockout on expiry (admin at grace+, everyone else much later) |
| **Printable fee receipts (PDF)** | ✅ download | ✅ download | ✅ | Reproduces the school's own receipt layout. One template serves both an unpaid invoice and a settled receipt, so both are downloadable |
| Super Admin — multi-school management | ✅ | ✅ (web) | ✅ | `schoolId` scoping enforced across ~20 modules; tenant isolation verified |
| Backend ↔ Flutter integration | ✅ | ✅ | — | **All four roles run on the live NestJS API** via Dio (`lib/core/network/`), with bearer-token attach and single-flight refresh |
| Login sessions (stay signed in) | ✅ | ✅ | ✅ | A session lasts **until the user logs out** — per-device refresh sessions (cap 5), 15-min access token refreshed silently. Both clients resume on relaunch/reload |

---

## Known gaps

1. **Build out the `staff` backend module.** Real teacher/non-teaching-staff records and staff reporting still need endpoints; leave approval itself is done.
2. **Add Payroll Overview.** Not present in any layer — needs a data model (salary, payslips, deductions) plus an Admin screen. Net-new feature, not a wiring gap.
3. **Flesh out the generic `dashboard` / `reports` modules.** Fee reports are real; the cross-cutting "Enrolment / Attendance / Staff report" surface is not.
4. **WhatsApp is wired but not yet delivering.** Parent login codes now route through a provider abstraction (`meta` — Cloud API direct — or `buzzflow`, a reseller panel), and the dev-only fallbacks that printed the code to the terminal and emailed it have been removed. Two things still stand in the way:
   - **The vendor account.** BuzzFlow returns Meta Graph `code 100 / error_subcode 33` on its own sending number (`GraphMethodException`, "Object … does not exist, cannot be loaded due to missing permissions"). Identical for every recipient, so it's their WhatsApp Business number or token, not our payload. Only fixable on their side.
   - **The 24-hour window.** `send_session` sends *free-form* text, which Meta delivers only inside a window the recipient opened. A login code is unprompted, so this needs a **template** endpoint and an approved authentication template. Worth confirming the vendor supports that before investing further — otherwise SMS (`sms.service.ts`, still a logging stub) is the shorter path for OTP, and WhatsApp is better spent on messages that follow a parent's reply.
   Broader templated triggers (fee reminders, attendance alerts, homework, event reminders) remain unbuilt, and business-initiated WhatsApp is priced per conversation unlike push.
5. **Push notifications on iOS.** Android is done. FCM on iOS is a wrapper over APNs, so it additionally needs `GoogleService-Info.plist`, an APNs `.p8` key, the Push capability, a **paid Apple Developer account ($99/yr)**, and a **Mac to build on**. All the Dart is shared and unchanged — only native config is missing, and the backend already sends the `apns` payload block.
6. **The backend cannot send push until a service account key is added.** The code is live but credential-less: it boots logging `Push disabled: no Firebase service account found`. Drop the key at `School-backend/firebase-service-account.json` (Firebase Console → Project Settings → Service accounts) and it flips to `Push enabled`.
7. **Late Arrival Tracking.** The teacher-attendance dashboard itself is done (marking + per-teacher monthly reports + today's summary in Reports), but admins mark teachers present/absent only — there's no late status or arrival-time capture for staff.
8. **Per-student fee variation.** Structures are per class, and `generateInvoices` bills every student in the class identically. There's no UI to issue a one-off/corrected invoice (the backend's `POST /fees/invoices` exists but `AdminApi` never calls it), and `InvoiceLineDto.amount` is `@Min(0)`, so a discount/waiver ("Sibling discount −₹2,000") can't be expressed. Needed for transport opt-outs, scholarships, and mid-year joiners.
9. **Invoices can't be deleted.** No `DELETE` route — a mis-generated batch can only be undone at the database level.
10. **"Unpaid" ≠ "unbilled".** The Fees screen lists students who have an *unpaid invoice*; a student who was never included in a generate run has no invoice and appears nowhere. A true "every child, paid or not" roster needs a query that starts from the student list and left-joins invoices.
11. **The web panel's PTM tab predates the new PTM rules.** `CommunicationPage.tsx` sends `{status: 'scheduled'}` with **no `scheduledAt`**, so scheduling from the web produces a meeting with no date — and since completion requires a date that has arrived, such a meeting can never be marked done. The Flutter admin asks for date+time; the web panel needs the same prompt (or the backend should reject a dateless `scheduled`). The panel also has no chat, while the Flutter admin does.
12. **No duplicate guard on class-wide PTMs.** Calling a PTM for the same class twice creates a second set of meetings. Arguably correct (two genuine meetings); if not, the rule would be to skip students who already hold an open (`requested`/`scheduled`) meeting.
