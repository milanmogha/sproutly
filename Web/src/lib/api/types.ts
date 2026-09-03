/**
 * The shapes the API actually returns.
 *
 * Two things to know about this backend, both handled by the helpers below:
 *
 * 1. Documents carry `_id`, not `id`.
 * 2. Reference fields come back either as a bare id string or as the populated
 *    document, depending on the endpoint — so they are typed as {@link Ref}.
 */

/** A reference that may or may not have been populated by the server. */
export type Ref<T> = string | T | null | undefined;

export interface Entity {
  _id?: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** The id of a document, whichever key it arrived under. */
export function entityId(entity: Entity | string | null | undefined): string {
  if (!entity) return '';
  if (typeof entity === 'string') return entity;
  return entity._id ?? entity.id ?? '';
}

/** The id behind a reference, whether it was populated or not. */
export function refId<T extends Entity>(ref: Ref<T>): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : entityId(ref);
}

/** The populated document behind a reference, or null when it's just an id. */
export function refDoc<T extends Entity>(ref: Ref<T>): T | null {
  return ref && typeof ref !== 'string' ? ref : null;
}

/** The backend's list envelope for paginated endpoints. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit?: number;
  totalPages: number;
}

/**
 * The rows from a list endpoint, whether it paginated or returned a bare
 * array.
 *
 * Which one you get varies by endpoint — `/classes` and `/holidays` return
 * arrays while `/students`, `/users`, `/schools` and `/owners` paginate — so
 * callers go through this rather than guessing.
 */
export function listOf<T>(payload: T[] | Paginated<T> | undefined | null): T[] {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : (payload.data ?? []);
}

/** Total row count from a list response, falling back to what was returned. */
export function totalOf<T>(payload: T[] | Paginated<T> | undefined | null): number {
  if (!payload) return 0;
  return Array.isArray(payload) ? payload.length : (payload.total ?? payload.data?.length ?? 0);
}

/* ── People ─────────────────────────────────────────────────────────── */

export type UserRoleString = 'parent' | 'teacher' | 'admin' | 'principal' | 'super_admin';

export interface User extends Entity {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  role: UserRoleString;
  schoolId?: Ref<School>;
  isActive?: boolean;
  lastLoginAt?: string;
}

