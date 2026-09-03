# sproutly

Flutter mobile app for the Sproutly pre-school management system — a single app hosting four roles: **Parent**, **Teacher**, **Admin** (a school), and **Super Admin**.

## Stack
Flutter · Dio (HTTP) · socket_io_client · flutter_secure_storage · iconsax · fl_chart · flutter_animate · google_fonts

## Roles
All four roles are wired to the real backend:
- **Super Admin** — creates & manages schools and users.
- **Admin** — dashboard, students, attendance, fees, staff, admissions, communication, events, leave management.
- **Teacher** — attendance, students, academics (homework/lesson plans/syllabus), daily preschool updates, PTM, circulars, leave.
- **Parent** — children, attendance, fees, academics, digital diary, PTM, notices, events, leave.

## Getting started
```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
```
`10.0.2.2` is the Android emulator's alias for the host machine's localhost. Point
`API_BASE_URL` at your running NestJS backend. Sign in via the **Super Admin** card
with the seeded super-admin credentials.

### Notifications

Notifications are surfaced through the in-app notification list (the bell/badge),
backed by `GET /notifications/me` and live updates over Socket.IO. There is no
device-push (FCM) integration — the app targets the web, so it carries no Firebase
dependency or `google-services.json`.

## Scripts
- `flutter run` — run on a connected device/emulator
- `flutter analyze` — static analysis
- `flutter build apk` — release build

## Changelog


### v1.0.0 — Super Admin on the real backend (2026-07-02)
Super Admin is the first role connected to the live API; the other three roles stay on local mocks.

- [x] **Network layer** — `dio` client with bearer-token attach + single-flight refresh, secure token storage, and an auth API that decodes the JWT for role/schoolId (`lib/core/network/`).
- [x] **Real Super Admin login** — email + password screen (replaces the demo OTP flow for this role only).
- [x] **Schools screen** — live data via `HttpSchoolService`; pull-to-refresh; "Add School" creates the school **and** its admin login in one step; tap a school to toggle its enabled modules.
- [x] **Users screen** — live data via `HttpUserService`; suspend / reactivate accounts.
- [x] **Models** — `School` / `AppUser` gained `fromJson` mapping to the backend documents.
- [x] **App icon** — Sproutly logo (white "A" with a coral/teal/blue role-color crossbar on a violet→coral gradient); generated for Android (legacy + adaptive) and iOS via `flutter_launcher_icons`. Regenerate the art with `py tool/generate_icon.py`, then `dart run flutter_launcher_icons`.
- [x] **Untouched:** Parent / Teacher / Admin roles remain on their local mock services.


### v1.0.1 — Invite-based admin onboarding (2026-07-02)
- [x] **Add-school collects name + email only** — the super admin no longer sets the admin's password; the backend emails the admin a set-password link to activate. The set-password step happens on the web page from that link.

### v1.0.2 — Parent OTP login + Admin wired to real backend (2026-07-02)
Admin and Parent roles now talk to the real API.

- [x] **Parent login** — two-step phone → OTP screen (`ParentLoginScreen`). Shows `devCode` hint when no SMS provider is wired.
- [x] **Credential login** — shared `CredentialLoginScreen` (email + password) used by Admin, Teacher, and Super Admin; parameterised by role.
- [x] **Admin Dashboard** — real student/staff counts from the backend via `AdminApi`; pull-to-refresh.
- [x] **Admin Students** — live paginated list; "Add Student" form POSTs to `/students` with `parentPhone` (triggers parent account auto-provisioning).
- [x] **Admin Attendance** — Student tab lists classes and today's attendance summary per class; tap a class to mark present/absent; Staff tab shows today's staff check-in status.
- [x] **Admin Staff** — real staff list from `/users`; "Add Teacher" creates a teacher account (invite email sent); Leave Requests tab.
- [x] **Admin More** — Staff Management, Admissions, Communication, Reports, Events, Transport, Leave Management, Settings — all accessible from the More grid.
- [x] **Admin nav restructured** — Home · Students · Attendance · Fees · More (matches the workflow diagram).
- [x] **`AdminApi`** — singleton covering dashboard stats, students (CRUD), classes, attendance (class summary + staff sheet), and staff (list + add teacher).
- [x] **`AuthApi.currentSession`** — decodes stored JWT for `schoolId`/`role` without a network round-trip; used by Settings to show the logged-in email.

### v1.0.3 — Teacher and Parent roles wired to real backend (2026-07-02)
Teacher and Parent roles now talk to the real API. Admin role settings logout also fixed.

- [x] **`TeacherApi`** — singleton covering `listClasses`, `getClassStudents`, `getClassSummary`, `getClassSheet`, `markAttendance` (`lib/core/network/teacher_api.dart`).
- [x] **`ParentApi`** — singleton covering `getMyChildren` (filtered by JWT parent userId), `getMonthlyAttendance`, `getAttendanceRange` (`lib/core/network/parent_api.dart`).
- [x] **Teacher Students screen** — real class picker, real student list per class; `StudentDetailScreen` shows guardian info and links to attendance marking for that class.
- [x] **Teacher Attendance screen** — class picker + real students; pre-fills today's already-marked attendance; P/A/L buttons; POSTs to `/attendance/mark`.
- [x] **Teacher Home screen** — greeting uses JWT email; "Today's class" card loads first real class from API and links to attendance marking.
- [x] **Teacher/Admin Settings logout** — calls `AuthApi.instance.logout()` (clears stored tokens) before popping.
- [x] **Parent Home screen** — real children list via `getMyChildren()`; child selector pills; greeting uses JWT email; quick stats link to real screens.
- [x] **Parent Attendance screen** — monthly calendar driven by `getMonthlyAttendance(studentId, year, month)`; colour-coded dots (green/red/amber); accepts `studentId` parameter from parent home.
- [x] **Parent Student Profile screen** — accepts real `Student` object; shows real name, class, admission number in header.
- [x] **Parent Settings** — profile row shows real parent email from JWT; logout calls `AuthApi.instance.logout()`.
- [x] **Backend** — `GET /students?parentUserId=` filter added to `QueryStudentsDto` and `StudentsService` so parents can query only their own children.

### v1.0.4 — All portals completed per workflow diagrams (2026-07-03)
Every remaining mock screen in the Parent, Teacher, and Admin portals now talks to the real API. Shared wire models live in `lib/core/network/api_models.dart` (invoices, homework, remarks, milestones, results, lesson plans, syllabus, assessments, diary, circulars, PTM, alerts, leave, events, inquiries, fee reports).

