import { http } from './client';
import type {
  AdmissionStats,
  Alert,
  Assessment,
  AttendanceRecord,
  AttendanceReport,
  AttendanceStatus,
  ChatContact,
  ChatThread,
  Checkout,
  CheckoutOrder,
  Circular,
  ClassAttendanceSummary,
  DashboardSummary,
  Diary,
  FeeCollectionSummary,
  FeeOutstandingSummary,
  FeeStructure,
  GalleryItem,
  Holiday,
  Homework,
  Inquiry,
  Invoice,
  LeaveRequest,
  LessonPlan,
  Message,
  Milestone,
  Owner,
  OwnerDetail,
  OwnerSummary,
  Paginated,
  Payment,
  PaymentGatewayStatus,
  PlatformBillingRow,
  PtmRequest,
  Result,
  School,
  SchoolClass,
  SchoolEvent,
  SchoolOverview,
  SchoolStats,
  Staff,
  StaffAttendance,
  StaffAttendanceRow,
  Student,
  SubscriptionInvoice,
  SubscriptionInvoiceStatus,
  SubscriptionState,
  Syllabus,
  TeacherRemark,
  TransportRoute,
  User,
} from './types';

/* ── Dashboard & reports ────────────────────────────────────────────── */

export const dashboardApi = {
  /** Role-shaped summary — what each portal's home screen opens with. */
  summary: () => http.get<DashboardSummary>('/dashboard'),
};

/* ── Students ───────────────────────────────────────────────────────── */

/**
 * The largest page the API will serve. Asking for more is a 400, not a
 * clamped response — picker screens that requested 200 rows showed "No
 * students found" to every school because of it.
 */
export const MAX_PAGE_LIMIT = 100;

export const studentsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    classId?: string;
    /** Only children with no class yet — what the allocation picker offers. */
    unassigned?: boolean;
    status?: string;
  }) => http.get<Paginated<Student> | Student[]>('/students', params),
  stats: () => http.get<{ total: number; byStatus: Record<string, number> }>('/students/stats'),
  get: (id: string) => http.get<Student>(`/students/${id}`),
  create: (body: Partial<Student>) => http.post<Student>('/students', body),
  update: (id: string, body: Partial<Student>) => http.patch<Student>(`/students/${id}`, body),
  /** Parent-facing edit of the fields a guardian is allowed to change. */
  updateProfile: (id: string, body: Partial<Student>) =>
    http.patch<Student>(`/students/${id}/profile`, body),
  /** Parents propose a change to a locked field; an admin approves it. */
  requestChange: (id: string, body: Record<string, unknown>) =>
    http.post<void>(`/students/${id}/change-request`, body),
  addGuardian: (id: string, body: Record<string, unknown>) =>
    http.post<Student>(`/students/${id}/guardians`, body),
  remove: (id: string) => http.delete<void>(`/students/${id}`),
};

/* ── Classes ────────────────────────────────────────────────────────── */

export const classesApi = {
  list: () => http.get<SchoolClass[]>('/classes'),
  get: (id: string) => http.get<SchoolClass>(`/classes/${id}`),
  students: (id: string) => http.get<Student[]>(`/classes/${id}/students`),
  create: (body: Partial<SchoolClass>) => http.post<SchoolClass>('/classes', body),
  update: (id: string, body: Partial<SchoolClass>) =>
    http.patch<SchoolClass>(`/classes/${id}`, body),
  /**
   * Moves students into this class.
   *
   * The API allocates one student per call, so a multi-pick from the UI is
   * fanned out here. They run together rather than in sequence — the server
   * writes each student's `classId` independently, so ordering buys nothing.
   */
  allocate: async (id: string, studentIds: string[]) => {
    await Promise.all(
      studentIds.map((studentId) =>
        http.post<void>(`/classes/${id}/allocate`, { studentId }),
      ),
    );
  },
  removeStudent: (id: string, studentId: string) =>
    http.delete<void>(`/classes/${id}/students/${studentId}`),
  /**
   * Sets — or, with null, clears — the class teacher.
   *
   * The API takes a **user** id under `classTeacher`, and reads an explicit
   * null as "nobody"; omitting the key would leave the current teacher in place.
   */
  assignTeacher: (id: string, teacherId: string | null) =>
    http.patch<SchoolClass>(`/classes/${id}`, { classTeacher: teacherId }),
  remove: (id: string) => http.delete<void>(`/classes/${id}`),
};

