import { FeeFrequency } from '../../../common/enums/fee-frequency.enum';

/** One billing installment derived from a fee structure's frequency. */
export interface FeeInstallment {
  /** Unique-per-structure label, also used to de-duplicate invoices. */
  period: string;
  /**
   * When this installment becomes visible to the parent. The first one is
   * "now"; later ones fall on the same day-of-month, so a session generated on
   * the 14th bills on the 14th every month.
   */
  issueDate: Date;
  /** When this installment's invoice is due. Never before [issueDate]. */
  dueDate: Date;
  /** 0-based position within the session (Apr = 0 for monthly, etc.). */
  index: number;
}

const DEFAULT_DUE_DAY = 10;

/**
 * Days a parent gets to pay when the structure's due day has already passed
 * for the month an invoice is issued in — without this, generating on the 14th
 * against a due day of the 10th would produce invoices that are overdue the
 * moment they appear.
 */
const FALLBACK_GRACE_DAYS = 7;

/** Last calendar day of a 1-based month in a given year. */
function lastDayOfMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/** A date on `day` of a 1-based month, clamped to the month's length so the
 *  31st of a 30-day month lands on the 30th rather than rolling over. */
function dayIn(year: number, month1: number, day: number): Date {
  const clamped = Math.min(Math.max(day, 1), lastDayOfMonth(year, month1));
  return new Date(year, month1 - 1, clamped);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Midnight, so comparisons are day-level rather than time-of-day. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The calendar year the session starts in. Indian sessions run April–March,
 * so "2026-2027" starts in April 2026. Falls back to the current session.
 */
export function sessionStartYear(academicYear: string): number {
  const m = /^(\d{4})/.exec(academicYear.trim());
  if (m) return parseInt(m[1], 10);
  const now = new Date();
  // Before April we are still in the session that began last calendar year.
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Expands a fee structure into the invoices that should exist for one session.
 *
 * - monthly   → Apr…Mar
 * - quarterly → Apr, Jul, Oct, Jan
 * - term      → Apr, Oct
 * - annual    → Apr
 *
 * Two rules shape the result, both driven by [from] (the moment of
 * generation, defaulting to today):
 *
 * 1. **Nothing is billed for the past.** Installments whose month has already
 *    gone by are skipped — enrolling a child in September shouldn't invoice
 *    them for April.
 * 2. **Billing is anchored to the generation day.** The first installment
 *    issues immediately; the rest fall on the same day-of-month. Generate on
 *    the 14th and every invoice appears on the 14th.
 *
 * Amounts are per-installment (the caller bills the structure total on each).
 */
export function buildInstallments(
  frequency: FeeFrequency,
  academicYear: string,
  dueDayOfMonth?: number | null,
  from: Date = new Date(),
): FeeInstallment[] {
  const sy = sessionStartYear(academicYear);
  const dueDay = dueDayOfMonth ?? DEFAULT_DUE_DAY;
  const today = startOfDay(from);
  const anchorDay = today.getDate();
  const year = (month1: number) => (month1 >= 4 ? sy : sy + 1);

  /** Builds one installment, or null when its month is already behind us. */
  const make = (
    month1: number,
    index: number,
    period: string,
  ): FeeInstallment | null => {
    const y = year(month1);
    // The whole month has passed — this installment is never billed.
    const monthEnd = dayIn(y, month1, lastDayOfMonth(y, month1));
    if (monthEnd < today) return null;

    // Issue on the anchor day of that month; the current month issues today,
    // even if the anchor day has already passed within it.
    const anchored = dayIn(y, month1, anchorDay);
    const issueDate = anchored < today ? today : anchored;

    // Keep the school's chosen due day where it still makes sense, but never
    // let an invoice arrive already overdue.
    const preferredDue = dayIn(y, month1, dueDay);
    const dueDate =
      preferredDue < issueDate
        ? addDays(issueDate, FALLBACK_GRACE_DAYS)
        : preferredDue;

    return { period, issueDate, dueDate, index };
  };

  const out: FeeInstallment[] = [];
  const push = (i: FeeInstallment | null) => {
    if (i) out.push(i);
  };

  switch (frequency) {
    case FeeFrequency.MONTHLY: {
      const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      months.forEach((m, index) => {
        const y = year(m);
        push(make(m, index, `${y}-${String(m).padStart(2, '0')}`));
      });
      break;
    }
    case FeeFrequency.QUARTERLY: {
      [4, 7, 10, 1].forEach((m, index) =>
        push(make(m, index, `Q${index + 1} ${academicYear}`)),
      );
      break;
    }
    case FeeFrequency.TERM: {
      [4, 10].forEach((m, index) =>
        push(make(m, index, `Term ${index + 1} ${academicYear}`)),
      );
      break;
    }
    case FeeFrequency.ANNUAL:
    default:
      push(make(4, 0, `Annual ${academicYear}`));
      break;
  }

  return out;
}
