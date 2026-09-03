/**
 * The shape a fee receipt prints from.
 *
 * Deliberately a plain structure with no Mongo types in it: assembling it is
 * one job (queries, allocation, name-picking) and drawing it is another, and
 * only the first is worth testing.
 */

export interface ReceiptSchool {
  /** Society or trust, printed small above the school name. */
  trustName: string | null;
  name: string;
  address: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  affiliationNumber: string | null;
}

export interface ReceiptStudent {
  name: string;
  /** Falls back to the primary guardian when no father is recorded. */
  guardianName: string | null;
  guardianLabel: string;
  className: string | null;
  admissionNumber: string | null;
}

export interface ReceiptLine {
  description: string;
  due: number;
  /** Always 0 today — there is no concession feature yet. */
  concession: number;
  paid: number;
  balance: number;
}

export interface ReceiptPayment {
  mode: string;
  bank: string | null;
  /** Transaction id, cheque number, whatever was recorded. */
  number: string | null;
  date: Date | null;
  amount: number;
}

export interface FeeReceiptData {
  /** A settled invoice prints as a RECEIPT, an open one as an INVOICE. */
  kind: 'receipt' | 'invoice';
  documentNumber: string;
  academicYear: string;
  date: Date;
  school: ReceiptSchool;
  student: ReceiptStudent;
  lines: ReceiptLine[];
  payments: ReceiptPayment[];
  totals: {
    due: number;
    concession: number;
    paid: number;
    balance: number;
  };
  generatedAt: Date;
}

/**
 * Spreads what has been paid across the invoice's lines, top down.
 *
 * The stored model tracks payment against the invoice as a whole, but the
 * receipt has a per-line "Paid Amount" column. Filling each line in turn is
 * how a school office would read a part-payment anyway — the earlier heads are
 * settled first — and it adds back up to the invoice total either way.
 */
export function allocatePaid(
  lines: { name: string; amount: number }[],
  amountPaid: number,
): ReceiptLine[] {
  let remaining = Math.max(0, amountPaid);
  return lines.map((line) => {
    const due = line.amount;
    const paid = Math.min(due, remaining);
    remaining -= paid;
    return {
      description: line.name,
      due,
      concession: 0,
      paid,
      balance: Math.max(0, due - paid),
    };
  });
}

/** Column totals, summed from the rows so the footer can never disagree. */
export function totalsFor(lines: ReceiptLine[]): FeeReceiptData['totals'] {
  return lines.reduce(
    (acc, l) => ({
      due: acc.due + l.due,
      concession: acc.concession + l.concession,
      paid: acc.paid + l.paid,
      balance: acc.balance + l.balance,
    }),
    { due: 0, concession: 0, paid: 0, balance: 0 },
  );
}

/** `S.No.82/2, Tathawade, Pune, Maharashtra, 411033` — blank parts dropped. */
export function formatAddress(
  address: Record<string, string> | null | undefined,
): string | null {
  if (!address) return null;
  const line = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
  return line || null;
}

/**
 * Whose name goes in the guardian slot.
 *
 * The sample receipt says "Father's Name", but plenty of children are enrolled
 * by a mother or a guardian, and printing the wrong label on a legal-ish
 * document is worse than printing a different one — so the label follows the
 * relationship rather than being hardcoded.
 */
export function pickGuardian(
  guardians: { name: string; relationship?: string; isPrimary?: boolean }[],
): { name: string | null; label: string } {
  if (!guardians?.length) return { name: null, label: "Father's Name" };

  const father = guardians.find((g) => g.relationship === 'father');
  if (father) return { name: father.name, label: "Father's Name" };

  const mother = guardians.find((g) => g.relationship === 'mother');
  if (mother) return { name: mother.name, label: "Mother's Name" };

  const primary = guardians.find((g) => g.isPrimary) ?? guardians[0];
  return { name: primary.name, label: "Guardian's Name" };
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  online: 'Online',
};

export function paymentModeLabel(method: string): string {
  return PAYMENT_MODE_LABELS[method] ?? method;
}
