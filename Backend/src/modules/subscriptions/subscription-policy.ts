/**
 * The rules that decide what a school can still do when its subscription runs
 * out. Kept as pure functions, separate from the service, because they're the
 * part that decides whether real customers are locked out — they need to be
 * readable at a glance and testable without a database.
 */

/** Days before expiry that the admin starts seeing a renewal warning. */
export const WARN_BEFORE_DAYS = 5;

/**
 * Days after expiry the school admin keeps working. Also the most grace the
 * platform ever charges for: renew later than this and the days spent locked
 * out are free (see {@link renewalStart}).
 */
export const GRACE_DAYS = 5;

/**
 * Days after expiry before the rest of the school — teachers, parents, office
 * staff — drops to read-only too. Deliberately far out: they aren't the ones
 * who owe anything, and cutting a parent off from their child's attendance
 * over the school's billing is the wrong thing to do quickly.
 */
export const FULL_LOCK_AFTER_DAYS = 30;

export type SubscriptionPhase =
  /** No invoice has ever been raised — nothing to enforce yet. */
  | 'unbilled'
  /** Paid and comfortably inside the period. */
  | 'active'
  /** Inside the period, but expiry is close enough to warn the admin. */
  | 'expiring'
  /** Past expiry, still inside the grace window — everything works. */
  | 'grace'
  /** Grace spent: the admin is read-only, everyone else carries on. */
  | 'admin_locked'
  /** Long overdue: the whole school is read-only. */
  | 'locked';

export interface SubscriptionState {
  phase: SubscriptionPhase;
  /** End of the current paid period; null when unbilled. */
  periodEnd: Date | null;
  /** Negative once expired. */
  daysRemaining: number | null;
  /** True while the admin should see the renewal banner. */
  showWarning: boolean;
  /** True when the admin may no longer write. */
  adminReadOnly: boolean;
  /** True when everyone may no longer write. */
  schoolReadOnly: boolean;
}

/** Whole days between two dates, ignoring time of day. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Where a school stands right now.
 *
 * `periodEnd` is the end of its latest *paid* period; a school that has never
 * paid anything is `unbilled` and fully unrestricted, so introducing billing
 * can't lock out schools that were running happily before it existed.
 */
export function subscriptionState(
  periodEnd: Date | null,
  now: Date = new Date(),
): SubscriptionState {
  if (!periodEnd) {
    return {
      phase: 'unbilled',
      periodEnd: null,
      daysRemaining: null,
      showWarning: false,
      adminReadOnly: false,
      schoolReadOnly: false,
    };
  }

  // Positive while the period still has days in it, negative once past.
  const daysRemaining = daysBetween(now, periodEnd);
  const daysOverdue = -daysRemaining;

  let phase: SubscriptionPhase;
  if (daysOverdue > FULL_LOCK_AFTER_DAYS) phase = 'locked';
  else if (daysOverdue > GRACE_DAYS) phase = 'admin_locked';
  else if (daysOverdue > 0) phase = 'grace';
  else if (daysRemaining <= WARN_BEFORE_DAYS) phase = 'expiring';
  else phase = 'active';

  return {
    phase,
    periodEnd,
    daysRemaining,
    // The warning runs from five days out until the admin is actually locked.
    showWarning: ['expiring', 'grace', 'admin_locked', 'locked'].includes(
      phase,
    ),
    adminReadOnly: phase === 'admin_locked' || phase === 'locked',
    schoolReadOnly: phase === 'locked',
  };
}

/**
 * When a newly paid period should start.
 *
 *   `max(previous end, payment date − GRACE_DAYS)`
 *
 * Three behaviours fall out of that one line:
 *
 *  - **Paid early** — starts at the previous end, so nothing already paid for
 *    is lost.
 *  - **Paid within grace** — also starts at the previous end: those days were
 *    used, so they're billed.
 *  - **Paid long after** — starts `GRACE_DAYS` before payment, so the school
 *    pays for the grace it could use and not for the days it spent locked out.
 *
 * A school with no history simply starts today.
 */
export function renewalStart(
  previousEnd: Date | null,
  paidAt: Date = new Date(),
): Date {
  const earliestChargeable = addDays(paidAt, -GRACE_DAYS);
  if (!previousEnd) return startOfDay(paidAt);
  return startOfDay(
    previousEnd > earliestChargeable ? previousEnd : earliestChargeable,
  );
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Path prefixes that stay writable even when a school is locked out.
 *
 * Without these the lock is a trap: an admin whose plan lapsed could not pay
 * to end the lock, because paying is itself a write.
 */
export const ALWAYS_WRITABLE_PATHS = [
  '/auth',
  '/subscriptions', // viewing and paying the invoice that unlocks them
  '/notifications', // marking a renewal reminder read
  '/users/me', // their own profile and device tokens
];

/**
 * Whether a request path escapes the lock.
 *
 * Lives here, tested, because getting it wrong is the worst failure this
 * feature has: an admin who cannot reach checkout can never unlock themselves.
 * `req.path` carries the API's global prefix, so that is stripped first.
 */
export function isAlwaysWritable(path: string, globalPrefix = 'api'): boolean {
  const withoutPrefix = path.startsWith(`/${globalPrefix}/`)
    ? path.slice(globalPrefix.length + 1)
    : path;
  return ALWAYS_WRITABLE_PATHS.some((p) => withoutPrefix.startsWith(p));
}
