import {
  isAlwaysWritable,
  addDays,
  FULL_LOCK_AFTER_DAYS,
  GRACE_DAYS,
  renewalStart,
  subscriptionState,
  WARN_BEFORE_DAYS,
} from './subscription-policy';

/** A fixed "today" so these never depend on when they're run. */
const NOW = new Date(2026, 7, 14); // 14 Aug 2026

/** A period ending `offset` days from NOW (negative = already expired). */
const endingIn = (offset: number) => addDays(NOW, offset);

describe('subscriptionState', () => {
  it('leaves a never-billed school completely alone', () => {
    const s = subscriptionState(null, NOW);
    expect(s.phase).toBe('unbilled');
    expect(s.adminReadOnly).toBe(false);
    expect(s.schoolReadOnly).toBe(false);
    expect(s.showWarning).toBe(false);
  });

  it('is quiet while the period has room left', () => {
    const s = subscriptionState(endingIn(WARN_BEFORE_DAYS + 1), NOW);
    expect(s.phase).toBe('active');
    expect(s.showWarning).toBe(false);
  });

  it('starts warning exactly 5 days before expiry', () => {
    const s = subscriptionState(endingIn(WARN_BEFORE_DAYS), NOW);
    expect(s.phase).toBe('expiring');
    expect(s.showWarning).toBe(true);
    expect(s.adminReadOnly).toBe(false);
  });

  it('keeps everything working through the grace window', () => {
    for (const overdue of [1, GRACE_DAYS]) {
      const s = subscriptionState(endingIn(-overdue), NOW);
      expect(s.phase).toBe('grace');
      expect(s.showWarning).toBe(true);
      expect(s.adminReadOnly).toBe(false);
      expect(s.schoolReadOnly).toBe(false);
    }
  });

  it('locks the admin the day after grace ends, and nobody else', () => {
    const s = subscriptionState(endingIn(-(GRACE_DAYS + 1)), NOW);
    expect(s.phase).toBe('admin_locked');
    expect(s.adminReadOnly).toBe(true);
    expect(s.schoolReadOnly).toBe(false);
  });

  it('leaves the rest of the school alone right up to the 30-day mark', () => {
    const s = subscriptionState(endingIn(-FULL_LOCK_AFTER_DAYS), NOW);
    expect(s.schoolReadOnly).toBe(false);
  });

  it('locks the whole school once 30 days have passed', () => {
    const s = subscriptionState(endingIn(-(FULL_LOCK_AFTER_DAYS + 1)), NOW);
    expect(s.phase).toBe('locked');
    expect(s.adminReadOnly).toBe(true);
    expect(s.schoolReadOnly).toBe(true);
  });
});

describe('renewalStart', () => {
  const previousEnd = new Date(2026, 11, 31); // 31 Dec 2026

  it('starts today for a school with no history', () => {
    expect(renewalStart(null, NOW)).toEqual(NOW);
  });

  it('paying early keeps every remaining day', () => {
    // Paid 20 Dec for a period ending 31 Dec — the new period picks up at the
    // old end, so the last 11 days are not thrown away.
    const paidAt = new Date(2026, 11, 20);
    expect(renewalStart(previousEnd, paidAt)).toEqual(previousEnd);
  });

  it('paying inside grace bills the grace days used', () => {
    // 3 days late: the new period still starts at the old end, so those three
    // days come out of what was just bought.
    const paidAt = addDays(previousEnd, 3);
    expect(renewalStart(previousEnd, paidAt)).toEqual(previousEnd);
  });

  it('paying long after only bills the grace, not the locked-out days', () => {
    // 10 days late: 5 were usable grace, 5 were spent locked out. The new
    // period starts 5 days after the old end — the locked days are free.
    const paidAt = addDays(previousEnd, 10);
    expect(renewalStart(previousEnd, paidAt)).toEqual(
      addDays(previousEnd, GRACE_DAYS),
    );
  });

  it('never charges for more than the grace window, however late', () => {
    const paidAt = addDays(previousEnd, 400);
    const start = renewalStart(previousEnd, paidAt);
    // Whatever the delay, the school is only ever billed from GRACE_DAYS
    // before it paid — so a year of being locked out costs nothing.
    expect(start).toEqual(addDays(paidAt, -GRACE_DAYS));
  });
});

describe('isAlwaysWritable — the lock must never trap an admin', () => {
  it('lets a locked admin reach checkout, prefix and all', () => {
    // The bug this guards against: `req.path` includes the global prefix, so
    // matching on the bare route silently blocked the one endpoint that
    // could unlock the school.
    expect(
      isAlwaysWritable('/api/subscriptions/mine/invoices/abc123/checkout'),
    ).toBe(true);
    expect(isAlwaysWritable('/api/subscriptions/mine/payments/verify')).toBe(
      true,
    );
  });

  it('works with or without the prefix, and with a custom one', () => {
    expect(isAlwaysWritable('/subscriptions/mine')).toBe(true);
    expect(isAlwaysWritable('/v2/subscriptions/mine', 'v2')).toBe(true);
  });

  it('keeps auth reachable so they can sign in to pay', () => {
    expect(isAlwaysWritable('/api/auth/login')).toBe(true);
    expect(isAlwaysWritable('/api/auth/refresh')).toBe(true);
  });

  it('still blocks ordinary school writes', () => {
    for (const p of [
      '/api/holidays',
      '/api/students',
      '/api/fees/payments',
      '/api/attendance/mark',
      '/api/communication/circulars',
    ]) {
      expect(isAlwaysWritable(p)).toBe(false);
    }
  });

  it('is not fooled by a path that merely mentions an exempt word', () => {
    expect(isAlwaysWritable('/api/students/subscriptions')).toBe(false);
    expect(isAlwaysWritable('/api/users/me-too/something')).toBe(true);
  });
});