**Parent**
- [x] **Fees** — real invoices via `GET /fees/students/:id/invoices`; Pending/History tabs, outstanding total, line-item invoice sheet. Follows the child selected on Home (`ParentApi.selectedChild` notifier).
- [x] **Academics** — real teacher remarks, class homework, assessment results (score bars), and learning milestones per child.
- [x] **Home diary** — "Today's diary" is the real daycare digital diary (`GET /daycare/diary/:studentId`): meals, naps, activities, health, mood as a timeline.
- [x] **Home "Due soon"** — real homework for the child's class; 7-day attendance strip uses real attendance data.
- [x] **Notices** — Circulars tab lists real circulars (pinned first-class); PTM tab submits `POST /communication/ptm` with preferred slots + reason and lists my requests with status.
- [x] **Events** — real upcoming events; register a child via `POST /events/:id/register`.
- [x] **Leave** — apply with type + date range + reason (`POST /leave`); history list with pending/approved/rejected chips.

**Teacher**
- [x] **Academics** — class picker; homework list/create/delete, assessments list, syllabus units with completion checkboxes (upsert), lesson plans list/create — all against `/academic/*`.
- [x] **Daily Updates (Diary)** — pick class + students (defaults to whole class), then post meal (type/menu/amount), nap quality, activities, and mood observation to `/daycare/*` for each selected student; parents see it instantly in their diary.
- [x] **PTM** — assigned requests with Schedule (date+time picker) / Decline actions via `PATCH /communication/ptm/:id/respond`.
- [x] **Circulars** — read school notices and publish new ones to parents.
- [x] **Leave** — apply for own leave with type/dates/reason + request history.

**Admin**
- [x] **Fees** — real collection/outstanding totals from `/fees/reports/*`; invoice list with Outstanding/Collected/All tabs; "Record cash payment" settles an invoice and issues a receipt.
- [x] **Admissions** — real inquiry funnel (New → Contacted → Visited → Converted) from `/admissions/inquiries`; "+ New inquiry" form; stage transitions and Close from the detail sheet.
- [x] **Communication** — sends real circulars or emergency alerts (toggle); recent-circulars list.
- [x] **Events** — real list + create (title/date/venue/description) + delete.
- [x] **Leave Management** — all school leave requests with Approve/Reject; Staff screen's Leave tab shows staff-only requests with the same actions.

### v1.0.5 — Indian phone format + attendance contract fixes (2026-07-03)
Fixes surfaced by the end-to-end workflow verification (46 checks against the live backend).

- [x] **Indian mobile entry** — Parent login and the Admin add-student / new-inquiry forms use a fixed `+91` prefix with a digits-only 10-digit field; parent login validates `[6-9]XXXXXXXXX` before requesting the OTP.
- [x] **Fix: attendance marking payload** — `/attendance/mark` expects `entries`, not `records`; Teacher and Admin marking both sent the wrong key and always got a 400. Fixed in `TeacherApi.markAttendance` and the Admin mark-sheet.
- [x] **Fix: class sheet parsing** — backend rows are `{student: {_id, fullName}, status}` with `status: null` for unmarked students; `ClassAttendanceRecord.fromJson` now reads the nested shape and marking screens skip unmarked rows when pre-filling.
- [x] **Fix: monthly attendance parsing** — backend returns `{summary: {present, absent…}, days: [{date, status}]}`; `MonthlyAttendance.fromJson` now reads that shape (the parent calendar previously showed an empty month).
- [x] **Fix: emergency alert payload** — the alert DTO's text field is `message`, not `body`.

### v1.0.6 — UI/UX polish: smooth animations (2026-07-03)
Motion pass across the app so it feels like a warm, modern school platform.

- [x] **`AnimatedIndexedStack`** (`lib/core/widgets/motion.dart`) — switching bottom-nav tabs now fades the new tab in with a gentle upward settle while preserving every tab's state; used by all four role shells.
- [x] **`PressableScale`** — cards and tiles compress slightly under the finger and spring back on release; applied to `AppCard`, role cards, quick-action tiles, and the More grids.
- [x] **Bottom nav** — selected icon pops with an `easeOutBack` scale; tab taps give haptic selection feedback.
- [x] **Role hub** — gradient Sproutly "A" brand mark (matches the web console), staggered entrance for header and role cards, friendlier copy ("Who are you signing in as?").
- [x] **Home screens** — Admin stat cards and quick actions, Teacher "Today's class" card and quick actions, and Parent quick-stat cards stagger in with fade + slide; Admin/Teacher More grids animate in like the Parent one.

### v1.0.7 — Parent Complete-Profile + parent/teacher data pass (2026-07-04)
Parents now own the full student profile (fill once, then locked), the parent portal gained several real-data sections, and the teacher dashboard/profile/diary were wired to real backend data. All flows verified end-to-end.

**Parent**
- [x] **Complete-Profile flow** — new `complete_profile_screen.dart` form (address, guardians, emergency contacts, medical info) posting to `PATCH /students/:id/profile`; a "Complete profile" banner on `parent_home.dart` prompts the parent after login.
- [x] **Student profile rewired** — `parent_student_profile.dart` replaced its hardcoded mockup with real `Student` data and a bottom action bar: **Complete** CTA before completion, then a **locked** state with **"Request change"** (`POST /students/:id/change-request`, notifies admins) after.
- [x] **Complete-Profile bug fixes** — silent validation failures now each surface a toast (form previously appeared to "not submit"); removed a fragile post-pop toast; added a medical **Yes/No gate** so allergies/conditions/medications/doctor fields are disabled and ignored on submit when "No".
- [x] **Dashboard upcoming events** + real **pending dues** ("Fees due" stat via `getStudentDues`).
- [x] **Vaccination records** — captured in the complete-profile form and shown in the profile (`medicalInfo.vaccinations`).
- [x] **School contacts** — via new `GET /schools/mine`.
- [x] **Syllabus** — new Academics tab wired to the existing `GET /academic/syllabus?classId=`.
- [x] **Removed per-student check-in/check-out** — the feature was retired app-wide (model fields + UI) to match the backend; staff attendance check-in/out is unaffected.

**Teacher**
- [x] **Dashboard real data** — attendance summary donut + late-arrivals now come from `getClassSheet` (the donut was previously hardcoded 20/1/1); upcoming events now from `getEvents` (was hardcoded tiles).
- [x] **Health & Alerts** — student profile shows blood group / allergies / conditions / medications from `student.medicalInfo`.
- [x] **Diary Health note** — new section wired to `postHealth` (`POST /daycare/health`).
- [x] **Flagged (not mappings)** — gallery upload, transport, and assessment authoring need new backend/role work; deferred.

### v1.0.8 — Parent soft-UI re-theme, animated OTP, real notifications, session hardening (2026-07-04)
The parent portal got a neumorphic white + deep-green re-theme and a reel-style animated OTP screen; notifications went live for every role; and portals can no longer be left via the system back button.

