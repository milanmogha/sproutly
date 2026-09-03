# school-backend

Version **1.3.0**

NestJS + MongoDB backend for the Sproutly pre-school management system.

## Stack
NestJS 11 · MongoDB / Mongoose · Passport JWT · class-validator · firebase-admin (FCM) · Jest

## Fully built modules
students · classes · attendance · fees · daycare · academic · admissions · communication · leave · events · holidays · notifications (incl. **push**) · gallery · transport

## Scaffolded modules (stubs, mapping to planned features)
whatsapp · sms · staff · achievements · diary · reports · dashboard

## Getting started
```bash
npm install
cp .env.example .env        # configure Mongo URI, JWT secrets, etc.
npm run seed                # create the initial super-admin
npm run start:dev           # http://localhost:3000/api
```

### Push notifications (optional, but needed for real delivery)

Device delivery goes over Firebase Cloud Messaging and needs a **service account
key** — separate from the app's `google-services.json`, which only lets the app
*receive*:

> Firebase Console → Project Settings → **Service accounts** → Generate new private key

Save it as `School-backend/firebase-service-account.json` (git-ignored) or point
`FIREBASE_SERVICE_ACCOUNT_PATH` elsewhere. On a host with no filesystem, paste the
same JSON into `FIREBASE_SERVICE_ACCOUNT` as a single line instead.

On boot the log says which mode you're in:

```
[PushProvider] Push enabled (Firebase Cloud Messaging).
[PushProvider] Push disabled: no Firebase service account found. …
```

**Push is optional.** With no key configured the provider disables itself and
every send is a no-op — notifications are still stored and still appear in the
app's in-app list, they just aren't delivered to devices. Local development
works with push off.

## Scripts
- `npm run start:dev` — watch mode
- `npm run build` — compile
- `npm run lint` — eslint
- `npm test` — unit tests
- `npm run test:e2e` — e2e tests (requires MongoDB; 59 tests across 9 suites)
- `npm run seed` — seed the super-admin account

## Notes
- `.env` holds secrets and is git-ignored — never commit it.

## Changelog


### v1.0.0 — Super Admin multi-school management (2026-07-02)
Backend turned multi-tenant so one platform can host many schools.

- [x] **School module** — CRUD, soft-delete, `stats`, and `GET /schools/:id/overview` (school info + student/teacher/parent/account counts).
- [x] **School creation bootstraps its admin** — `POST /schools` accepts a nested `admin:{ name, email, password }` and creates the school's login account in the same request (a school *is* its admin).
- [x] **`POST /schools/:id/admins`** — add further admins to an existing school.
- [x] **Multi-tenancy scoping** — `schoolId` added to every data-owning schema (~20 modules); JWT now carries `schoolId` (null only for super_admin); shared `scopeFilter()` + scoped `findOne` enforce isolation.
- [x] **Users scoped by school** — a school admin only sees/creates users in their own school; super admin sees across all and can filter by `?schoolId=`.
- [x] **Tenant isolation verified** — School A's admin gets 404 on School B's records; super admin sees all.
- [x] **Fix:** `@Prop` refs switched from `Types.ObjectId` to `SchemaTypes.ObjectId` (the former silently produced `Mixed` paths / string-stored refs) and existing data migrated to real ObjectIds.

_Known limitation:_ reassigning a user's school takes effect only after their JWT expires (~15 min).

### v1.0.1 — Invite-based admin onboarding (2026-07-02)
Admins are now onboarded by invitation instead of the super admin typing their password.

- [x] **Password optional at creation** — `POST /schools`, `POST /schools/:id/admins`, and `POST /users` accept name + email only. When no password is given, the account is created **inactive** with a single-use, sha256-hashed, expiring invite token; the invite link is emailed (and returned in the response for now).
- [x] **`GET /auth/invite?token=`** — validates a token and returns the email/name for the set-password page.
- [x] **`POST /auth/accept-invite`** — the user sets their password, which activates the account; the token is single-use.
- [x] **Login guard** — a pending (no-password) account cannot log in until activated.
- [x] **`MailService`** — pluggable outbound email; logs the invite link until a real provider (SMTP/SendGrid/Resend) is dropped in. New env: `WEB_APP_URL`, `INVITE_TTL_HOURS`.
- [x] **Backward compatible** — passing a password still activates the account immediately.

### v1.0.2 — Parent OTP login + Admin wired to real backend (2026-07-02)
Parents log in by phone + OTP; Admin role screens now use the real API.

- [x] **OTP auth** — `POST /auth/otp/request` generates a sha256-hashed 6-digit code (TTL: 5 min, max 5 attempts, single-use). Returns `devCode` in dev mode (no SMS provider needed). `POST /auth/otp/verify` returns a signed JWT with `role: parent`.
- [x] **Parent auto-provisioning** — `POST /students` with `parentPhone` calls `usersService.findOrCreateParent()` — the parent's phone-OTP login is created automatically when admin enrols the student. Idempotent for siblings.
- [x] **`SmsService` stub** — mirrors `MailService`; logs OTPs instead of sending; one `deliver()` method to wire a real SMS provider later.
- [x] **`User.email` sparse+unique** — parents have no email; `email` is now optional with a sparse unique index (many `null`s allowed, all non-null emails unique).
- [x] **`Student.parentUserId`** — links a student to their parent's `User` document; set at enrolment time.