/* ── Attendance ─────────────────────────────────────────────────────── */

export const attendanceApi = {
  /** Bulk-marks a class for one date — what the teacher's roll-call submits. */
  mark: (body: {
    classId: string;
    /** Defaults to today when omitted. */
    date?: string;
    entries: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>;
  }) => http.post<void>('/attendance/mark', body),
  forClass: (classId: string, params?: { date?: string }) =>
    http.get<AttendanceRecord[]>(`/attendance/class/${classId}`, params),
  /** One day's roll-call for a class. Defaults to today. */
  classSummary: (classId: string, params?: { date?: string }) =>
    http.get<ClassAttendanceSummary>(`/attendance/class/${classId}/summary`, params),
  classLate: (classId: string, params?: { from?: string; to?: string }) =>
    http.get<AttendanceRecord[]>(`/attendance/class/${classId}/late`, params),
  forStudent: (studentId: string, params?: { from?: string; to?: string }) =>
    http.get<AttendanceRecord[]>(`/attendance/student/${studentId}`, params),
  studentMonthly: (studentId: string, params: { month?: string; year?: number }) =>
    http.get<AttendanceDayMap>(`/attendance/student/${studentId}/monthly`, params),
  studentReport: (studentId: string, params?: { from?: string; to?: string }) =>
    http.get<AttendanceReport>(`/attendance/student/${studentId}/report`, params),
  staffList: (params?: { date?: string }) =>
    http.get<StaffAttendanceRow[]>('/attendance/staff', params),
  staffCheckInOut: (body: { staffId: string; action: 'check_in' | 'check_out' }) =>
    http.post<StaffAttendance>('/attendance/staff/check-in-out', body),
  staffMark: (body: Record<string, unknown>) =>
    http.post<void>('/attendance/staff/mark', body),
  staffReport: (staffId: string, params?: { from?: string; to?: string }) =>
    http.get<AttendanceReport>(`/attendance/staff/${staffId}/report`, params),
};

/** The monthly endpoint returns per-day statuses keyed by date. */
export type AttendanceDayMap = Record<string, AttendanceStatus | string>;

/* ── Fees ───────────────────────────────────────────────────────────── */