**Fixes**
- [x] **Parent Student Profile blank from More tab** — the screen was only fed a student when opened from Home; it now falls back to the selected child (loading the roster if needed), so child info / medical / contacts always show.
- [x] **Parent Attendance showed 0 from the bottom navbar** — same missing-student cause; the tab now uses the selected child and reloads when the selection lands.
- [x] **Crash opening Notifications** (`ServicesScope.of()` assert) — routes pushed with `Navigator.push` build above the shell's `InheritedWidget`; `ServicesScope` now keeps a static `current` fallback set by `HomeShell`.
- [x] **Content hidden behind the floating bottom nav** on parent tabs (`extendBody` removed) and a double white surface behind the home attendance card.

**Session & navigation**
- [x] **Back button can't exit a portal** — `PopScope(canPop: false)` on the shell for all four roles; the only way out is Logout. Super Admin settings gained its missing Logout tile.
- [x] **Logout confirmation on every role** — shared `confirmLogout` dialog replaces the four duplicated logout handlers.

**Parent soft-UI (neumorphic) re-theme — white + deep green `#013E37`**
- [x] **Token-level re-theme** — `parentPrimary` → deep green, near-white `parentBg`, green-wash `parentTint`; new `AppNeu` tokens (raised white surface + dual light/shade shadow) toggled only while the parent portal is open, so other roles are pixel-identical.
- [x] **Shared widgets render it** — `AppCard` and `AppBottomNav` go neumorphic under the flag; active nav tab is a solid green pill with white icon; nav items press-shrink; tab switches fade + rise + scale-settle.
- [x] **Animated OTP verification** — six digit cells driven by one hidden field (paste keeps working): digits pop in with a spring, the active cell pulses, a wrong code shakes the row red and auto-clears, a correct one sweeps the cells green into a springy checkmark; auto-verifies on the last keystroke.

**Notifications (all roles)**
- [x] **Real backend bell** — new `HttpNotificationService` replaces the deleted in-memory mock for every role: `GET /notifications/me` mapped to the bell UI (type → icon/tint, Today/Yesterday/Earlier buckets, relative times), tap-to-read, "Mark all read", swipe-to-dismiss, pull-to-refresh, and fetch-failure handling.

### v1.0.9 — Teacher neumorphic redesign, per-student diary, account-switch fix (2026-07-04)
The teacher portal (and the shared entry screens) got a full neumorphic re-theme with 3D press effects and a new app-wide page transition; the diary became per-student; and a parent account-switch bug was fixed.

**Fixes**
- [x] **Parent account-switch bug (major)** — `ParentApi` is an app-lifetime singleton, and its children cache + `selectedChild` survived logout, so a second parent logging in on the same device saw the previous account's child (e.g. Aakash instead of John). The cache is now tagged with the owning `userId` and refetched on mismatch, the selection is re-validated after every fetch, and `ParentApi.reset()` clears everything on logout.
- [x] **Teacher diary is per-student** — the Diary tile left the More grid; the student detail page (Students → tap a student) gained a **"Daily update"** button opening `TeacherDiaryScreen` for that one child (`Daily Update · <name>`), so teachers post meals/naps/activities/mood/health per student.
- [x] **Parent home shows only the last diary update** — a teacher "send" posts its sections within seconds, so the "Today's diary" card groups entries within a 2-minute window of the newest timestamp and hides earlier updates from the same day.

**Teacher neumorphic re-theme (soft sage `#E6EEEA`)**
- [x] **New soft-UI kit** — `lib/core/widgets/neu.dart`: `Neu` tokens (bg, convex/concave gradients, dual light/shade shadows), `NeuCard` (presses into the page), `NeuChip` (sinks when selected), `NeuButton`/`NeuGhostButton` (convex accent pill; optional `color` for destructive red), `NeuIconWell`, `NeuInset`, `NeuProgressBar`, `NeuMarkPill` (P/A/L), `NeuBottomNav` (active tab in a carved well), and `NeuTilt` (3D press-tilt toward the finger).
- [x] **Every teacher screen restyled** — Home (tilting class hero card, carved attendance-donut dial, event tiles), Attendance marking, Students + student detail, Academics (all four tabs), and the whole More stack (Gallery, Circulars, Leave, PTM, Reports, Settings). Logic and API calls untouched.
- [x] **Home quick actions redesigned** — the cramped, clipped card row became four floating circular neu buttons (Attendance / Homework / Photos / Diary) that all fit on screen and sink in on touch.

**Shared surfaces on the same design**
- [x] **Logout confirmation** — neumorphic dialog (inset red logout well, press-in Cancel / danger Log out) with a springy pop-in; still resets per-account state.
- [x] **Role hub + logins** — the role-select landing page (tilting role cards, inset icon wells), the credential login (carved-in input wells, role-colored `NeuButton`), and the parent OTP login (inset phone field + OTP wells; kept the shake/green-wave animations) all re-skinned; content cascades in after the route lands.
- [x] **Parent portal touches** — parent bottom nav switched to `NeuBottomNav` (deep-green accent) and the parent Home page fully restyled (quick stats with tilt, neu child-selector pills, diary/homework/events/week-strip cards).
- [x] **Smooth page transitions** — new app-wide `SoftPageTransitionsBuilder` (fade-through: incoming page rises + settles while the page beneath recedes; `RepaintBoundary` caches the page raster) replaces the mismatched horizontal-exit/vertical-entry pair that read as jank; `neuRoute()` uses the same motion.

### v1.1.0 — Notification fixes, clear-read, parent profile-update alert (2026-07-05)
Mark-as-read fixed for all roles, a "Clear" button removes read notifications, and parents are notified when an admin edits their child's profile.

- [x] **Fix: mark-as-read optimistic UI** — `_markRead` and `_markAll` now immediately toggle the local notification state via `setState` (dot + tint disappear instantly) before the API call; on failure, the state rolls back and an error toast is shown. Previously the UI waited for two network round trips with no feedback.
- [x] **"Clear" button** — new red `TextButton` in the notifications AppBar (enabled when any read notifications exist); taps `DELETE /notifications/clear-read` to bulk-remove all read notifications. Uses the same optimistic pattern with rollback.
- [x] **`NotificationService.dismissRead()`** — added to the abstract interface and `HttpNotificationService`.


### v1.1.1 — Parent ↔ Teacher direct messaging (2026-07-07)
Parents and teachers can now chat directly through the app. Messages are sent/received via the existing `/communication/messages` API.

