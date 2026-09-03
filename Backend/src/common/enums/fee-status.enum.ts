export enum FeeStatus {
  /**
   * Billed for a future month: the row exists so the school can see the whole
   * session's plan, but it isn't owed yet and parents don't see it. The daily
   * sweep flips it to PENDING on its issue date.
   */
  SCHEDULED = 'scheduled',
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  WAIVED = 'waived',
  REFUNDED = 'refunded',
}