### v1.0.3 — Teacher and Parent roles wired to real backend (2026-07-02)
Backend patch to support parent children query.

- [x] **`QueryStudentsDto.parentUserId`** — new optional `@IsMongoId()` field so `GET /students?parentUserId=<id>` returns only that parent's children.
- [x] **`StudentsService.findAll`** — applies `filter.parentUserId` when the query param is present; uses `new Types.ObjectId(parentUserId)` to cast correctly.

### v1.0.4 — Leave & Events become real modules; all portals feature-complete (2026-07-03)
The generic title/notes stubs for leave and events were replaced with real domain models so every portal workflow (Parent / Teacher / Admin) has a live backend.

- [x] **Leave module rebuilt** — `LeaveRequest` now carries `applicantId`/`applicantRole` (from the JWT), optional `studentId` (parent applying for a child), `type` (sick/casual/vacation/other), `fromDate`/`toDate`, `reason`, `status` (pending → approved/rejected/cancelled), `reviewedBy`, `reviewNote`.
- [x] **Leave roles opened** — any authenticated user can `POST /leave`; non-admins listing `GET /leave` see only their own requests; `PATCH /leave/:id` (approve/reject) is admin/principal-only; new `PATCH /leave/:id/cancel` lets an applicant cancel their own pending request. `?status=` filter added.
- [x] **Events module rebuilt** — `Event` now has `title`, `description`, `startDate`/`endDate`, `venue`, `audience` (all/parents/teachers), `createdBy`; `GET /events?upcoming=true` sorts by start date.
- [x] **Event registrations** — `POST /events/:id/register` (any role; parents pass `studentId`), `GET /events/:id/registrations` (staff), `GET /events/registrations/mine`; duplicate registrations rejected via a unique index.

### v1.0.5 — Indian phone format, SMTP email, workflow fixes (2026-07-03)
Full workflow verified end-to-end against a live server (46 checks: super admin → school → class/teacher/student → parent OTP → homework/attendance/fees/leave/events/PTM/daycare/admissions) — every bug found was fixed.