**Parent side**
- [x] **Messages tab** — the Communication screen's Messages tab is now a real inbox with grouped conversation threads (one row per other party), unread badges, relative timestamps, and pull-to-refresh. The old hardcoded `_ChatView` mock was removed.
- [x] **Chat thread** — new `_ChatThreadScreen` with chat bubble UI (sent/received), send bar, auto-scroll, and automatic mark-read on open.
- [x] **New message** — the "New" FAB looks up the selected child's class teacher via `ParentApi.getClass()` and opens a chat thread directly.
- [x] **`ParentApi` messaging methods** — `sendMessage()`, `inboxMessages()`, `sentMessages()`, `conversation()`, `markMessageRead()`, `unreadMessageCount()`, `getClass()`, `_parseMessageList()`.

**Teacher side**
- [x] **Messages tile** — new "Messages" tile in the Teacher More grid opens `TeacherMessagesScreen`.
- [x] **Teacher inbox** — `teacher_messages.dart` (new file): `TeacherMessagesScreen` shows grouped conversation threads with unread badges and pull-to-refresh.
- [x] **Teacher chat thread** — `TeacherChatThreadScreen` with bubble UI, send bar, related-student context ("Re: Student Name"), and auto mark-read.
- [x] **New message picker** — the "New" FAB walks all of the teacher's class rosters, dedupes parents by `parentUserId`, and shows a picker sheet to start a conversation.
- [x] **`TeacherApi` messaging methods** — `sendMessage()`, `inboxMessages()`, `sentMessages()`, `conversation()`, `markMessageRead()`, `unreadMessageCount()`, `getUser()`, `_parseMessageList()`.

**Shared**
- [x] **`MessageModel`** — new model in `api_models.dart` with `fromJson()` that handles both bare ObjectId refs AND populated sender/recipient/relatedStudent objects from the backend.

**Backend**
- [x] **Populate enrichment** — the backend's `communication.service.ts` now `.populate()`s sender, recipient, and related-student fields so the Flutter UI can render names without extra round-trips. No new endpoints were needed.


### v1.1.2 — Gallery, Transport & Daycare (2026-07-08)
Several parent mock screens wired to real APIs; teacher and admin gallery upload added; events simplified.

**Parent**
- [x] **Gallery** — `_GalleryScreen` now fetches real photos from `GET /gallery`, shows thumbnails in a 3-col grid with loading/empty/error states, pull-to-refresh, and a full-screen `_GalleryDetailScreen` with `InteractiveViewer` for pinch-to-zoom.
- [x] **Transport** — `_TransportScreen` now fetches real vehicle/route/driver info via `GET /transport/mine`; shows route name, vehicle number, driver name, and call button. Map placeholder with "Track on map" action. Pull-to-refresh.
- [x] **Daycare** — `_DaycareScreen` now a full daycare timeline: fetches real diary via `ParentApi.getDiary()`, date picker to view past days, summary card (5 stats: meals/naps/play/health/mood), color-coded timeline with kind-specific icons and times.
- [x] **Events simplified** — removed the Register button and registration state from the parent events screen; events are now read-only.

**Teacher & Admin**
- [x] **Gallery upload** — `TeacherGalleryUploadScreen` and new `AdminGalleryScreen` both support real photo upload: pick from device via `image_picker`, add optional caption, upload via `POST /gallery/upload` with loading state and error handling. Gallery grid shows real items with full-screen detail viewer.
- [x] **`AdminApi` gallery methods** — `uploadGallery()` (multipart file upload) and `listGallery()` added.

**Backend**
- [x] **Gallery file upload** — new `POST /gallery/upload` endpoint accepting multipart files via multer; files saved to `STORAGE_LOCAL_PATH` and served at `/uploads` via `app.useStaticAssets()`. TEACHER role added to all gallery write endpoints.
- [x] **Transport** — new `GET /transport/mine` endpoint returning vehicles for the caller's school (any role).

**Models**
- [x] **`GalleryItem`** — new model: `id`, `title`, `notes`, `metadata` with convenience getters `url`, `thumbnailUrl`, `mediaType`.
- [x] **`TransportInfo`** — new model: `id`, `title`, `notes`, `metadata` with convenience getters `routeName`, `vehicleNumber`, `driverName`, `driverPhone`.


### v1.1.3 — Transport schema hardened; detail cards match backend (2026-07-08)
The Vehicle schema now has proper fields for transport details so the teacher and parent detail cards always show what the backend guarantees.

### v1.1.4 — Socket.IO real-time chat + OTP test email (2026-07-11)
- Replaced SSE-based `MessageStream` with Socket.IO (`socket_io_client`) for real-time chat
- New `SocketService` singleton manages authenticated WebSocket connection to `/chat`
- Teacher and Parent chat threads now use Socket.IO: instant delivery, typing indicators, online presence, read receipts (✓✓), optimistic send
- Socket disconnects cleanly on logout; auto-reconnects on network loss
- Chat history still loaded via REST; real-time events append live

**Backend**
- [x] **Vehicle schema** — added dedicated fields `vehicleNumber`, `driverName`, `driverPhone`, `routeName` (optional strings) so transport details are first-class fields, not keys stuffed in the generic `metadata` map.
- [x] **CreateVehicleDto** — accepts the four new fields with `@IsOptional() @IsString()` validation.

**Flutter**
- [x] **`TransportInfo` model** — replaced the old `metadata`-based computed getters with real `String?` properties (`vehicleNumber`, `driverName`, `driverPhone`, `routeName`); `_read()` helper checks the dedicated field first then falls back to `metadata[key]` for backward compatibility with existing records.
- [x] **`AdminApi.createTransport()`** — now sends all four detail fields alongside `title` and `notes`.
- [x] **Teacher transport card** — displays title, route, vehicle number, driver name + phone call button, notes, and student/staff count badges — all from guaranteed schema fields.
- [x] **Parent transport card** — displays title, route, vehicle number, driver name + phone call button, and notes — all from guaranteed schema fields.

### v1.1.5 — Admin Fees rebuilt, Admin gets the soft-UI look, session-expiry fix (2026-07-13)
The Admin Fees screen is now a real 4-tab workflow wired to the live API, the Admin role adopts the Parent app's neumorphic design system, and the bug that silently signed users out mid-session is fixed (server-side — see the backend README).

