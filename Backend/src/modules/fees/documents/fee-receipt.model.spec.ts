import {
  allocatePaid,
  formatAddress,
  paymentModeLabel,
  pickGuardian,
  totalsFor,
} from './fee-receipt.model';

describe('allocatePaid', () => {
  const lines = [
    { name: 'Tuition Fee', amount: 30400 },
    { name: 'Term Fee', amount: 6000 },
    { name: 'I Card Fee', amount: 300 },
  ];

  it('reproduces the sample receipt when fully paid', () => {
    expect(allocatePaid(lines, 36700)).toEqual([
      { description: 'Tuition Fee', due: 30400, concession: 0, paid: 30400, balance: 0 },
      { description: 'Term Fee', due: 6000, concession: 0, paid: 6000, balance: 0 },
      { description: 'I Card Fee', due: 300, concession: 0, paid: 300, balance: 0 },
    ]);
  });

  it('leaves everything owed when nothing is paid', () => {
    const result = allocatePaid(lines, 0);
    expect(result.map((l) => l.paid)).toEqual([0, 0, 0]);
    expect(result.map((l) => l.balance)).toEqual([30400, 6000, 300]);
  });

  // The office settles the earlier heads first, so a part-payment fills lines
  // top down rather than smearing proportionally across all of them.
  it('fills lines in order on a part payment', () => {
    const result = allocatePaid(lines, 31000);
    expect(result.map((l) => l.paid)).toEqual([30400, 600, 0]);
    expect(result.map((l) => l.balance)).toEqual([0, 5400, 300]);
  });

  it('never lets a line show more paid than it is due', () => {
    // An overpayment must not print a negative balance on the last line.
    const result = allocatePaid(lines, 999999);
    expect(result.map((l) => l.paid)).toEqual([30400, 6000, 300]);
    expect(result.every((l) => l.balance === 0)).toBe(true);
  });

  it('treats a negative paid amount as nothing paid', () => {
    expect(allocatePaid(lines, -50).map((l) => l.paid)).toEqual([0, 0, 0]);
  });

  it('handles an invoice with no lines', () => {
    expect(allocatePaid([], 500)).toEqual([]);
  });
});

describe('totalsFor', () => {
  it('sums the columns so the footer cannot disagree with the rows', () => {
    const lines = allocatePaid(
      [
        { name: 'A', amount: 30400 },
        { name: 'B', amount: 6000 },
        { name: 'C', amount: 300 },
      ],
      31000,
    );
    expect(totalsFor(lines)).toEqual({
      due: 36700,
      concession: 0,
      paid: 31000,
      balance: 5700,
    });
  });

  it('is all zeroes for an empty invoice', () => {
    expect(totalsFor([])).toEqual({
      due: 0,
      concession: 0,
      paid: 0,
      balance: 0,
    });
  });
});

describe('pickGuardian', () => {
  it('prefers the father, matching the printed label', () => {
    expect(
      pickGuardian([
        { name: 'Meera Sharma', relationship: 'mother' },
        { name: 'Ashwani Chaturvedi', relationship: 'father' },
      ]),
    ).toEqual({ name: 'Ashwani Chaturvedi', label: "Father's Name" });
  });

  // The label follows the relationship rather than being hardcoded: printing
  // "Father's Name" above a mother's name on a fee record is worse than
  // printing a different label.
  it('falls back to the mother, and says so', () => {
    expect(pickGuardian([{ name: 'Meera Sharma', relationship: 'mother' }])).toEqual(
      { name: 'Meera Sharma', label: "Mother's Name" },
    );
  });

  it('falls back to the primary guardian for anyone else', () => {
    expect(
      pickGuardian([
        { name: 'Uncle Ravi', relationship: 'guardian' },
        { name: 'Aunt Sita', relationship: 'guardian', isPrimary: true },
      ]),
    ).toEqual({ name: 'Aunt Sita', label: "Guardian's Name" });
  });

  it('leaves the slot blank rather than guessing when there are none', () => {
    expect(pickGuardian([])).toEqual({ name: null, label: "Father's Name" });
  });
});

describe('formatAddress', () => {
  it('joins the parts that are present', () => {
    expect(
      formatAddress({
        line1: '12 MG Road',
        city: 'Dehradun',
        state: 'Uttarakhand',
        postalCode: '248001',
      }),
    ).toBe('12 MG Road, Dehradun, Uttarakhand, 248001');
  });

  // A half-filled address must not print stray commas on a school's receipt.
  it('drops blank and whitespace-only parts', () => {
    expect(formatAddress({ line1: 'A', line2: '   ', city: 'B' })).toBe('A, B');
  });

  it('returns null when there is nothing to print', () => {
    expect(formatAddress(null)).toBeNull();
    expect(formatAddress({})).toBeNull();
    expect(formatAddress({ line1: '  ' })).toBeNull();
  });
});

describe('paymentModeLabel', () => {
  it('prints stored codes the way a person reads them', () => {
    expect(paymentModeLabel('bank_transfer')).toBe('Bank Transfer');
    expect(paymentModeLabel('upi')).toBe('UPI');
    expect(paymentModeLabel('online')).toBe('Online');
  });

  it('passes through anything it does not recognise', () => {
    expect(paymentModeLabel('demand_draft')).toBe('demand_draft');
  });
});