- [x] **Indian mobile numbers everywhere** — new `phone.util.ts` with `INDIAN_PHONE_REGEX` (DTO validation: OTP request/verify, student guardians/parentPhone, inquiries, admissions) and `normalizeIndianPhone()`; parent accounts store/match the canonical `+91XXXXXXXXXX` form, so `98765 43210`, `098…`, `9198…` and `+91 98…` all reach the same login.
- [x] **One parent phone = one school** — `findOrCreateParent` reuses the account for siblings in the same school and 409s when the phone already belongs to a parent at another school (previously OTP login could land in the wrong school's account).
- [x] **SMTP email via nodemailer** — `MailService.deliver()` sends through `SMTP_*` env config (`mail.config.ts`); placeholder credentials added to `.env`/`.env.example` with `SMTP_ENABLED=false` so dev keeps logging; delivery failures are logged, never thrown.
- [x] **Fix: `users.email_1` index** — live collection still had the pre-v1.0.2 non-sparse unique index, so the *second* phone-only parent failed with `E11000 … email: null`; recreated as sparse+unique.
- [x] **Fix: PTM visibility** — parent PTM requests are created unassigned (`teacher: null`) and were invisible to every teacher; `GET /communication/ptm/assigned` now also returns unassigned requests (responding claims them).

### v1.0.6 — UI/UX polish: smooth animations (2026-07-03)
No backend changes in this patch — mobile-only changes described in the Flutter README.

### v1.0.7 — Parent Complete-Profile + parent/teacher portal data (2026-07-04)
Admins seed only the basics; the parent completes (and locks) the rest of the student profile. Several parent/teacher screens were wired to real data, and per-student check-in/out was retired. All changes verified end-to-end against a live DB.

- [x] **Parent Complete-Profile feature (major)** — `Student.profileCompleted` / `profileCompletedAt`. New parent-only, ownership-checked endpoints: `PATCH /students/:id/profile` (`CompleteProfileDto`: address, guardians, emergency contacts, medical info) fills the profile **once**, then returns **403** on any re-submit; `POST /students/:id/change-request` notifies the school's admins/principals via `NotificationsService`. Admins still edit freely via `PATCH /students/:id`.
- [x] **Admin's parent seeded as a guardian** — the `parentName`/`parentPhone` typed into the admin add-student form is now seeded onto the student as a primary guardian at creation (`students.service.ts` `seedGuardianFromParent`), so it shows before the parent completes the profile.
- [x] **School contacts** — new `GET /schools/mine` returns the caller's own school (any signed-in role; a method-level `@Roles` override of the otherwise super-admin-only schools controller) so parents/teachers can see school contact details.
- [x] **Removed per-student check-in/check-out entirely** — deleted the `POST /attendance/check-in-out` endpoint, `CheckInOutDto`, the service method, and `checkInAt`/`checkOutAt` from the student-attendance schema and summaries. **Staff** attendance check-in/out is untouched.
- [x] **OTP dev/testing conveniences** — `OTP_EXPOSE_CODE=true` returns the code in the API response (`devCode`) for easy testing without an SMS provider; reusable `npm run seed:test-admin` seeder creates an admin login scoped to a dedicated "Test School".
- [x] **No new backend needed for the rest** — parent dashboard upcoming events, pending dues, syllabus, and vaccination records reuse existing endpoints (`GET /events`, `getStudentDues`, `GET /academic/syllabus`, `medicalInfo.vaccinations`); teacher Health note reuses `POST /daycare/health`.

### v1.0.8 — Notifications completed & secured (2026-07-04)
The notifications module now covers the full lifecycle the app needs; whole flow verified live (send → list → read → read-all → delete). Everything else in this patch was mobile-only (see the Flutter README).

- [x] **`PATCH /notifications/read-all`** — marks all of the caller's unread notifications read; returns `{updated: n}`.
- [x] **`DELETE /notifications/:id`** — dismisses one notification (backs the app's swipe-to-delete).
- [x] **Security: recipient scoping** — `markAsRead`/`dismiss` now filter by `recipient` as well as school, so a user can no longer mark or delete another user's notifications.

### v1.0.9 — Teacher neumorphic redesign, per-student diary, account-switch fix (2026-07-04)
No backend changes in this patch — mobile-only changes (teacher/entry-screen neumorphic re-theme, per-student diary flow, parent account-switch cache fix) described in the Flutter README.

### v1.1.0 — Notification fixes, clear-read, parent profile-update alert (2026-07-05)
Mark-as-read fixed for all roles, bulk-clear of read notifications added, and admins editing a student now notify the parent automatically.

- [x] **Fix: mark-all-read filter** — `markAllRead` queried `{ read: false }`, which missed notifications where `read` was `null` or missing (e.g. created before the field existed); changed to `{ read: { $ne: true } }` so every non-read notification is matched.
- [x] **`DELETE /notifications/clear-read`** — new endpoint; bulk-deletes all read notifications for the caller (`deleteMany` where `read: true`, scoped by recipient + school). Returns `{ deleted: n }`.
- [x] **Parent notified on student profile update** — `StudentsService.update()` now sends a `profile_update` notification to the student's parent (if `parentUserId` is set) after the admin saves changes. Fire-and-forget so it never blocks the response.


### v1.1.1 — Parent ↔ Teacher direct messaging (2026-07-07)
The communication service now returns populated sender/recipient identity and related-student information so the Flutter chat UI can render names and student context without extra round-trips.

- [x] **Message list population** — `inbox()` and `sent()` now `.populate('sender', 'name role email').populate('recipient', 'name role email')` so every returned message carries the sender's and recipient's name, role, and email.
- [x] **Conversation population** — `conversation()` now additionally `.populate('relatedStudent', 'firstName lastName')` so chat-bubble threads can show which child the message is about.
- [x] **No new endpoints** — the existing `/communication/messages/*` endpoints are unchanged; only the query enrichment was added.


### v1.1.2 — Gallery uploads, Transport, Daycare (2026-07-08)
File upload support for gallery, teacher access to gallery, transport endpoint for parents.

- [x] **Gallery file upload** — new `POST /gallery/upload` endpoint accepting multipart files via multer (`FileInterceptor`); files saved to `STORAGE_LOCAL_PATH` (default `./uploads`) with unique names, served at `/uploads` via `app.useStaticAssets()` in `main.ts`. Returns a gallery entry with `metadata.url`, `metadata.originalName`, `metadata.mimeType`, `metadata.size`, and `metadata.type` (image/video).
- [x] **Teacher gallery access** — TEACHER role added to all gallery write endpoints (`POST`, `PATCH`, `DELETE`). Previously only SUPER_ADMIN and ADMIN.
- [x] **`GET /transport/mine`** — new endpoint returning vehicles for the caller's school, accessible by any authenticated role. Parents use this to see their child's transport info.
- [x] **Uploads directory auto-created** — `main.ts` ensures `STORAGE_LOCAL_PATH` exists on startup.



### v1.1.3 — NO Changes on this 
No  changes in this patch 

### v1.1.4 — Socket.IO real-time chat + OTP test email (2026-07-11)
- Replaced SSE message stream with Socket.IO gateway (`/chat` namespace)
- Real-time messaging between teachers and parents with typing indicators, online presence, and read receipts
- WebSocket JWT authentication reuses existing access tokens
- REST endpoints retained as fallback; gateway auto-delivers to online recipients
- OTP codes also emailed to test address for development convenience

### v1.1.5 — Token refresh fixed, invoices carry their student, Holidays & school profile (2026-07-13)
A session-killing auth bug is fixed, admin fee screens can finally show *who* owes money, and two previously-undocumented modules are written up. Every endpoint below was verified against a live server with a real `admin` token.

**Fix (critical): `POST /auth/refresh` was unusable**
- [x] The route was itself guarded by `JwtAuthGuard`, which validates the **access** token with `ignoreExpiration: false`. Refresh therefore only worked while the access token was still valid — precisely when it isn't needed. Once the 15-minute access token expired, refresh returned **401**, both clients cleared their tokens, and the user was silently signed out mid-session (it surfaced as "Could not load fees", but any screen could hit it).
- [x] `@UseGuards(JwtAuthGuard)` removed from the route. `AuthService.refresh()` now takes **only** the refresh token, verifies it against `jwt.refreshSecret` to derive the user id, and still checks the stored bcrypt hash + `isActive` before rotating. Identity no longer comes from the expired access token.
- [x] An invalid/expired/wrong-secret refresh token now returns a clean **401 "Invalid or expired refresh token"** instead of a crash. Verified: refresh with **no** `Authorization` header → 200 + new token pair; garbage token → 401; access-token-as-refresh-token → 401.
- [x] Both clients stopped sending the pointless `Authorization: Bearer <expired token>` header on the refresh call.

**Fees — invoices know who they belong to**
- [x] **`INVOICE_OWNER_POPULATE`** — `findInvoices`, `findInvoice`, `studentInvoices`, and `pendingDues` now populate `student` (`firstName lastName admissionNumber photoUrl`) and `classId` (`name section`). Previously invoices came back with `student` as a bare ObjectId, so an admin could see *that* ₹18,000 was owed but not *by whom*. It's a projection — the payload grows by four fields, not the whole document.

**Holidays module (new)**
- [x] `GET /holidays` (any signed-in role, `?upcoming=true`), `POST /holidays` and `DELETE /holidays/:id` (super-admin / admin / principal). `Holiday` = `schoolId`, `title`, `date`, optional `description`, `createdBy`. School-scoped like every other module.

**School profile self-service**
- [x] **`PATCH /schools/mine`** — an admin/principal edits their **own** school's profile (name, contact, address, academic year). Scoped to the caller's token, so one school can't edit another; declared before the `:id` route so the literal path wins.

**Notification preferences**
- [x] **`messageNotifications`** added to `UpdateNotificationPrefsDto` and the user schema (defaults to `true`) — per-user toggle for parent ↔ teacher direct-message alerts.

### v1.1.6 — Sessions last until logout; one session per device (2026-07-13)
v1.1.5 made refresh *work*; a session could still die on its own. The refresh token expired after 7 days, and a single `refreshTokenHash` per user meant the second device to log in silently killed the first. A session now ends when — and only when — the user logs out. Verified end-to-end against a live server + Mongo: two devices logged in, refreshed, rotated, and logged out independently.

**Sessions are per-device, not per-user**
- [x] **`User.refreshTokenHash` → `User.refreshSessions[]`** (`user.schema.ts`). One entry per signed-in device (`sid`, `hash`, `prevHash`, `prevValidUntil`, `createdAt`, `lastUsedAt`), capped at `MAX_SESSIONS_PER_USER` (default 5, oldest evicted). The refresh token carries its device's `sid`; the access token does not, so nothing downstream has to know about sessions.
- [x] **Logging in on a phone no longer signs you out of the web console.** Previously every login overwrote the one hash, so an admin using both was in a permanent tug-of-war.
- [x] **`POST /auth/logout` now takes an optional `refreshToken`** (`LogoutDto`) and ends only *that* device's session. Without one (or with an unreadable one) it clears every session, so a client that can't produce its token still gets a logout it can trust.

**A session that lasts until the user ends it**
- [x] **`JWT_REFRESH_EXPIRES_IN` 7d → 365d.** The token is re-issued on every refresh, so this ceiling is only reached by a device left untouched for a full year.
- [x] **Rotation grace window (`REFRESH_GRACE_SECONDS`, default 60).** After a refresh rotates the token, the token it replaced keeps working for 60s. Without this, a refresh response lost in flight — or two requests refreshing at once — would strand the device with a dead token and force a login. Reuse outside the window is still rejected.
- [x] **New env:** `MAX_SESSIONS_PER_USER`, `REFRESH_GRACE_SECONDS`. `JWT_ACCESS_EXPIRES_IN` is unchanged at 15m — the access token is still short-lived; it's the refresh token that carries the session.

**Migration note**
- [x] Existing users hold pre-session refresh tokens (no `sid`, and their `refreshTokenHash` is gone). Those are rejected with **401**, both clients clear and route to login, and everyone is signed in normally from then on. **Expect one forced re-login on deploy.**

_Known gap:_ invoices have **no** `DELETE` route. Once generated, an invoice (and its payments/receipts) can only be removed at the database level — fine for an accounting trail, awkward for a mis-generated batch.

### v1.1.7 — Admin joins the chat; PTM becomes school-initiated (2026-07-14)
Two changes to `communication`. The admin can now resolve teacher and parent queries over the existing chat, and PTM is rebuilt around a single rule: **the school calls a meeting, the parent is told.** Every endpoint below was verified against a live server with real admin, teacher and OTP-issued parent tokens.

**Admin ↔ teacher and admin ↔ parent chat**
- [x] No schema change was needed. `Message` is `sender` → `recipient` as plain `User` refs and neither the controller nor `ChatGateway` checks roles, so an admin could already send and receive — there was simply no way to *discover* them as a recipient.
- [x] **`GET /communication/messages/contacts`** — role-aware. An admin/principal gets every teacher and parent in the school; a teacher or parent gets the office (admins/principals). Teacher↔parent pickers stay roster-driven, so nobody gains a new peer to message.
- [x] **`GET /communication/messages/threads`** — conversations collapsed one row per other party (last message, unread count), built from sent **and** received. The clients previously grouped the *inbox alone*, which hides any thread you opened that hasn't been replied to yet — a bug that would have hit admins hardest, since they usually message first.
- [x] **Message notifications are now typed** — `type: 'message'` plus `{messageId, senderId, senderName}`, so a tapped notification can open the thread instead of dumping the user on the inbox.
- [x] Threads stay private: an admin cannot see a teacher↔parent conversation. Verified — a message between a teacher and a parent appears in neither the admin's threads nor their own conversation with that parent.

**PTM: the school decides, the parent is notified**
- [x] **Parents are excluded from both `POST /communication/ptm` and `PATCH /ptm/:id/respond`** (`@Roles(...PUBLISH_ROLES)`). A parent neither requests a meeting nor accepts one; they see it and are told the outcome. Enforced server-side, not just hidden in the UI — verified **403** on both.
- [x] **Accept / reject is the admin's call.** `respondPtm` now applies per-action rules: scheduling, declining and cancelling are office-only; a teacher attempting it gets a 403.
- [x] **Completion is gated on the date.** A meeting can only be marked done once it is `scheduled` **and** its booked day has arrived, by the admin *or* the teacher the meeting is with. Judged by day, not minute — a 3pm meeting can be closed off that afternoon; tomorrow's cannot be closed today.
- [x] **Fix: an admin scheduling a meeting used to overwrite its teacher.** `respondPtm` did `patch.teacher = me` for any non-parent responder, so the admin accepting replaced the real teacher with themselves. Only a responding *teacher* now claims the slot.
- [x] **PTM sent no notifications at all.** It now tells the admins when a request is raised (they must act on it) and tells the parent — and the teacher who raised it — what was decided. `type: 'ptm'`. Completion is bookkeeping and notifies nobody: the parent was at the meeting.
- [x] **`GET /communication/ptm` populates `student` and `requestedBy`** — the admin has to see *which child* and *which teacher* before they can decide; it previously returned bare ObjectIds.

**Class-wide PTM — `POST /communication/ptm/classes` (new)**
- [x] One meeting is created **per student** in the chosen classes, not one broadcast — so each parent sees their own child's meeting and it can be completed individually.
- [x] **Admin** — the decider, so meetings are created already `scheduled` (`scheduledAt` required, **400** without it) and every parent + class teacher is notified. Each class's own teacher is attached to its meetings, so it also lands in their list.
- [x] **Teacher** — raises `requested` meetings (no date; the office sets one) and **only for classes they teach** — verified **403** against a class they don't. Parents hear nothing yet: there is no meeting until the office confirms one. The admins are notified instead.
- [x] Students with no linked parent account are skipped and reported back as `{created, skipped}`, so the caller knows coverage wasn't total rather than assuming it was.

_Known gap:_ **no duplicate guard.** Calling a class PTM twice creates a second set of meetings (arguably two genuine meetings). Skipping students who already hold an open (`requested`/`scheduled`) meeting would be the natural rule if that's unwanted.

### v1.1.8 — Push notifications actually leave the server (2026-07-15)
Notifications have always been *stored*; they were never *delivered*. `PushProvider.send()` was a stub that logged a line and returned `{success: true}` — and because `sendMany` awaited that fake success, every send looked like it worked. Nothing has ever reached a device. This patch makes push real, over Firebase Cloud Messaging.

**The stub becomes a real sender**
- [x] **`PushProvider` rewritten** on `firebase-admin` v14 (modular API: `firebase-admin/app`, `firebase-admin/messaging`). Batched via `sendEachForMulticast` in chunks of 500, FCM's per-call limit.
- [x] **Addressed by user id, not device token.** A user may be signed in on several devices — a parent with a phone and a tablet gets the alert on both — and resolving that fan-out is the provider's job, not the caller's.
- [x] **Every existing trigger now pushes, with no change to any of them.** Attendance, fees, homework, events, circulars, messages and PTM all already routed through `NotificationsService`, so giving the provider a real body was enough. `sendMany` now makes **one** provider call for the whole audience instead of one per recipient.
- [x] **Sends a `notification` block, not just `data`** — this is what makes it work with the app closed. Android draws the tray notification itself without waking Dart; a data-only message would only arrive if the app happened to be alive. `title`/`body`/`type` are duplicated into `data` as well, because a tap handled from a cold start receives only `data`.

**Somewhere to send it to**
- [x] **`User.deviceTokens[]`** (`{token, platform, updatedAt}`, `select: false`). There was previously **no** device-token field anywhere in the schema, so even a working provider would have had no address.
- [x] **`POST /users/me/device-token`** — called by the app after every login and whenever FCM rotates the token. **`DELETE /users/me/device-token`** — called on logout, before the access token is cleared (the call is authenticated).
- [x] **A token is claimed, not merely added.** `addDeviceToken` first pulls it off *every other account*. A token identifies an app install, not a person — without this, a phone passed between parents, or a shared school tablet, keeps delivering the previous user's notifications to the next one.
- [x] **Dead tokens self-prune.** FCM reporting `registration-token-not-registered` or `invalid-registration-token` (app uninstalled, token replaced) deletes the token. Other failures — rate limits, transient outages — are logged and kept, since those are worth retrying. Left unpruned, stale tokens accumulate and every send burns a request on each.

**Configuration**
- [x] **`firebase.config.ts`** — service account from `FIREBASE_SERVICE_ACCOUNT` (inline JSON, for hosts with no filesystem) or `FIREBASE_SERVICE_ACCOUNT_PATH` (default `firebase-service-account.json`). Both git-ignored.
- [x] **Push is optional.** No key → the provider logs a warning, disables itself, and every send becomes a no-op. Notifications are still persisted and still appear in the in-app list. A misconfigured deploy loses push, not the app.
- [x] Never throws: a push is a side effect of the thing that triggered it, and a dead FCM connection must not fail marking attendance.

_Known gap:_ **iOS is not wired.** FCM on iOS is a wrapper over APNs, so it additionally needs a `GoogleService-Info.plist`, an APNs `.p8` key uploaded to Firebase, the Push Notifications capability, a paid Apple Developer account, and a Mac to build on. The backend already sends the `apns` payload block, so no server change is needed when that lands — it is entirely client-side setup.

### v1.1.9 — No changes done in this version
No backend changes in this version — Super Admin web-console-only changes described in the SchoolSuperAdmin README.
### v1.2.0 — Razorpay: parents pay fees online (2026-08-14)
The first of the platform's two money flows — **parent → school**. Each school collects into
**its own Razorpay account**, so fees never pass through the platform; the super admin enters
that school's keys, and the school's own admin can neither see nor change them.

The `Payment` schema already anticipated this (`status: pending|success|failed` plus
`gateway`/`gatewayOrderId`/`gatewayPaymentId`) — those fields are now wired up.

**Per-school credentials (super admin only)**
- [x] **`School.paymentGateway`** — `{provider, keyId, keySecret, webhookSecret, enabled}`.
      `keyId` is public (the app needs it to open checkout); both secrets are **AES-256-GCM
      ciphertext** via the new `common/utils/crypto.util.ts`, keyed off `ENCRYPTION_KEY`.
- [x] **Secrets can't leak** — a `toJSON`/`toObject` transform on the School schema strips them
      from every serialised response, so no controller can expose them by forgetting to.
      `GET /schools/:id`, the list, and `/schools/mine` all come back clean.
- [x] **`GET|PUT|DELETE /schools/:id/payment-gateway`** — super-admin-only (the whole controller
      already is). Reads return `hasKeySecret` / `hasWebhookSecret` booleans, never the values.
      Secrets are write-only: omit one on update to keep what's stored.
- [x] **Enabling requires a webhook secret** — without it a payment could start but never be
      confirmed, so the guard refuses rather than leaving parents charged and invoices unpaid.

**Payment flow**
- [x] **`POST /fees/invoices/:id/checkout`** — opens a Razorpay order for the outstanding balance
      and parks a `pending` Payment row against it. Re-opening checkout reuses a live order
      instead of stacking new ones.
- [x] **`POST /fees/webhook/razorpay/:schoolId`** — the authoritative confirmation. **No guards**
      (Razorpay has no JWT); the signature is the authentication. The school id is in the path
      because each school signs with its own webhook secret — a shared URL couldn't know which
      secret to verify against. Needs `rawBody: true` (now set in `main.ts`): the HMAC covers the
      exact bytes sent, so re-serialised JSON would never match.
- [x] **`POST /fees/payments/verify`** — the client's success callback, so the app shows "Paid"
      without waiting for the webhook. Verifies `HMAC(orderId|paymentId)` before settling.
- [x] **Settling is idempotent** — `settleGatewayPayment` claims the row with a
      `findOneAndUpdate({status:'pending'})`, so of the webhook, its retries, and the client
      callback exactly one credits the invoice. Backed by a unique sparse index on
      `gatewayOrderId` (sparse so the many cash payments, which have none, don't collide).
- [x] **Online payments are just payments** — same Payment + Receipt rows as cash, so they appear
      in the admin's invoice list and in `/fees/reports/collection` (as `byMethod.online`) with
      no extra work.

**Verified end to end** against a live server: credentials encrypted at rest (no plaintext in
Mongo), school admin gets 403 on both read and write, bad webhook signature rejected, valid one
settles the invoice to `paid` with exactly one payment and one receipt, and a replayed webhook
does **not** double-credit.

> **Setup:** `ENCRYPTION_KEY` must be set (32+ random chars) before any school's gateway can be
> configured — changing it later makes stored secrets unreadable and they must be re-entered.
> Real Razorpay keys are still needed to exercise a live order end to end.

### v1.2.1 — Invoices reach parents month by month, not all at once (2026-08-14)
Generating a monthly structure created all 12 invoices **live immediately**, so a parent opened
the app in August to twelve pending bills and a ₹60,000 "outstanding" total when they owed
₹5,000. The school's outstanding report was inflated the same way, by its entire unbilled year.

The whole session is still laid out at generation — the office wants to see the plan — but each
installment now reaches the parent in its own month.

- [x] **New `FeeStatus.SCHEDULED`** — a future installment. The row exists so the school can see
      the session, but nobody owes it and parents never receive it. Explicit status rather than a
      hidden date filter, so the office can see exactly what's coming.
- [x] **`Invoice.issuedAt` is now a real schedule**, not "whenever this row was written".
      Indexed, because the daily sweep queries on it.
- [x] **Billing anchors to the generation day** — generate on the 14th and every installment
      issues on the 14th of its month. The first is live immediately; the rest wait.
- [x] **Past months are never billed** — `buildInstallments` takes a `from` date and skips
      installments whose month has already gone. Generating in August produces 8 invoices, not
      12, so a child enrolled mid-session isn't invoiced back to April (which the overdue sweep
      would then have flagged as months of arrears).
- [x] **Due dates can't precede issue dates.** With a due day of the 5th and generation on the
      14th, every invoice would have arrived already overdue. The structure's due day is kept
      where it still falls after the issue date; otherwise the invoice gets 7 days' grace.
- [x] **The daily sweep releases them** — `issueScheduledInvoices` flips SCHEDULED → PENDING once
      the issue date arrives **and notifies the parent then**, which also fixes recurring
      invoices never announcing themselves (only annual ones did). It catches up on everything
      overdue for release rather than assuming it ran yesterday, so an outage self-corrects.
- [x] **Scheduled rows are excluded from what's owed** — the parent's invoice list (role-checked:
      the school side still sees the full schedule), `/fees/dues`, and the outstanding report.
      The overdue sweep skips them too, so a future month can't be marked overdue.
- [x] **`generateInvoices` reports `scheduled`** alongside created/skipped, and refuses a session
      that's entirely in the past instead of silently creating nothing.
- [x] **Invoice lists sort by due date** — chronological is how a fee ledger reads.

**Verified end to end** on 14 Aug 2026 against the 2026-2027 session: 8 installments (Apr–Jul
skipped), 24 invoices for 3 students, 21 scheduled and 3 live. Issue dates land on the 14th of
each month, due dates on the 21st (due day 5 had passed, so grace applied). The parent sees
**one** invoice owing ₹5,000; the admin sees all 8. Outstanding reads ₹15,000, not ₹120,000.
Back-dating September and running the sweep released exactly those three and left October
onward scheduled.

### v1.2.2 — `/schools/mine` reports whether online payments are on (2026-08-14)
- [x] **`onlinePaymentsEnabled` on `GET /schools/mine`** — mirrors `paymentGateway.enabled`. The
      parent app had no way to know a school takes fees at the office only, so it offered "Pay
      now" regardless and the parent discovered the truth from a failed checkout.
      Only the boolean is exposed; the keys stay super-admin-only, and the existing schema
      transform still strips the secrets from this response.

The server-side guard is unchanged and still authoritative — `POST /fees/invoices/:id/checkout`
returns 400 *"This school is not set up for online payments"* when the gateway is off. The flag
just stops the app from offering a button that can only fail.

### v1.3.0 — Platform subscriptions (school → Sproutly) (2026-08-14)
The second money flow. Two systems now move money in opposite directions, and they are named
apart deliberately — **Fees** is what a parent pays a school, **Subscription** is what a school
pays the platform. Nothing is called an "admin fee": in a product where "fee" already means
school fees, that name invites exactly the confusion worth avoiding.

| | Fees | Subscription |
|---|---|---|
| Direction | parent → school | school → platform |
| Razorpay account | each school's own, encrypted on the School record | one platform account, `PLATFORM_RAZORPAY_*` in env |
| Webhook | `/fees/webhook/razorpay/:schoolId` | `/subscriptions/webhook/razorpay` |
| Collection | `payments` / `invoices` | `subscriptioninvoices` |

- [x] **Arbitrary durations** — the super admin bills an amount and a number of days. A 15-day
      trial and a two-year contract are the same shape, which is why the `trial` school status
      is **gone**: a trial is just a short invoice.
- [x] **`subscription-policy.ts`** — the lock rules and the renewal-date maths as pure functions,
      covered by 17 unit tests. Deliberately separate from the service: this is the code that
      decides whether a paying customer is locked out.
- [x] **Renewal date** = `max(previous end, payment date − 5 days)`. Paying early loses nothing;
      grace days used are billed; days spent locked out are free.
- [x] **Two-tier lock** — admin read-only at expiry + 5 days, everyone else only at + 30, and
      non-admins are told nothing about billing. Reads never blocked.
- [x] **Renewal reminders** to admins only, from 5 days out.

**Bugs found and fixed while building this**

- [x] **`sparse` unique index on `gatewayOrderId` was wrong — including in the already-shipped
      fees module.** Sparse skips only *absent* fields, but the schema writes an explicit `null`,
      so **the second cash payment ever recorded at a school would have failed** with a duplicate
      key error. Both schemas now use `partialFilterExpression: { $type: 'string' }`; the broken
      indexes were dropped so they rebuild.
- [x] **The guard never ran.** Registered via `APP_GUARD`, which Nest runs *before* the
      controller-level `JwtAuthGuard` — so `req.user` was always undefined and every check fell
      through. It now resolves the bearer token itself.
- [x] **The lock was a trap.** `req.path` includes the global `/api` prefix, so the exemption list
      never matched and a locked admin could not reach checkout to pay — the one thing that would
      unlock them. Fixed, and pinned by tests (`isAlwaysWritable`) so it cannot silently regress.
- [x] **Webhooks failed when a gateway was switched off.** Verification went through
      `paymentCredentials`, which throws unless the gateway is enabled — so pausing online
      payments while a payment was in flight made the callback 400 and Razorpay retry forever,
      stranding money that had already moved. Webhooks now verify against the stored secret
      regardless, and answer 200 to anything unretryable.
- [x] **The guard queried Mongo on every write in the system.** Now a 60-second per-school cache,
      invalidated on payment so an unlock is felt immediately rather than up to a minute later.

> **Setup:** `PLATFORM_RAZORPAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET`. Leaving them blank
> disables online subscription payments; office payments still work. A second webhook URL is
> needed in Razorpay — see the caveat below if the same test account is used for both flows.

### v1.3.1 — Every school's billing position on one screen (2026-08-15)
- [x] **`GET /subscriptions/overview`** — one row per school: phase, expiry, days remaining and
      the outstanding invoice. Built from **three fixed queries** rather than one per school, so
      the owner's billing screen doesn't slow down as schools are added. Schools that have never
      been billed are included — they're precisely the ones worth noticing.
- [x] **A caller with no school is rejected before it reaches Mongo.** `user.schoolId` is null for
      the super admin and the controllers passed it through as `''`, which
      `new Types.ObjectId('')` turned into a 500. `/subscriptions/mine` now answers a clear 400.
- [x] **The write guard fails open on an unparseable school id.** It runs in front of every write
      in the system, so a lookup problem must never be able to *create* a restriction.

### v1.4.0 — Parent login codes go out over WhatsApp (2026-08-15)
The OTP was only ever readable from the backend terminal and a developer test email. Both are
gone; the code now reaches the parent and nowhere else.

- [x] **A second WhatsApp transport.** `WhatsappProvider` is now abstract with two
      implementations — `meta` (Cloud API direct) and `buzzflow` (reseller panel) — chosen once
      from `WHATSAPP_PROVIDER`. Nothing downstream learns which one it got.
- [x] **The BuzzFlow token lives in the URL path**, so the whole URL is a credential. It is
      redacted from every log line, and the module is server-side only.
- [x] **`WhatsappService.sendOtp`** — the code is never logged, here or below. A login secret in a
      log file outlives its five-minute validity by however long the logs are kept.
- [x] **Removed:** the developer test email and its hardcoded address list, `OTP_EXPOSE_CODE` /
      `devCode`, and the SMS service's plaintext code log. `SmsService` stays as the seam for a
      real transport but nothing sends through it.
- [x] **A delivery failure now surfaces** as a 503 *and clears the stored code*, instead of
      reporting success to a parent whose message never arrived. This narrows the
      anti-enumeration guarantee to "while the provider is healthy" — a deliberate trade, since
      the silent version strands every parent every time.

**Reading the vendor's answer properly** — BuzzFlow proxies Meta's Graph API and returns
**HTTP 200 even when the send failed**, with the real outcome in the body:
`{"status":"400","statusText":"failed","detail":{…GraphMethodException}}`. The first version read
`status: "400"` as success because it wasn't the literal word `"failed"`, so a failed send was
reported as delivered. It now checks, most explicit first: an explicit boolean, a Graph error
object, the vendor's `statusText`, then `status` as an HTTP-style code — and only a body with no
recognisable outcome gets the benefit of the doubt. The real failure payload is pinned as a test.

> **Setup:** `WHATSAPP_ENABLED=true`, `WHATSAPP_PROVIDER=buzzflow`, `BUZZFLOW_SEND_URL` (the full
> URL including the account token), optional `BUZZFLOW_TIMEOUT_MS`.
>
> **Known limit:** `send_session` sends *free-form* text, which Meta only delivers inside a
> 24-hour window opened by the recipient. A login code is unprompted, so this route needs the
> vendor's **template** endpoint and an approved authentication template before it works in
> anger — see the note in the WhatsApp module.

### v1.5.0 — Printable fee receipts, downloadable as PDF (2026-08-16)
Reproduces the school's own fee receipt: letterhead, the two-column meta grid, line items with
Due / Concession / Paid Amount / Balance, the pay-mode table, the amount in words, and the
generated-at stamp. Rendered with **pdfmake**, not a headless browser — Puppeteer would put
~300 MB of Chromium on the VPS for one feature.

- [x] **`GET /fees/invoices/:id/receipt.pdf`** — streams the file, deliberately outside the usual
      success envelope because the response body *is* the document.
- [x] **One template, both states.** An unpaid invoice prints as `FEE INVOICE` with the payments
      table reading "No payments recorded"; once settled it becomes `FEE RECEIPT` and quotes the
      receipt number. That's what makes an unpaid invoice downloadable too.
- [x] **Access is checked in the service, not the controller.** A rendered receipt carries a
      child's name, guardian, admission number and fee history — considerably more than the JSON
      row it is built from — so a parent gets only their own child's, and a scheduled invoice
      isn't downloadable before it's billed.
- [x] **`amountInWords`** — Indian grouping (lakh/crore), because "One Lakh Twenty Thousand" is
      what a receipt says and the words are the part a parent checks against the figure.
- [x] **New School fields** `trustName`, `website`, `affiliationNumber` — the letterhead, editable
      by the school itself. A blank one is *omitted* from the print, never left as an empty label.
- [x] **Concession** has no feature behind it yet and prints as `0.00`. **Paid** is tracked per
      invoice, not per line, so payments are allocated down the lines in order — the earlier
      heads settle first, as an office reads a part payment.

### v1.5.1 — Gallery images stopped 404'ing (2026-08-17)
Every gallery image had been failing to load, on web and in the app, while the files sat safely on
disk the whole time.

- [x] **The two halves disagreed about one path.** Multer wrote to `STORAGE_LOCAL_PATH`
      directly, while `main.ts` served `join(process.cwd(), STORAGE_LOCAL_PATH)`. `join` glues an
      **absolute** path onto the cwd, and production sets one — so uploads landed in
      `/Milan/aavaschool/backend/uploads` and were served from
      `/Milan/aavaschool/backend/Milan/aavaschool/backend/uploads`, a phantom tree `mkdirSync` had
      obligingly created. Both now go through one `uploadsDir()` helper that uses `resolve`, and
      the regression is pinned by tests.
- [x] **Deleting a gallery item removes its file.** Previously only the database row went, leaving
      the uploads directory to grow forever with files nothing pointed at. Best-effort and never
      throwing — the row is already gone, so failing here would report an error for a delete that
      did happen — and confined to the uploads directory.
- [x] **The gallery is sorted newest-first.** It had no sort at all, so the order was whatever
      Mongo happened to return.