**Admin Fees (new screen: `features/admin/screens/admin_fees.dart`)**
- [x] **Four tabs — Overview · Invoices · Structures · Generate** — replaces the old fees screen that lived inside `admin_students.dart` (that duplicate `AdminFeesScreen` and its private tabs/sheets were deleted; the two classes were colliding at the import in `home_shell.dart`).
- [x] **Wired to the real endpoints** — the screen had been written against `AdminApi` methods that never existed (`listFeeStructures`, `createFeeStructure`, `updateFeeStructure`, `deleteFeeStructure`). Re-pointed at the real surface: `listStructures()`, `saveStructure(id: …)` (null id = create), `deleteStructure()`, `generateInvoices()`, `recordPayment()`.
- [x] **See who has paid and who hasn't** — invoice cards now lead with the **child's name** (class · period · due date underneath) instead of an opaque invoice number. A search box filters by child name, admission number, class, or invoice number, and composes with the status chips — so *Pending + a class* answers "whose parents haven't paid in Nursery A".
- [x] **`InvoiceModel`** — parses `studentId` / `studentName` / `admissionNumber` / `className` from the newly-populated backend payload, tolerating both the populated-object and bare-id shapes so the parent app's calls are unaffected. New `isOverdue` getter derives from due date + balance rather than trusting the stored `status` (nothing currently flips invoices to `overdue`, so the stored value goes stale).
- [x] **`FeeStructureModel`** — added `frequencyLabel` (monthly → "Monthly") and `className` (from a populated `classId`).
- [x] **Fix: invoice generation was missing a required field** — the Generate form never collected `dueDate`, which the backend requires (`@IsDateString()`), so every generate call would have been rejected. Added a due-date picker that defaults intelligently: for a `YYYY-MM` period it uses the structure's `dueDayOfMonth` in that month, otherwise two weeks out. The result toast now reports both `created` and `skipped` (the backend returns a record, not an int).
- [x] **Fix: academic year** — the form sent `null` when blank, but the backend requires `^\d{4}-\d{4}$`. Now validated, and new structures default to the current April–March academic year.
- [x] **Fix: toasts after `await`** — four `AppToast` calls used a `BuildContext` across an async gap without a `mounted` check; in the structure form the toast fired *after* `Navigator.pop`, i.e. on a dead context.

**Admin adopts the Parent app's design system**
- [x] **Shared cards go neumorphic** — `AppCard` (and `StatCard`/`ActionCard` through it) now render a raised `Neu.convex` surface with paired light/shadow when `AppNeu.on`, instead of a flat white card. Because those three widgets are used almost exclusively by Admin, this converts every admin screen at once rather than rewriting ~10k lines. A caller-supplied `background` still wins (it usually carries a status tint).
- [x] **`AppNeu.on` now covers Admin** as well as Parent (`home_shell.dart`). It's session-global, so admin's pushed sub-screens inherit it too — hence all six admin files moved from `AppColors.softWhite` to the sage `Neu.bg`, or their now-raised cards would have floated on the wrong background.
- [x] **Shell** — `AppBottomNav` → `NeuBottomNav`, carrying `adminPrimary`: sage surfaces like Parent, but Admin stays blue so the role is still identifiable at a glance.
- [x] **Components** — quick-action tiles are raised circles that sink on press (matching parent/teacher); notification button → `NeuIconWell`; both search bars (students, fees) → carved `NeuInset`; fee filter chips → `NeuChip`; all 10 `MaterialPageRoute`s → `neuRoute` so pages slide in the way Parent's do.
- [x] **Deliberately unchanged:** `PrimaryButton` stays flat — the *Parent* app itself uses it alongside Neu surfaces, so converting it would have made Admin diverge from Parent, not match it.
- [x] **Fix: FABs sat behind the floating nav** — the admin shell uses `extendBody: true`, so the nav bar is drawn *over* the body and any inner `Scaffold`'s FAB anchors underneath it. "Add Student" and "New Structure" are now lifted clear (104px), and the Overview/Invoices/Generate lists got bottom padding so their last card is no longer unreachable under the nav.

**Auth**
- [x] **`DioClient`** — stopped sending `Authorization: Bearer <expired token>` on `/auth/refresh`; the refresh token is now the only credential the endpoint needs.

### v1.1.6 — Stay logged in until logout, GIF splash, admin dashboard spacing (2026-07-13)
The app used to force a fresh login on **every launch**, valid token or not — `main()` went straight to the role hub and nothing ever read the persisted session. It now resumes straight into the signed-in user's portal, and the launch animation from the design is in.

**Session survives app restarts (`main.dart`, `core/network/auth_api.dart`)**
- [x] **`AuthApi.restoreSession()`** — called once at startup after `TokenStorage.load()`. Reads the role from the stored access token and reopens that role's portal directly; the hub is only shown when there is genuinely no session. Backed by the per-device sessions added in backend v1.1.6, so a session now lasts until Logout.
- [x] **Startup never waits on the network.** The role comes from the stored token and a lapsed access token is renewed *in the background* — an early version awaited the refresh before `runApp()`, which hung the app on the splash whenever the API was slow or unreachable. The refresh `Dio` also had **no `connectTimeout`**, so that wait was unbounded; it now carries the same 10s/15s timeouts as the main client.
- [x] **Being offline is no longer a logout.** `DioClient` now separates *"the backend rejected the refresh token"* (`SessionExpiredException` → tokens cleared, `onSessionExpired` → back to the hub with a message) from *"the server was unreachable"* (tokens kept; the interceptor retries once the connection is back). It previously wiped the tokens on **any** refresh failure, so opening the app without a connection signed you out.
- [x] **Logout names its device** — `AuthApi.logout()` sends its `refreshToken`, so the backend ends only this device's session and the user's other devices stay signed in.
- [x] **`RoleHubScreen(resumedRole:)`** — a resumed portal is pushed over the hub on the first frame with no transition, so the hub stays underneath and Logout (which pops to the first route) still lands there.

**Splash animation (`features/shared/splash_screen.dart`)**
- [x] **`assets/images/splash_animation.gif`** is now the app's launch animation, replacing the hand-built logo/progress-bar `SplashScreen` that was dead code (defined, never referenced).
- [x] **Plays once, then gets out of the way.** The GIF animates for 3.12s, holds its last frame ~1.2s, then loops; the overlay fades out at 3.25s — inside the hold — so the loop is never seen.
- [x] **It's an overlay, not a route** (`MaterialApp.builder`). The first screen loads *behind* the animation and is ready the moment it fades, and the navigation stack stays clean — a splash route would have broken Logout's pop-to-first-route.