export interface Guardian {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  occupation?: string;
  isPrimary?: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Vaccination {
  name: string;
  doseLabel?: string;
  administered?: boolean;
  administeredOn?: string;
  dueOn?: string;
}

export interface MedicalInfo {
  bloodGroup?: string;
  allergies?: string[];
  conditions?: string[];
  medications?: string[];
  physicianName?: string;
  physicianPhone?: string;
  vaccinations?: Vaccination[];
}

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'withdrawn';

export interface Student extends Entity {
  firstName: string;
  lastName: string;
  admissionNumber: string;
  gender?: string;
  status: StudentStatus;
  dateOfBirth?: string;
  classId?: Ref<SchoolClass>;
  parentUserId?: Ref<User>;
  guardians?: Guardian[];
  emergencyContacts?: EmergencyContact[];
  address?: Address;
  medicalInfo?: MedicalInfo;
  profileCompleted?: boolean;
  photoUrl?: string;
}

export function studentName(student: Pick<Student, 'firstName' | 'lastName'>): string {
  return `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim();
}

/** The guardian flagged primary, else the first one listed. */
export function primaryGuardian(student: Student): Guardian | null {
  const guardians = student.guardians ?? [];
  if (!guardians.length) return null;
  return guardians.find((g) => g.isPrimary) ?? guardians[0];
}

/**
 * A staff record.
 *
 * The API stores these as generic documents — only `title`, `notes`,
 * `metadata` and `isActive` are accepted — so the person's details live inside
 * `metadata`. {@link staffDetails} reads them back with the right shape.
 */
export interface Staff extends Entity {
  /** The person's name — the only identifying field the API has of its own. */
  title?: string;
  notes?: string;
  metadata?: StaffDetails;
  isActive?: boolean;
}

export interface StaffDetails {
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  employeeId?: string;
  joiningDate?: string;
  [key: string]: unknown;
}

export function staffName(member: Staff): string {
  return member.title?.trim() || 'Staff member';
}

export function staffDetails(member: Staff): StaffDetails {
  return member.metadata ?? {};
}

/* ── School & classes ───────────────────────────────────────────────── */

export type SchoolStatus = 'active' | 'suspended' | 'inactive';

export interface School extends Entity {
  name: string;
  code: string;
  status: SchoolStatus;
  isActive?: boolean;
  enabledModules?: string[];
  contactEmail?: string;
  contactPhone?: string;
  /** The city lives here, not at the top level — see {@link schoolCity}. */
  address?: Address;
  currentAcademicYear?: string;
  /** Whether the school's Razorpay account is accepting online payments. */
  onlinePaymentsEnabled?: boolean;
  trustName?: string;
  website?: string;
  affiliationNumber?: string;
  /**
   * The owner this school is a branch of, populated as `{ _id, name }` by
   * both `/schools` and `/schools/:id`. There is no flat `ownerName` on the
   * wire — read it with {@link schoolOwnerName}.
   */
  ownerId?: Ref<Owner>;
  /** Present only on the create response, when an admin was invited with it. */
  adminInviteUrl?: string;
  /**
   * Whether that invite email actually reached the admin. False means the
   * account exists but nobody was told — the link has to be passed on by hand.
   */
  adminInvited?: boolean;
  logoUrl?: string;
}

/** The owner this school belongs to, or "—" when it is independent. */
export function schoolOwnerName(school?: School | null): string {
  return refDoc<Owner>(school?.ownerId)?.name || '—';
}

/** The school's city, which the API nests under `address`. */
export function schoolCity(school?: School | null): string {
  return school?.address?.city || '—';
}

/** A school's address as one line, for display. */
export function schoolAddress(school?: School | null): string {
  const a = school?.address;
  if (!a) return '—';
  const line = [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ');
  return line || '—';
}

export interface SchoolStats {
  total: number;
  byStatus: Record<string, number>;
}

export interface SchoolOverview {
  school: School;
  students: number;
  usersByRole: Record<string, number>;
}

export interface PaymentGatewayStatus {
  provider: string;
  keyId?: string;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  enabled: boolean;
  updatedAt?: string;
}

export interface SchoolClass extends Entity {
  name: string;
  section?: string;
  /** `2025-2026` — the API validates this format. */
  academicYear?: string;
  /** The API's field name is `classTeacher`, not `classTeacherId`. */
  classTeacher?: Ref<User>;
  capacity?: number;
  room?: string;
  isActive?: boolean;
  /** How many children sit in it. A virtual — the API calls it `enrolled`. */
  enrolled?: number;
}

/**
 * "Nursery A" from a class doc.
 *
 * Some endpoints populate the class and some return a bare id, so pass
 * `classes` (the list the screen already loaded) to resolve an id too.
 */
export function className(ref: Ref<SchoolClass>, classes?: SchoolClass[]): string {
  const doc = refDoc(ref) ?? classes?.find((c) => entityId(c) === refId(ref));
  if (!doc) return '—';
  return doc.section ? `${doc.name} ${doc.section}` : doc.name;
}

export interface Owner extends Entity {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface OwnerSummary {
  owner: Owner;
  branches: number;
  phases?: Record<string, number>;
}

export interface OwnerBranch {
  school: School;
  phase?: SubscriptionPhase;
  periodEnd?: string;
}

export interface OwnerDetail {
  owner: Owner;
  branches: OwnerBranch[];
}

/* ── Attendance ─────────────────────────────────────────────────────── */

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'on_leave' | 'half_day';

export interface AttendanceRecord extends Entity {
  /** The API populates the child here, not under `studentId`. */
  student?: Ref<Student>;
  studentId?: Ref<Student>;
  classId?: Ref<SchoolClass>;
  date?: string;
  status: AttendanceStatus;
  remarks?: string | null;
  checkInTime?: string;
  checkOutTime?: string;
}

/**
 * The student an attendance row is for.
 *
 * The class register populates `student` and omits `_id` entirely, so rows are
 * keyed by this rather than by a document id.
 */
export function attendanceStudentId(record: AttendanceRecord): string {
  return refId(record.student) || refId(record.studentId);
}

export function attendanceStudentName(record: AttendanceRecord): string {
  const doc = refDoc<Student & { fullName?: string }>(record.student) ??
    refDoc<Student & { fullName?: string }>(record.studentId);
  if (!doc) return '—';
  return doc.fullName?.trim() || studentName(doc);
}

export interface AttendanceDay {
  date: string;
  status: AttendanceStatus | string;
}

export interface AttendanceReport {
  from: string;
  to: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  halfDay: number;
  marked: number;
  workingDays: number;
  presentRate: number;
  days: AttendanceDay[];
}

export interface StaffAttendance extends Entity {
  staffId?: Ref<Staff>;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
}

/**
 * A row of today's staff sheet — what `/attendance/staff` actually returns.
 *
 * The endpoint maps each record to a flat row: the staff member's name and
 * role come back populated, not nested, and the times are `checkInAt` /
 * `checkOutAt`. {@link staffAttendanceStatus} handles the unmarked `null`.
 */
/**
 * One class's roll-call for one day.
 *
 * The endpoint takes a single `date` — it is a snapshot, not a range — and
 * answers with the head-count alongside a per-status breakdown. It is not the
 * flat `Record<string, number>` it was once typed as here.
 */
export interface ClassAttendanceSummary {
  date: string;
  /** Children on the roll, whether or not they were marked. */
  total: number;
  marked: number;
  notMarked: number;
  byStatus: Record<string, number>;
}

export interface StaffAttendanceRow {
  staffId: string;
  name: string;
  role: string;
  status: AttendanceStatus | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}

export function staffAttendanceStatus(row: StaffAttendanceRow): string {
  return row.status ?? 'unmarked';
}

/* ── Fees ───────────────────────────────────────────────────────────── */

export interface InvoiceLine {
  name: string;
  amount: number;
}

export type InvoiceStatus = 'scheduled' | 'pending' | 'partial' | 'paid' | 'overdue';

export interface Invoice extends Entity {
  invoiceNumber: string;
  period?: string;
  totalAmount: number;
  amountPaid: number;
  /** Server-computed virtual — `totalAmount - amountPaid`. */
  balance?: number;
  status: InvoiceStatus;
  dueDate?: string;
  issuedAt?: string;
  academicYear?: string;
  lineItems?: InvoiceLine[];
  /** The API populates the child here, not under `studentId`. */
  student?: Ref<Student>;
  studentId?: Ref<Student>;
  studentName?: string;
  admissionNumber?: string;
  classId?: Ref<SchoolClass>;
}

/** What's still owed on an invoice. */
export function invoiceBalance(invoice: Invoice): number {
  if (typeof invoice.balance === 'number') return Math.max(0, invoice.balance);
  return Math.max(0, (invoice.totalAmount ?? 0) - (invoice.amountPaid ?? 0));
}

/**
 * The child an invoice is for.
 *
 * The list endpoint populates `student`; other shapes flatten it to
 * `studentName` or leave a bare id under `studentId`. All three are handled.
 */
export function invoiceStudentName(invoice: Invoice): string {
  const populated = refDoc<Student>(invoice.student) ?? refDoc<Student>(invoice.studentId);
  if (populated) return studentName(populated);
  return invoice.studentName ?? '—';
}

export type FeeFrequency = 'monthly' | 'quarterly' | 'term' | 'annual';

export interface FeeStructure extends Entity {
  name: string;
  academicYear: string;
  frequency: FeeFrequency;
  components?: InvoiceLine[];
  totalAmount: number;
  dueDayOfMonth?: number;
  classId?: Ref<SchoolClass>;
  isActive?: boolean;
}

export interface Payment extends Entity {
  /** The API's field is `invoice`, not `invoiceId`. */
  invoice?: Ref<Invoice>;
  student?: Ref<Student>;
  amount: number;
  method?: string;
  reference?: string;
  paidAt?: string;
  status?: string;
  /** The receipt's own number, e.g. `PAY-2026-00001`. */
  paymentNumber?: string;
  note?: string;
}

export interface FeeCollectionSummary {
  totalCollected: number;
  paymentCount: number;
}

export interface FeeOutstandingSummary {
  outstandingInvoices: number;
  totalOutstanding: number;
}

/** A Razorpay order handed back by a checkout endpoint. */
export interface CheckoutOrder {
  orderId: string;
  /** Rupees, for display. */
  amount: number;
  /** Paise — what Razorpay checkout actually charges. */
  amountPaise: number;
  currency: string;
  /** The payee's own public key id; differs per school for fees. */
  keyId: string;
  invoiceNumber: string;
}

/**
 * The subscription checkout wraps its order: a renewal that was already
 * settled (a manually recorded payment, say) comes back with `settled: true`
 * and no order to open.
 */
export interface Checkout {
  settled: boolean;
  invoiceNumber?: string;
  order?: CheckoutOrder | null;
  periodEnd?: string;
}

/* ── Academics ──────────────────────────────────────────────────────── */

export interface Homework extends Entity {
  title: string;
  subject: string;
  description?: string;
  assignedDate?: string;
  dueDate?: string;
  classId?: Ref<SchoolClass>;
  attachmentUrl?: string;
}

export interface Assessment extends Entity {
  title: string;
  subject?: string;
  type?: string;
  maxScore?: number;
  date?: string;
  classId?: Ref<SchoolClass>;
}

/**
 * One child's score on one assessment.
 *
 * The assessment comes back populated under `assessment` — its title, subject
 * and `maxScore` live there, not on the result. Reading them off the result
 * meant every card showed "Assessment" and scored out of 100 regardless of the
 * real total, so a 18/20 read as 18%.
 */
export interface Result extends Entity {
  score: number;
  grade?: string;
  remarks?: string;
  student?: Ref<Student>;
  assessment?: Ref<Assessment>;
}

/** The assessment behind a result, when the endpoint populated it. */
export function resultAssessment(result: Result): Assessment | null {
  return refDoc<Assessment>(result.assessment);
}

/** What the result was scored out of. Falls back to a percentage. */
export function resultMaxScore(result: Result): number {
  return resultAssessment(result)?.maxScore ?? 100;
}

export type MilestoneStatus = 'not_started' | 'emerging' | 'achieved';

export interface Milestone extends Entity {
  title: string;
  category: string;
  status: MilestoneStatus;
  /** Server-set when the status says achieved; rejected if sent. */
  achievedDate?: string;
  notes?: string;
  /** The API returns the child under `student`, but takes `studentId` on create. */
  student?: Ref<Student>;
}

export type RemarkCategory =
  | 'academic'
  | 'behavior'
  | 'general'
  | 'appreciation'
  | 'concern';

export interface TeacherRemark extends Entity {
  remark: string;
  category?: RemarkCategory | string;
  /** Server-set — the API rejects a `date` on create. */
  date?: string;
  term?: string;
  /** The API populates the child here, not under `studentId`. */
  student?: Ref<Student>;
  /** Who wrote it — a bare id; the API does not populate or name them. */
  recordedBy?: Ref<User>;
}

export interface LessonPlan extends Entity {
  title: string;
  subject?: string;
  objectives?: string[];
  activities?: string[];
  resources?: string;
  date?: string;
  classId?: Ref<SchoolClass>;
}

export interface SyllabusUnit {
  title: string;
  topics?: string[];
  completed?: boolean;
}

export interface Syllabus extends Entity {
  subject: string;
  academicYear: string;
  units?: SyllabusUnit[];
  classId?: Ref<SchoolClass>;
}

/* ── Daycare / diary ────────────────────────────────────────────────── */

export type DiaryKind = 'meal' | 'nap' | 'activity' | 'health' | 'observation';

/**
 * A child's day, as the API returns it: one array per kind of log rather than
 * a single timeline. {@link diaryEntries} flattens it into something a screen
 * can render in order.
 */
export interface Diary {
  studentId?: string;
  date?: string;
  meals?: Array<Record<string, unknown>>;
  naps?: Array<Record<string, unknown>>;
  activities?: Array<Record<string, unknown>>;
  health?: Array<Record<string, unknown>>;
  observations?: Array<Record<string, unknown>>;
}

export interface DiaryEntry {
  kind: DiaryKind;
  title: string;
  subtitle?: string;
  when?: string;
}

const str = (row: Record<string, unknown>, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Joins the parts of a log line, skipping the ones that are missing. */
const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' · ');

/**
 * The day's logs as one ordered timeline — what the diary screens render.
 *
 * Each kind has its own fields, so this is where a meal becomes "Lunch" with
 * its menu underneath, and a nap becomes a duration.
 */
export function diaryEntries(diary?: Diary | null): DiaryEntry[] {
  if (!diary) return [];
  const entries: DiaryEntry[] = [];

  diary.meals?.forEach((row) =>
    entries.push({
      kind: 'meal',
      title: humanizeToken(str(row, 'mealType')) ?? 'Meal',
      subtitle: join(str(row, 'menu'), humanizeToken(str(row, 'amountEaten')), str(row, 'notes')),
      when: str(row, 'createdAt') ?? str(row, 'date'),
    }),
  );

  diary.naps?.forEach((row) => {
    const from = str(row, 'startTime');
    const to = str(row, 'endTime');
    entries.push({
      kind: 'nap',
      title: 'Nap',
      subtitle: join(
        from && to ? `${clockOf(from)} – ${clockOf(to)}` : undefined,
        humanizeToken(str(row, 'quality')),
        str(row, 'notes'),
      ),
      when: from ?? str(row, 'createdAt'),
    });
  });

  diary.activities?.forEach((row) =>
    entries.push({
      kind: 'activity',
      title: str(row, 'title') ?? 'Activity',
      subtitle: join(
        humanizeToken(str(row, 'category')),
        str(row, 'description'),
        str(row, 'notes'),
      ),
      when: str(row, 'createdAt') ?? str(row, 'date'),
    }),
  );

  diary.health?.forEach((row) =>
    entries.push({
      kind: 'health',
      title: humanizeToken(str(row, 'type')) ?? 'Health',
      subtitle: join(
        str(row, 'description'),
        typeof row.temperature === 'number' ? `${row.temperature}°C` : undefined,
        str(row, 'medication'),
        str(row, 'notes'),
      ),
      when: str(row, 'createdAt') ?? str(row, 'date'),
    }),
  );

  diary.observations?.forEach((row) =>
    entries.push({
      kind: 'observation',
      title: humanizeToken(str(row, 'mood')) ?? 'Observation',
      subtitle: join(str(row, 'observation'), str(row, 'context'), str(row, 'notes')),
      when: str(row, 'createdAt') ?? str(row, 'date'),
    }),
  );

  // Oldest first — a diary reads as the day unfolded.
  return entries.sort(
    (a, b) => new Date(a.when ?? 0).getTime() - new Date(b.when ?? 0).getTime(),
  );
}

/** "half_day" → "Half Day". Local copy so types.ts stays dependency-free. */
function humanizeToken(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The "4:30 pm" part of an ISO timestamp. */
function clockOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
}

/* ── Communication ──────────────────────────────────────────────────── */

export interface Circular extends Entity {
  title: string;
  body: string;
  audience: string;
  /** Target class when audience is "class". */
  classId?: Ref<SchoolClass>;
  /** Attachment URLs / server paths, when the school attached any. */
  attachments?: string[];
  pinned?: boolean;
  publishedAt?: string;
}

/**
 * An emergency alert the school broadcast.
 *
 * The text is `message`; there is no `body` — reading one rendered the
 * alert card with a heading and nothing under it.
 */
export interface Alert extends Entity {
  title: string;
  message: string;
  severity?: string;
  audience?: string;
  /** Target class when audience is "class". */
  classId?: Ref<SchoolClass>;
  sentAt?: string;
}

export interface Message extends Entity {
  senderId?: Ref<User>;
  recipientId?: Ref<User>;
  senderName?: string;
  senderRole?: string;
  recipientName?: string;
  recipientRole?: string;
  subject?: string;
  body: string;
  relatedStudent?: Ref<Student>;
  relatedStudentName?: string;
  read?: boolean;
  readAt?: string;
}

export interface ChatContact {
  userId: string;
  name: string;
  role: string;
  email?: string;
}

export interface ChatThread {
  userId: string;
  name: string;
  role: string;
  lastMessage: string;
  unread: number;
  lastAt?: string;
}

export type PtmStatus = 'requested' | 'scheduled' | 'declined' | 'completed' | 'cancelled';

/**
 * A parent–teacher meeting.
 *
 * The API populates the child under `student` and the person who called the
 * meeting under `requestedBy` — there are no flattened `studentName` /
 * `requestedByName` fields, so read them through the helpers below.
 */
export interface PtmRequest extends Entity {
  student?: Ref<Student>;
  requestedBy?: Ref<User>;
  parent?: Ref<User>;
  teacher?: Ref<User>;
  reason: string;
  status: PtmStatus;
  preferredSlots?: string[];
  scheduledAt?: string;
  responseNote?: string;
}

/** The child a meeting is about. */
export function ptmStudentName(request: PtmRequest): string {
  const student = refDoc<Student>(request.student);
  return student ? studentName(student) : 'Meeting request';
}

/** Who called the meeting, and in what capacity. */
export function ptmRequestedBy(request: PtmRequest): { name?: string; role?: string } {
  const user = refDoc<User>(request.requestedBy);
  return { name: user?.name, role: user?.role };
}

/* ── Leave, holidays, events ────────────────────────────────────────── */

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * A leave request.
 *
 * Both the applicant and the child come back populated, under `applicantId`
 * and `studentId` — there is no flattened `applicantName` or `studentName`.
 * {@link leaveSubject} picks whichever reads best for the row.
 */
export interface LeaveRequest extends Entity {
  type: string;
  status: LeaveStatus;
  fromDate?: string;
  toDate?: string;
  reason?: string;
  applicantRole?: string;
  applicantId?: Ref<User>;
  studentId?: Ref<Student>;
  reviewNote?: string;
}

/**
 * Who the leave is for: the child when a parent applied on their behalf,
 * otherwise the member of staff who applied for themselves.
 */
export function leaveSubject(leave: LeaveRequest): string {
  const student = refDoc<Student>(leave.studentId);
  if (student) return studentName(student);
  const applicant = refDoc<User>(leave.applicantId);
  return applicant?.name ?? 'Leave request';
}

export interface Holiday extends Entity {
  title: string;
  date: string;
  description?: string;
  type?: string;
}

export interface SchoolEvent extends Entity {
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  venue?: string;
  audience?: string;
  isActive?: boolean;
  registrationCount?: number;
}

/* ── Gallery, transport, admissions ─────────────────────────────────── */

/**
 * A photo or video in the school gallery.
 *
 * The stored document has no `url` column of its own — `/gallery/upload` puts
 * the path in `metadata.url` — so read it through {@link galleryItemUrl}
 * rather than off the item. Guessing at `metadata.path` is what left every
 * photo rendering as a grey placeholder.
 */
export interface GalleryItem extends Entity {
  title?: string;
  notes?: string;
  metadata?: GalleryMetadata;
  classId?: Ref<SchoolClass>;
}

export interface GalleryMetadata {
  /** Server-relative, e.g. `/uploads/1699-42.png`. */
  url?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  type?: 'image' | 'video';
  [key: string]: unknown;
}

/** The stored path of a gallery item, before it is resolved to a URL. */
export function galleryItemPath(item: GalleryItem): string | undefined {
  return item.metadata?.url;
}

/**
 * A bus route. Like {@link Staff}, the API stores these generically — the
 * route name is `title` and the vehicle, driver and stops live in `metadata`.
 */
export interface TransportRoute extends Entity {
  title?: string;
  notes?: string;
  /*
   * The vehicle and driver are real columns on the API's schema, not loose
   * metadata. An earlier version of this portal wrote them into `metadata`
   * instead, so routes it created are still shaped that way — `routeDetails`
   * reads both and prefers the column.
   */
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  routeName?: string;
  metadata?: RouteDetails;
  isActive?: boolean;
  /** Riders, as bare ids. The API's field is `assignedStudents`. */
  assignedStudents?: string[];
  /** Staff who ride it, as **user** ids — not staff-record ids. */
  assignedStaff?: string[];
}

export interface RouteDetails {
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  routeName?: string;
  /** Stops have no column of their own, so they do live in metadata. */
  stops?: Array<{ name: string; time?: string }>;
  [key: string]: unknown;
}

/**
 * The route's vehicle details, wherever they happen to be stored.
 *
 * Blank counts as absent: the API clears a field by writing `''` rather than
 * removing it, so a bare `?? '—'` would render nothing at all.
 */
export function routeDetails(route?: TransportRoute | null): RouteDetails {
  const meta = route?.metadata ?? {};
  const pick = (column?: string, fallback?: string): string | undefined => {
    const value = column?.trim() ? column : fallback;
    return value?.trim() ? value : undefined;
  };
  return {
    ...meta,
    vehicleNumber: pick(route?.vehicleNumber, meta.vehicleNumber),
    driverName: pick(route?.driverName, meta.driverName),
    driverPhone: pick(route?.driverPhone, meta.driverPhone),
    routeName: pick(route?.routeName, meta.routeName),
  };
}

export type InquiryStatus = 'new' | 'contacted' | 'visited' | 'converted' | 'closed';

/**
 * Admissions counts.
 *
 * Applications and inquiries are separate pipelines with separate status
 * vocabularies, so they are counted separately — the inquiry screen wants
 * `inquiries`, not the top-level application numbers.
 */
export interface AdmissionStats {
  total: number;
  byStatus: Record<string, number>;
  inquiries: {
    total: number;
    byStatus: Record<string, number>;
  };
}

export interface Inquiry extends Entity {
  childName: string;
  /**
   * Optional on the API, but converting the inquiry to an application is
   * refused without this and {@link Inquiry.gender} — so the intake form asks
   * for both.
   */
  childDateOfBirth?: string;
  gender?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  status: InquiryStatus;
  gradeInterested?: string;
  notes?: string;
}

/* ── Platform subscription ──────────────────────────────────────────── */

export type SubscriptionPhase =
  | 'trial'
  | 'active'
  | 'grace'
  | 'expired'
  | 'suspended'
  /** No invoice has ever been raised for this school. */
  | 'unbilled'
  | 'none';

export type SubscriptionInvoiceStatus = 'pending' | 'paid' | 'cancelled' | 'overdue';

export interface SubscriptionInvoice extends Entity {
  invoiceNumber: string;
  amount: number;
  durationDays?: number;
  durationLabel?: string;
  periodStart?: string;
  periodEnd?: string;
  status: SubscriptionInvoiceStatus;
  issuedAt?: string;
  paidAt?: string;
  method?: string;
  notes?: string;
}

export interface SubscriptionState {
  phase: SubscriptionPhase;
  periodEnd?: string;
  daysRemaining?: number;
  showWarning?: boolean;
  adminReadOnly?: boolean;
  schoolReadOnly?: boolean;
  outstanding?: SubscriptionInvoice | null;
  gatewayAvailable?: boolean;
}

/**
 * One school's billing position, from `/subscriptions/overview`.
 *
 * The state fields sit at the top level here rather than under a `state` key,
 * and the school arrives as a small embedded object — not an id.
 */
export interface PlatformBillingRow extends SubscriptionState {
  school: { id: string; name: string; code: string };
}

/* ── Dashboard ──────────────────────────────────────────────────────── */

/**
 * `/dashboard` — counts grouped by area, scoped to the caller's school.
 *
 * Every group is optional: the payload is shaped by the caller's role, so a
 * screen reads only the groups its role actually receives.
 */
export interface DashboardSummary {
  generatedAt?: string;
  school?: School | null;
  students?: {
    total?: number;
    active?: number;
    byStatus?: Record<string, number>;
  };
  staff?: { total?: number };
  leaves?: { pending?: number };
  attendance?: {
    total?: number;
    marked?: number;
    notMarked?: number;
    present?: number;
    absent?: number;
  };
}