export const feesApi = {
  structures: (params?: { classId?: string; academicYear?: string }) =>
    http.get<FeeStructure[]>('/fees/structures', params),
  structure: (id: string) => http.get<FeeStructure>(`/fees/structures/${id}`),
  createStructure: (body: Partial<FeeStructure>) =>
    http.post<FeeStructure>('/fees/structures', body),
  updateStructure: (id: string, body: Partial<FeeStructure>) =>
    http.patch<FeeStructure>(`/fees/structures/${id}`, body),
  removeStructure: (id: string) => http.delete<void>(`/fees/structures/${id}`),

  invoices: (params?: {
    status?: string;
    studentId?: string;
    classId?: string;
    page?: number;
    limit?: number;
  }) => http.get<Paginated<Invoice> | Invoice[]>('/fees/invoices', params),
  invoice: (id: string) => http.get<Invoice>(`/fees/invoices/${id}`),
  invoicePayments: (id: string) => http.get<Payment[]>(`/fees/invoices/${id}/payments`),
  createInvoice: (body: Record<string, unknown>) => http.post<Invoice>('/fees/invoices', body),
  /**
   * Raises a whole session's invoices for one class. The server derives the
   * periods and due dates from the structure's frequency.
   */
  generateInvoices: (body: {
    feeStructureId: string;
    classId: string;
    academicYear?: string;
  }) => http.post<{ created: number }>('/fees/invoices/generate', body),
  studentInvoices: (studentId: string) =>
    http.get<Invoice[]>(`/fees/students/${studentId}/invoices`),
  dues: (params?: { classId?: string }) => http.get<Invoice[]>('/fees/dues', params),

  recordPayment: (body: Record<string, unknown>) => http.post<Payment>('/fees/payments', body),
  /**
   * Opens a Razorpay order for an invoice — the parent pays in the browser.
   * Unlike the subscription equivalent, this returns the order directly.
   */
  checkout: (invoiceId: string) =>
    http.post<CheckoutOrder>(`/fees/invoices/${invoiceId}/checkout`),
  /**
   * Hands the checkout result back for signature verification.
   *
   * The school's webhook confirms the payment too — this just settles it
   * straight away so the parent sees "Paid" without waiting.
   */
  verifyPayment: (body: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => http.post<{ settled: boolean }>('/fees/payments/verify', body),

  collectionReport: (params?: { from?: string; to?: string }) =>
    http.get<FeeCollectionSummary>('/fees/reports/collection', params),
  outstandingReport: () => http.get<FeeOutstandingSummary>('/fees/reports/outstanding'),

  /** Absolute URL of an invoice receipt PDF, for a download link. */
  receiptUrl: (invoiceId: string) => `/fees/invoices/${invoiceId}/receipt.pdf`,
};

/* ── Academics ──────────────────────────────────────────────────────── */

export const academicApi = {
  assessments: (params?: { classId?: string; subject?: string }) =>
    http.get<Assessment[]>('/academic/assessments', params),
  assessment: (id: string) => http.get<Assessment>(`/academic/assessments/${id}`),
  assessmentResults: (id: string) => http.get<Result[]>(`/academic/assessments/${id}/results`),
  createAssessment: (body: Partial<Assessment>) =>
    http.post<Assessment>('/academic/assessments', body),
  removeAssessment: (id: string) => http.delete<void>(`/academic/assessments/${id}`),
  /** Enters scores for a whole class against one assessment. */
  recordResults: (body: {
    assessmentId: string;
    entries: Array<{ studentId: string; score: number; grade?: string; remarks?: string }>;
  }) => http.post<void>('/academic/results', body),
  studentProgress: (studentId: string) =>
    http.get<Result[]>(`/academic/students/${studentId}/progress`),

  homework: (params?: { classId?: string; from?: string; to?: string }) =>
    http.get<Homework[]>('/academic/homework', params),
  createHomework: (body: Partial<Homework>) => http.post<Homework>('/academic/homework', body),
  removeHomework: (id: string) => http.delete<void>(`/academic/homework/${id}`),

  syllabus: (params?: { classId?: string; subject?: string }) =>
    http.get<Syllabus[]>('/academic/syllabus', params),
  createSyllabus: (body: Partial<Syllabus>) => http.post<Syllabus>('/academic/syllabus', body),
  /**
   * Flips a unit's completion. The backend upserts on class+subject+year, so
   * sending the syllabus back with one unit toggled is the update path.
   */
  updateSyllabus: (body: Partial<Syllabus>) => http.post<Syllabus>('/academic/syllabus', body),

  lessonPlans: (params?: { classId?: string; from?: string; to?: string }) =>
    http.get<LessonPlan[]>('/academic/lesson-plans', params),
  createLessonPlan: (body: Partial<LessonPlan>) =>
    http.post<LessonPlan>('/academic/lesson-plans', body),

  milestones: (studentId: string) =>
    http.get<Milestone[]>(`/academic/students/${studentId}/milestones`),
  /**
   * Notes:
   * The create body is not `Partial<Milestone>` — the API takes `studentId`
   * but returns the child as `student`, and stamps `achievedDate` itself.
   */
  createMilestone: (body: {
    studentId: string;
    title: string;
    category?: string;
    status?: string;
    notes?: string;
  }) => http.post<Milestone>('/academic/milestones', body),
  updateMilestone: (id: string, body: Partial<Milestone>) =>
    http.patch<Milestone>(`/academic/milestones/${id}`, body),

  remarks: (studentId: string) =>
    http.get<TeacherRemark[]>(`/academic/students/${studentId}/remarks`),
  /** Same asymmetry as {@link academicApi.createMilestone}: `studentId` in, `student` out. */
  createRemark: (body: {
    studentId: string;
    remark: string;
    category?: string;
    term?: string;
  }) => http.post<TeacherRemark>('/academic/remarks', body),
};

/* ── Daycare / daily diary ──────────────────────────────────────────── */

export type DaycareKind = 'meals' | 'naps' | 'activities' | 'health' | 'observations';

export const daycareApi = {
  /** One kind of log for one child. The API has no class-wide filter. */
  list: (kind: DaycareKind, params: { studentId: string; date?: string }) =>
    http.get<Array<Record<string, unknown>>>(`/daycare/${kind}`, params),
  log: (kind: DaycareKind, body: Record<string, unknown>) =>
    http.post<void>(`/daycare/${kind}`, body),
  /** A child's whole day, assembled across every log type. */
  diary: (studentId: string, params?: { date?: string }) =>
    http.get<Diary>(`/daycare/diary/${studentId}`, params),
  remove: (kind: string, id: string) => http.delete<void>(`/daycare/${kind}/${id}`),
};

/* ── Communication ──────────────────────────────────────────────────── */

export const communicationApi = {
  sendMessage: (body: {
    recipientId: string;
    body: string;
    subject?: string;
    /** A child the message is about — teachers discussing a specific student. */
    relatedStudent?: string;
  }) => http.post<Message>('/communication/messages', body),
  inbox: () => http.get<Message[]>('/communication/messages/inbox'),
  sent: () => http.get<Message[]>('/communication/messages/sent'),
  unreadCount: () => http.get<{ unread: number }>('/communication/messages/unread-count'),
  contacts: () => http.get<ChatContact[]>('/communication/messages/contacts'),
  threads: () => http.get<ChatThread[]>('/communication/messages/threads'),
  conversation: (userId: string) =>
    http.get<Message[]>(`/communication/messages/conversation/${userId}`),
  markMessageRead: (id: string) => http.patch<Message>(`/communication/messages/${id}/read`),

  circulars: (params?: { audience?: string }) =>
    http.get<Circular[]>('/communication/circulars', params),
  circular: (id: string) => http.get<Circular>(`/communication/circulars/${id}`),
  createCircular: (body: Partial<Circular>) =>
    http.post<Circular>('/communication/circulars', body),
  removeCircular: (id: string) => http.delete<void>(`/communication/circulars/${id}`),

  /**
   * Calls a meeting with one child's family — office and teachers only. The
   * backend refuses a parent; pass `parentId` (the linked parent account) so
   * the request reaches the family, not just the staff queue.
   */
  requestPtm: (body: {
    studentId: string;
    reason: string;
    parentId?: string;
    teacherId?: string;
    preferredSlots?: string[];
  }) => http.post<PtmRequest>('/communication/ptm', body),
  /**
   * Calls meetings for whole classes — one per student with a linked parent.
   * An admin's meetings are created already scheduled (`scheduledAt` required);
   * a teacher's are raised as requests and the office schedules them.
   * Students without a linked parent are skipped and reported back.
   */
  requestPtmForClasses: (body: {
    classIds: string[];
    reason: string;
    scheduledAt?: string;
    responseNote?: string;
  }) => http.post<{ created: number; skipped: number }>('/communication/ptm/classes', body),
  myPtm: () => http.get<PtmRequest[]>('/communication/ptm/mine'),
  assignedPtm: () => http.get<PtmRequest[]>('/communication/ptm/assigned'),
  allPtm: (params?: { status?: string }) => http.get<PtmRequest[]>('/communication/ptm', params),
  respondToPtm: (id: string, body: { status: string; scheduledAt?: string; responseNote?: string }) =>
    http.patch<PtmRequest>(`/communication/ptm/${id}/respond`, body),

  alerts: () => http.get<Alert[]>('/communication/alerts'),
  createAlert: (body: {
    title: string;
    message: string;
    severity?: string;
    audience?: string;
    classId?: string;
  }) => http.post<Alert>('/communication/alerts', body),
};

/* ── Leave ──────────────────────────────────────────────────────────── */

export const leaveApi = {
  list: (params?: { status?: string; role?: string }) =>
    http.get<Paginated<LeaveRequest> | LeaveRequest[]>('/leave', params),
  /** Leave for the students in the signed-in teacher's class. */
  forClass: (params?: { status?: string }) => http.get<Paginated<LeaveRequest> | LeaveRequest[]>('/leave/class', params),
  get: (id: string) => http.get<LeaveRequest>(`/leave/${id}`),
  apply: (body: Partial<LeaveRequest>) => http.post<LeaveRequest>('/leave', body),
  review: (id: string, body: { status: string; reviewNote?: string }) =>
    http.patch<LeaveRequest>(`/leave/${id}`, body),
  cancel: (id: string) => http.patch<LeaveRequest>(`/leave/${id}/cancel`),
  remove: (id: string) => http.delete<void>(`/leave/${id}`),
};

/* ── Holidays & events ──────────────────────────────────────────────── */

export const holidaysApi = {
  list: (params?: { year?: number }) => http.get<Holiday[]>('/holidays', params),
  create: (body: Partial<Holiday>) => http.post<Holiday>('/holidays', body),
  remove: (id: string) => http.delete<void>(`/holidays/${id}`),
};

export const eventsApi = {
  list: (params?: { upcoming?: boolean }) => http.get<Paginated<SchoolEvent> | SchoolEvent[]>('/events', params),
  get: (id: string) => http.get<SchoolEvent>(`/events/${id}`),
  create: (body: Partial<SchoolEvent>) => http.post<SchoolEvent>('/events', body),
  update: (id: string, body: Partial<SchoolEvent>) =>
    http.patch<SchoolEvent>(`/events/${id}`, body),
  remove: (id: string) => http.delete<void>(`/events/${id}`),
  register: (id: string, body?: Record<string, unknown>) =>
    http.post<void>(`/events/${id}/register`, body),
  registrations: (id: string) =>
    http.get<Array<Record<string, unknown>>>(`/events/${id}/registrations`),
  myRegistrations: () => http.get<SchoolEvent[]>('/events/registrations/mine'),
};

/* ── Gallery ────────────────────────────────────────────────────────── */

export const galleryApi = {
  list: (params?: { classId?: string; albumId?: string }) =>
    http.get<Paginated<GalleryItem> | GalleryItem[]>('/gallery', params),
  get: (id: string) => http.get<GalleryItem>(`/gallery/${id}`),
  create: (body: Partial<GalleryItem>) => http.post<GalleryItem>('/gallery', body),
  update: (id: string, body: Partial<GalleryItem>) =>
    http.patch<GalleryItem>(`/gallery/${id}`, body),
  remove: (id: string) => http.delete<void>(`/gallery/${id}`),
  /**
   * Uploads a photo. Multipart, so it bypasses the JSON helper — the browser
   * must set the boundary itself, which means no explicit Content-Type here.
   */
  upload: (file: File, fields?: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(fields ?? {}).forEach(([key, value]) => form.append(key, value));
    return http.post<GalleryItem>('/gallery/upload', form);
  },
};

/* ── Transport ──────────────────────────────────────────────────────── */

export const transportApi = {
  list: () =>
    http.get<Paginated<TransportRoute> | TransportRoute[]>('/transport', {
      limit: MAX_PAGE_LIMIT,
    }),
  /**
   * The one route the signed-in user rides.
   *
   * For a parent that is their child's; for anyone else it is the route they
   * are assigned to as staff. Answers null when there is no such route.
   */
  mine: () => http.get<TransportRoute | null>('/transport/mine'),
  get: (id: string) => http.get<TransportRoute>(`/transport/${id}`),
  create: (body: Partial<TransportRoute>) => http.post<TransportRoute>('/transport', body),
  update: (id: string, body: Partial<TransportRoute>) =>
    http.patch<TransportRoute>(`/transport/${id}`, body),
  remove: (id: string) => http.delete<void>(`/transport/${id}`),
  assignStudent: (id: string, studentId: string) =>
    http.post<void>(`/transport/${id}/assign-student`, { studentId }),
  unassignStudent: (id: string, studentId: string) =>
    http.delete<void>(`/transport/${id}/unassign-student/${studentId}`),
  assignStaff: (id: string, staffId: string) =>
    http.post<void>(`/transport/${id}/assign-staff`, { staffId }),
  unassignStaff: (id: string, staffId: string) =>
    http.delete<void>(`/transport/${id}/unassign-staff/${staffId}`),
};

/* ── Admissions ─────────────────────────────────────────────────────── */

export const admissionsApi = {
  inquiries: (params?: { status?: string }) => http.get<Paginated<Inquiry> | Inquiry[]>('/admissions/inquiries', params),
  inquiry: (id: string) => http.get<Inquiry>(`/admissions/inquiries/${id}`),
  createInquiry: (body: Partial<Inquiry>) => http.post<Inquiry>('/admissions/inquiries', body),
  updateInquiry: (id: string, body: Partial<Inquiry>) =>
    http.patch<Inquiry>(`/admissions/inquiries/${id}`, body),
  /** Turns an inquiry into a full application. */
  convertInquiry: (id: string, body?: Record<string, unknown>) =>
    http.post<void>(`/admissions/inquiries/${id}/convert`, body),
  removeInquiry: (id: string) => http.delete<void>(`/admissions/inquiries/${id}`),
  applications: (params?: { status?: string }) =>
    http.get<Array<Record<string, unknown>>>('/admissions/applications', params),
  stats: () => http.get<AdmissionStats>('/admissions/stats'),
  waitlist: () => http.get<Array<Record<string, unknown>>>('/admissions/waitlist'),
  decide: (id: string, body: { decision: string; note?: string }) =>
    http.patch<void>(`/admissions/applications/${id}/decision`, body),
  /** Accepted applicant becomes a student. */
  enroll: (id: string, body?: Record<string, unknown>) =>
    http.post<Student>(`/admissions/applications/${id}/enroll`, body),
};

/* ── Staff & users ──────────────────────────────────────────────────── */

export const staffApi = {
  list: (params?: { search?: string; department?: string }) =>
    http.get<Paginated<Staff> | Staff[]>('/staff', params),
  get: (id: string) => http.get<Staff>(`/staff/${id}`),
  create: (body: Partial<Staff>) => http.post<Staff>('/staff', body),
  update: (id: string, body: Partial<Staff>) => http.patch<Staff>(`/staff/${id}`, body),
  remove: (id: string) => http.delete<void>(`/staff/${id}`),
};

/**
 * What the user wants to be told about.
 *
 * These are the only keys the API stores — it rejects anything else — so they
 * are named exactly, not left open-ended. They describe *which* events are
 * worth a notification, not which channel carries it; the channel is the
 * school's to configure.
 */
export interface NotificationPrefs {
  feeReminders?: boolean;
  attendanceAlerts?: boolean;
  homeworkNotifications?: boolean;
  eventReminders?: boolean;
  /** Direct messages between a parent and a teacher. */
  messageNotifications?: boolean;
}

export const usersApi = {
  list: (params?: { role?: string; schoolId?: string; search?: string }) =>
    http.get<Paginated<User> | User[]>('/users', params),
  get: (id: string) => http.get<User>(`/users/${id}`),
  /**
   * Creates a user. The set-password link is emailed as part of the same
   * request — there is no separate "send invite" step.
   *
   * `invited` reports whether that email actually left. The link comes back
   * too, but it is only worth showing when `invited` is false (SMTP off or
   * failing), where handing it over by hand is the only way in.
   */
  create: (body: Partial<User> & { role: string }) =>
    http.post<{ user: User; inviteUrl?: string; invited?: boolean }>('/users', body),
  update: (id: string, body: Partial<User>) => http.patch<User>(`/users/${id}`, body),
  remove: (id: string) => http.delete<void>(`/users/${id}`),
  updateMe: (body: Partial<User>) => http.patch<User>('/users/me', body),
  notificationPrefs: () => http.get<NotificationPrefs>('/users/me/notification-prefs'),
  updateNotificationPrefs: (body: NotificationPrefs) =>
    http.patch<NotificationPrefs>('/users/me/notification-prefs', body),
};

/* ── Schools (super admin) ──────────────────────────────────────────── */

export const schoolsApi = {
  list: (params?: { status?: string; search?: string; ownerId?: string }) =>
    http.get<Paginated<School> | School[]>('/schools', params),
  stats: () => http.get<SchoolStats>('/schools/stats'),
  get: (id: string) => http.get<School>(`/schools/${id}`),
  overview: (id: string) => http.get<SchoolOverview>(`/schools/${id}/overview`),
  /**
   * Creates a school and, with `admin`, its first admin login in the same
   * request — which is what emails them their set-password link. A school
   * without an admin has nobody who can sign in to it.
   */
  create: (body: Partial<School> & { admin?: { name: string; email: string } }) =>
    http.post<School>('/schools', body),
  update: (id: string, body: Partial<School>) => http.patch<School>(`/schools/${id}`, body),
  remove: (id: string) => http.delete<void>(`/schools/${id}`),
  suspend: (id: string, body?: { reason?: string }) =>
    http.patch<School>(`/schools/${id}/suspend`, body),
  reactivate: (id: string) => http.patch<School>(`/schools/${id}/reactivate`),
  /** Invites the school's first admin; returns a link to hand over. */
  addAdmin: (id: string, body: { name?: string; email: string }) =>
    http.post<{ user: User; inviteUrl?: string }>(`/schools/${id}/admins`, body),

  /** The school an admin belongs to — their own settings screen. */
  mine: () => http.get<School>('/schools/mine'),
  updateMine: (body: Partial<School>) => http.patch<School>('/schools/mine', body),

  paymentGateway: (schoolId: string) =>
    http.get<PaymentGatewayStatus>(`/schools/${schoolId}/payment-gateway`),
  savePaymentGateway: (schoolId: string, body: Record<string, unknown>) =>
    http.put<PaymentGatewayStatus>(`/schools/${schoolId}/payment-gateway`, body),
  removePaymentGateway: (schoolId: string) =>
    http.delete<void>(`/schools/${schoolId}/payment-gateway`),
};

export const ownersApi = {
  list: () => http.get<Paginated<OwnerSummary> | OwnerSummary[]>('/owners'),
  /** The owner record alone — no branches. {@link ownersApi.branches} has those. */
  get: (id: string) => http.get<Owner>(`/owners/${id}`),
  /**
   * The owner **plus** every branch and where its subscription stands.
   *
   * This is the one the detail screen wants: `/owners/:id` answers a bare
   * owner document, so destructuring `{ owner, branches }` off it yields
   * undefined and the page throws on the first field it reads.
   */
  branches: (id: string) => http.get<OwnerDetail>(`/owners/${id}/branches`),
  create: (body: Partial<Owner>) => http.post<Owner>('/owners', body),
  update: (id: string, body: Partial<Owner>) => http.patch<Owner>(`/owners/${id}`, body),
  remove: (id: string) => http.delete<void>(`/owners/${id}`),
  /** Files an existing school under this owner. The API takes a batch. */
  attachSchool: (id: string, schoolId: string) =>
    http.post<void>(`/owners/${id}/schools`, { schoolIds: [schoolId] }),
  detachSchool: (id: string, schoolId: string) =>
    http.delete<void>(`/owners/${id}/schools/${schoolId}`),
};

/* ── Platform subscription ──────────────────────────────────────────── */

export const subscriptionsApi = {
  /** What the signed-in admin's school owes Sproutly. */
  mine: () => http.get<SubscriptionState>('/subscriptions/mine'),
  myInvoices: () => http.get<SubscriptionInvoice[]>('/subscriptions/mine/invoices'),
  checkout: (invoiceId: string) =>
    http.post<Checkout>(`/subscriptions/mine/invoices/${invoiceId}/checkout`),
  verifyPayment: (body: Record<string, unknown>) =>
    http.post<{ settled: boolean }>('/subscriptions/mine/payments/verify', body),

  /**
   * Every school's billing position — one row per school, with its phase.
   * This is the list the platform screens render.
   */
  overview: () => http.get<PlatformBillingRow[]>('/subscriptions/overview'),
  /**
   * Every subscription invoice ever raised, newest first — a flat ledger
   * across all schools, not one row per school.
   */
  allInvoices: (status?: SubscriptionInvoiceStatus) =>
    http.get<SubscriptionInvoice[]>('/subscriptions', status ? { status } : undefined),
  forSchool: (schoolId: string) =>
    http.get<SubscriptionState>(`/subscriptions/schools/${schoolId}`),
  schoolInvoices: (schoolId: string) =>
    http.get<SubscriptionInvoice[]>(`/subscriptions/schools/${schoolId}/invoices`),
  raiseInvoice: (schoolId: string, body: Record<string, unknown>) =>
    http.post<SubscriptionInvoice>(`/subscriptions/schools/${schoolId}/invoices`, body),
  recordPayment: (invoiceId: string, body: Record<string, unknown>) =>
    http.post<SubscriptionInvoice>(`/subscriptions/invoices/${invoiceId}/record-payment`, body),
  removeInvoice: (invoiceId: string) =>
    http.delete<void>(`/subscriptions/invoices/${invoiceId}`),
};