**Admin dashboard spacing (`features/admin/screens/admin_home.dart`)**
- [x] **Fix: a dead band between the stat cards and the quick actions.** The `GridView` holding the four cards had no `padding`, and a nested scroll view silently inherits the device's `MediaQuery` insets — so it padded itself with the phone's ~110px bottom navigation inset. `padding: EdgeInsets.zero` removes it. (Confirmed by tinting the sliver and rebuilding: the grid's box really did extend that far below the last card.)
- [x] **Cards sized to their content** — `childAspectRatio` 1.25 → 1.45; tiles were ~136px tall for ~105px of content, leaving dead space inside every card.

### v1.1.7 — Admin chat, notifications that go somewhere, holidays on the calendar, PTM rebuilt (2026-07-14)
The admin can now answer teacher and parent queries in the app, tapping a notification finally opens the thing it's about, and PTM is rebuilt around the school deciding. Backed by backend v1.1.7.

**Admin joins the chat (`features/admin/screens/admin_messages.dart`, new)**
- [x] **Communication → Messages** (Admin → More → Communication) is a second tab beside the existing Broadcast composer. Thread list with unread badges, live chat over the existing `SocketService` (typing indicators, presence, read receipts), and a **role tag on every thread** so a query from a teacher reads differently from a parent's.
- [x] **"New" picks from the whole school** — teachers and parents, grouped, from `GET /messages/contacts`. Teachers and parents in turn get a **"School office"** entry in their own new-message pickers, which is what makes the admin reachable at all.
- [x] **Thread lists now come from `/messages/threads`** (all three roles). They were grouped from the *inbox alone*, so a thread you opened and got no reply to was invisible until someone answered — which would have hit admins constantly, since they message first.
- [x] Every conversation stays a private 1:1. Admin↔teacher, admin↔parent and teacher↔parent are separate threads; the admin cannot see the last of those.

**Tapping a notification opens what it's about (`routing/notification_router.dart`, new)**
- [x] **Fix: notifications went nowhere.** `_onTap` handled exactly one type (`profile_change_request`); the backend emits **nine** (`message`, `circular`, `event`, `fee`, `attendance`, `homework`, `ptm`, `profile_change_request`, `profile_update`), so everything else marked itself read and sat there.
- [x] The type → destination map is **role-dependent** (a `fee` notification means the parent's Fees tab but the admin's fee dashboard), so it lives in one router. Two shapes: **push a screen** when the notification points at one thing (a chat thread, a circular, a student profile), or **jump a tab** when the target *is* a shell tab.
- [x] **`HomeShell.selectTab(index)`** — the notifications screen is pushed *above* the shell and can't reach its state, so it switches the tab and pops back to it. Unknown types still just mark-as-read rather than navigating somewhere arbitrary.
- [x] `ParentChatThreadScreen`, `ParentCommunicationScreen` (now takes an `initialTab`, so a circular lands on Circulars) and `ParentEventsScreen` were made public — they were file-private, so nothing could route to them.

**Holidays on the parent attendance calendar (`features/parent/screens/parent_attendance.dart`)**
- [x] A day the admin marked as a holiday now shows a **blue dot** (`AppColors.info`), and tapping it names the holiday instead of the old generic "Not marked" — a blank day now reads as *school was closed*, not *attendance wasn't taken*.
- [x] **An attendance record still wins over the holiday dot.** The file already had this rule for weekends (schools do hold Saturday classes); a child marked present on a holiday keeps their status, and the sheet names the holiday underneath.
- [x] Best-effort: `ParentApi.listHolidays()` returns an empty list on failure, so the calendar never breaks over it.

**PTM: the school decides, the parent is told**
- [x] **Parent (`parent_more.dart`)** — the "Request a meeting" composer is **gone**, and so are Accept/Decline. The PTM tab is a read-only list; a pending meeting reads *"Awaiting confirmation from the school"*. `ParentApi.requestPtm`/`respondPtm` were deleted outright.
- [x] **Admin (`features/admin/screens/admin_ptm.dart`, new)** — a **PTM button in the More tab**. Pending requests sort to the top under "Awaiting your decision", each showing which child and which teacher raised it. **Schedule** asks for date *and* time (that date is what every parent is told, so accepting blind isn't possible), plus **Decline** and **Mark completed**.
- [x] **"New meeting"** — the admin calls a PTM for whole classes at once (chips, multi-select): one meeting per student, created already scheduled, parents notified. The toast reports coverage — *"Scheduled for 12; 3 skipped (no parent account linked)"*.
- [x] **Teacher (`teacher_more.dart`)** — the request sheet gains a **One student / Whole class** toggle (own classes only). Schedule/Decline are gone (the office decides); once a meeting is scheduled the teacher gets **Mark done**.
- [x] **Completion is gated on the date** — `PtmModel.canBeCompleted` (scheduled, and the booked day has arrived) drives both apps, and the backend enforces the same rule. Until then the card says *"Can be marked completed on the meeting date"* rather than just omitting the button.

**Fix: `setState(() => _future = …)` crashed on every refresh**
- [x] The arrow closure **returns** the value it assigns — a `Future` — and `setState` asserts when its callback returns one. It blew up the admin PTM screen after the network call was already in flight (caught on the emulator).
- [x] Fixed at **all 7 sites**, including six pre-existing ones that would have thrown the same way whenever their reload or Retry button ran: `admin_classes.dart` (×2), `admin_students.dart` (×2), `parent_more.dart` (×2), `student_attendance_report_screen.dart`, `teacher_more.dart`. There are now zero left in `lib`.


### v1.1.8 — Push notifications: alerts arrive with the app closed (2026-07-15)
The app had no push capability at all — no `firebase_core`, no `firebase_messaging`, no `google-services.json`, and not even `POST_NOTIFICATIONS` in the manifest. What looked like push was an **in-app list**: a bell icon polling `GET /notifications/me`, which a parent only ever saw by opening the app and going to look for it. Notifications now reach the device whether the app is open, backgrounded, or killed.

**`PushService` (`lib/core/services/push_service.dart`, new)**
- [x] **All three app states covered.** *Foreground* — Android suppresses FCM's own notification while the app is open, so the app draws it via `flutter_local_notifications`; without this a message arriving mid-use is invisible. *Backgrounded / killed* — Android draws the tray notification itself from the `notification` block, so delivery doesn't depend on the app being alive.
- [x] **Taps route through the existing `notification_router.dart`.** A tapped push lands on the same screen the in-app list would take you to, per role — a fee alert opens the parent's Fees tab, a message opens the actual chat thread. `RemoteMessage.data` is mapped back into an `AppNotification`, so there are not two routing tables to keep in step.
- [x] **A cold-start tap waits for the navigator.** `getInitialMessage()` hands over the tap *before* `runApp` has mounted anything, so the context is briefly null. `_routeWhenReady` polls (bounded at ~3s) rather than dropping it — that gap is the difference between a notification opening the right screen and doing nothing at all, and it's exactly the app-was-closed case that matters most.
- [x] **Token lifecycle.** Registered after every login (in `_persistAndDecode`, so it covers both password and parent-OTP logins), re-registered when FCM rotates it, and **unregistered on logout before the token is cleared** — that call is authenticated, so the order matters. Otherwise the next person to use a shared phone keeps receiving the previous user's alerts.
- [x] **Never fatal.** A device with no Play Services, or a misconfigured Firebase project, gets a working app without push rather than a crash on launch.

**Android native**
- [x] **`google-services.json`** at `android/app/` (it must be there, not the project root), the `com.google.gms.google-services` Gradle plugin, and `firebase_options.dart` mirroring it for Dart.
- [x] **`POST_NOTIFICATIONS`** — mandatory on Android 13+ (API 33). Without the runtime grant, FCM delivers and the system displays nothing.
- [x] **A notification channel and a status-bar icon** (`ic_stat_notification`, a white silhouette — Android masks the icon flat, and a full-colour one renders as a grey blob).
- [x] **`minSdk` → 23** (Firebase Messaging's floor) and **core library desugaring** enabled (`flutter_local_notifications` requires it).

> **The channel id `avaa_high_importance` is duplicated in three places** — `AndroidManifest.xml`, `PushService`, and the backend's send — and they must stay in sync. When the app is killed it is *Android*, not Dart, that builds the notification, and it looks the channel up by that id. A mismatch means backgrounded alerts arrive silently while foreground ones work perfectly, which is a miserable bug to chase.

_Known gap:_ **iOS.** FCM on iOS is a wrapper over APNs, so it needs `GoogleService-Info.plist`, an APNs `.p8` key, the Push capability, a paid Apple Developer account, and a Mac to build on. All the Dart above is shared and unchanged when that lands; only native config is missing. `firebase_options.dart` throws a clear `UnsupportedError` on iOS meanwhile.

### v1.1.9 — Parent chat goes truly real-time (2026-07-17)
v1.1.4 said "Teacher and Parent chat threads now use Socket.IO" — the teacher's did; the parent's never actually moved. `ParentChatThreadScreen` still opened the SSE-based `MessageStream` against `GET /communication/messages/stream`, **an endpoint that does not exist on the backend**. The stream 404'd, silently retried every 3 s forever, and no message ever arrived live — parents had to pull-to-refresh while admin↔teacher chat was instant.

**Parent thread screen rewritten on `SocketService`** (`features/parent/screens/parent_more.dart`, mirrors `TeacherChatThreadScreen`)
- [x] **Live delivery** — incoming `newMessage` events append to the open thread instantly; messages for a *different* thread show the existing "New message from …" toast.
- [x] **Typing indicators both ways** — the send bar emits `typing` (debounced, 2 s), and the app bar shows *typing…* / *online* via Socket.IO presence, falling back to the "Re: child" hint.
- [x] **Read receipts** — incoming messages are marked read over the socket (`markRead`), so the other side's ✓✓ appears immediately; the parent's own bubbles now show ✓✓ too.
- [x] **Optimistic send** — sending moved off REST (`ParentApi.sendMessage` + full conversation refetch) onto the socket: a pending bubble appears at once, is replaced by the server-confirmed message on `messageSent`, and is dropped after 10 s if never confirmed.
- [x] **The Messages tab updates live** — an incoming message bumps its thread without pull-to-refresh (same as the admin list), and the tab reclaims the socket callback when a thread screen closes above it.
- [x] **`core/network/message_stream.dart` deleted** — dead code pointing at the nonexistent endpoint; nothing else referenced it.

No backend changes — the `/chat` gateway routes purely by `recipientId` and already served parents; only this client never connected to it.

### v1.2.0 — Attendance calendars everywhere, teacher reports, unread bell badge, dead-code purge (2026-07-17)
The parent app's attendance calendar became the app-wide way to read attendance, the admin can finally *see* teacher attendance instead of only marking it, every role's bell shows its unread count, and ~1,200 lines of dead code left the tree.

**Attendance reports look like the parent's (`features/shared/student_attendance_report_screen.dart`, rewritten)**
- [x] **The shared per-student report screen** (Admin → Attendance → class → student; Teacher → Students → student) dropped its This week/This month tabs and day-by-day list for the parent layout: Present/Absent/Late summary tiles, a month calendar with status dots (green present, red absent, orange late/half-day, blue holiday/on-leave), prev/next month arrows (capped at the current month), the tap-a-day detail sheet, and the animated monthly-percentage ring.
- [x] **Holiday overlay** — new optional `fetchHolidays` parameter; the admin passes `AdminApi.listHolidays()` so admin-marked holidays show as blue dots. (The teacher API has no holidays endpoint, so teacher reports show no holiday dots.)
- [x] **Admin home card goes somewhere** — the "Attendance marked for today" / "N students not yet marked" cards now switch to the Attendance tab (`HomeShell.selectTab`) instead of showing a toast.

**Admin sees teacher attendance (`features/admin/screens/admin_attendance.dart`)**
- [x] **Tap a teacher row** in Attendance → Teachers to open their monthly report — the same parent-style calendar, fed by the previously-unused `GET /attendance/staff/:id/report`. The staff report shares the student report's shape, so it is mapped onto the same screen; the P/A marking buttons still work independently on each row.
- [x] **Reports says whose attendance it is** (Admin → More → Reports) — "Today's Attendance" was student data with no label; it's now "Today's Student Attendance" plus a new "Today's Teacher Attendance" card (present/absent/unmarked + marked progress) computed from the roster and today's staff records.

**Unread badge on the bell (all four roles)**
- [x] **`NotificationBadge`** (`core/services/notification_badge.dart`, new) — app-wide unread count as a `ValueNotifier`, counted from `GET /notifications/me` (no new backend endpoint).
- [x] **`NotificationBell` / `UnreadBadge`** (`features/shared/notification_bell.dart`, new) — red count badge (9+ cap) on the home-screen bell; replaces the three copy-pasted bell blocks on parent/teacher/admin homes and wraps the super admin's glass icon. Hidden at zero.
- [x] **Stays fresh** — re-counts on mount, whenever the notifications screen marks read/dismisses (service change stream), on returning from the list, when a foreground push arrives (`PushService` hook), and on app resume. Failures keep the last count instead of flickering the badge away.

**Dead-code purge (~1,200 lines)**
- [x] **The mock service layer is gone.** 15 never-read `Local*` services and the 9 model files only they used were deleted; `AppServices` shrank from 18 fields to the 3 real ones (`notifications`, `schools`, `users`) and `home_shell.dart` lost the dead wiring. Screens were already talking to `AdminApi`/`ParentApi`/`TeacherApi` directly.
- [x] **Unimported files removed** — `core/widgets/shell_scaffold.dart`, `features/shared/onboarding_screen.dart`, and the repo-root strays (`_to_delete/`, an accidental root `node_modules`, a duplicate splash GIF).

### v1.2.1 — Parents pay fees online (Razorpay) (2026-08-14)
The parent Fees screen listed invoices and said online payments were "coming soon". They now
work. Paying at the school office is unchanged and stays the fallback for every school.

- [x] **"Pay ₹x" on an unpaid invoice** — opens Razorpay checkout for the outstanding balance.
      The receipt shows up on this screen either way, online or at the office.
- [x] **`lib/features/parent/screens/fee_checkout.dart`** — drives one invoice through checkout
      and resolves to paid / cancelled / failed. Razorpay reports a dismissed sheet as an error,
      so that's mapped to *cancelled* rather than showing the parent a failure.
- [x] **The school's key id comes with the order** — every school collects into its **own**
      Razorpay account, so nothing about the gateway is compiled into the app. A school that
      hasn't set one up gets a plain "pay at the office" message.
- [x] **`ParentApi.startCheckout` / `verifyPayment`** — opens the order, then posts the signature
      back so the invoice flips to Paid immediately. The backend's webhook confirms it too;
      settling is idempotent, so both firing is safe.
- [x] **A failed verify call still counts as paid** — the money has left the parent's account and
      the webhook will settle it server-side, so the app doesn't claim it failed.
- [x] **ProGuard rules for Razorpay** (`android/app/proguard-rules.pro`, wired into the release
      build). Inert today — minification is off — but R8 strips Razorpay's reflective and
      `@JavascriptInterface` classes the moment it's enabled, and the checkout sheet then opens
      blank. Cheaper to have them in place than to debug later.

> `minSdk` is already 23, above the plugin's floor. Live testing needs real Razorpay test keys
> entered against the school in the super-admin console.

### v1.2.2 — Super admin can enter a school's Razorpay keys; Modules removed (2026-08-14)
The payment gateway was only settable from the web console, so a super admin on their phone
couldn't onboard a school's payments. The mobile portal now has the same screen.

- [x] **Payment gateway on the school detail page** — status card (Live / Set up · paused / Not
      set up) opening a sheet with Key ID, both secrets, the school's own webhook URL (tap to
      copy) and an enable switch.
- [x] **Secrets are write-only** — the API returns only `hasKeySecret` / `hasWebhookSecret`, so
      the fields show "stored — leave blank to keep" rather than a value. Nothing sensitive is
      held in the app.
- [x] **Same guard as the backend** — enabling without a webhook secret is refused client-side
      too, since a payment could otherwise start and never be confirmed.
- [x] **`HttpSchoolService`** gains `paymentGateway` / `savePaymentGateway` / `clearPaymentGateway`,
      and `PaymentGatewayStatus` joins the school models.
- [x] **Removed the Modules section** — `enabledModules` gates nothing anywhere on the backend
      (grep confirms it's stored and displayed but never enforced), so the toggles implied
      control the platform doesn't actually have. `toggleModule` is left on the service in case
      it's wired up later. Removed from the web console's school detail page as well.

### v1.2.2 — Scheduled installments (2026-08-14)
Backend v1.2.1 stopped billing a parent for a whole session at once — future installments now
sit in a new `scheduled` status until their own month. The app follows.

- [x] **`InvoiceModel.isScheduled`**, and `isOverdue` now returns false for scheduled rows — an
      installment that hasn't been billed can't be late.
- [x] **Admin sees "Scheduled" chips** and an **Upcoming** filter chip on the invoices tab.
- [x] **Scheduled invoices aren't payable** — they're filtered out of the record-payment picker,
      and the invoice sheet explains they reach the parent in their own month rather than
      offering a payment button the backend would reject.
- [x] **Parent app needs no change** — the backend filters scheduled invoices out of parent
      responses, so the Fees screen and its outstanding total are correct automatically.

### v1.2.3 — "Pay now" only when the school actually accepts it (2026-08-14)
The Pay button showed on every unpaid invoice, even for a school whose Razorpay account was
switched off. Tapping it opened a spinner, hit the backend, and failed — the parent learned the
school doesn't take online payments only after trying.

- [x] **The button is gated on the school's setting** — `SchoolContact.onlinePaymentsEnabled`
      (new field on `/schools/mine`, backend v1.2.2). When it's off, the sheet reads "Please pay
      at the school office — the receipt appears here once it is recorded" and there's no button.
- [x] **Fetched when the sheet opens, not on tap** — the school lookup already happened inside
      `_pay()`; moving it to `initState` is what makes the decision available at render time. It
      also doubles as the merchant name for the Razorpay sheet, so it's one fetch either way.
- [x] **A failed lookup degrades to "pay at the office"** rather than showing a button that may
      not work — the office is always a valid way to pay.

### v1.2.4 — Subscription screens, receipt downloads, WhatsApp login codes, gallery delete (2026-08-17)

**Subscription (school → Sproutly)**
Two directions of money now live in the app and confusing them would be expensive, so the model
file says so at the top: **fees** are parent → school into the *school's* Razorpay account; a
**subscription** is school → Sproutly into the *platform's*.
- [x] **Admin → More → Subscription** — where the school stands, the invoice due, and paying it
      through Razorpay. Read-only otherwise: the amount and duration are the platform owner's to
      set, and there is no self-service renewal.
- [x] **A renewal banner on the admin home**, silent unless the plan is near expiry or past it, and
      shown to the admin only — nobody else owes anything.
- [x] **Super admin: a subscription section on the school detail sheet** — raise an invoice, record
      an office payment, or cancel one. "On trial" on the dashboard became "Needs renewal".
- [x] **`RazorpayCheckout` extracted** — one completer per attempt, a dismissed sheet arriving as
      an "error", always disposing the plugin. Both money flows share it now instead of forking
      that logic; `FeeCheckout`'s public API is unchanged.
- [x] **A free period activates instead of paying.** A zero-amount invoice has nothing for a
      gateway to collect, so the button reads **Activate**, comes back already settled, and stays
      available even when online payment is switched off.

**Fee receipts**
- [x] **Download on the parent fee sheet and the admin invoice sheet** — unpaid it prints as the
      invoice being asked for, paid it becomes the receipt. Saved to the app's own documents
      directory (no storage permission needed on any supported Android version) and handed to the
      system viewer.

**Login codes**
- [x] **The OTP arrives on WhatsApp.** The dev-mode auto-fill and the "read the code from the
      backend terminal" banner are gone — the code no longer exists anywhere a developer can read
      it. A 503 now means it genuinely wasn't sent, and says so.

**Gallery**
- [x] **Images load again** — the cause was server-side (backend v1.5.1); the app's URL resolution
      was already correct.
- [x] **Admins can delete** — from the detail screen's toolbar or by long-pressing a thumbnail.
      Both routes go through a new shared `confirmDestructive` dialog, which resolves `true` only
      on an explicit confirm, so a dismissed barrier or a stray back gesture can never delete a
      photo. The file itself is removed server-side, and the copy says so.
