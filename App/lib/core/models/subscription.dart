/// The school → Sproutly side of the money.
///
/// Two payment systems live in this app and mixing them up would be expensive:
///
///  * **Fees** — parent pays the school, into the *school's* Razorpay account.
///    See `parent_fees.dart` and `fee_checkout.dart`.
///  * **Subscription** — school pays Sproutly for the platform, into the
///    *platform's* account. That is everything in this file.
library;

import '../network/parent_api.dart' show CheckoutOrder;

/// Where a school stands against its plan. Mirrors the backend's phases
/// exactly (`subscription-policy.ts`) — the server decides, never the app.
enum SubscriptionPhase {
  /// No invoice has ever been raised; nothing is enforced yet.
  unbilled,
  active,

  /// Inside the period, but close enough to expiry to warn the admin.
  expiring,

  /// Past expiry, still inside the grace window — everything still works.
  grace,

  /// Grace spent: the admin is read-only, everyone else carries on.
  adminLocked,

  /// Long overdue: the whole school is read-only.
  locked;

  static SubscriptionPhase parse(String? raw) => switch (raw) {
        'active' => SubscriptionPhase.active,
        'expiring' => SubscriptionPhase.expiring,
        'grace' => SubscriptionPhase.grace,
        'admin_locked' => SubscriptionPhase.adminLocked,
        'locked' => SubscriptionPhase.locked,
        _ => SubscriptionPhase.unbilled,
      };

  /// Short label for a status pill, from the platform's point of view.
  String get label => switch (this) {
        SubscriptionPhase.unbilled => 'Never billed',
        SubscriptionPhase.active => 'Active',
        SubscriptionPhase.expiring => 'Expiring',
        SubscriptionPhase.grace => 'In grace',
        SubscriptionPhase.adminLocked => 'Admin locked',
        SubscriptionPhase.locked => 'Locked',
      };
}

enum SubscriptionInvoiceStatus {
  pending,
  paid,
  cancelled;

  static SubscriptionInvoiceStatus parse(String? raw) => switch (raw) {
        'paid' => SubscriptionInvoiceStatus.paid,
        'cancelled' => SubscriptionInvoiceStatus.cancelled,
        _ => SubscriptionInvoiceStatus.pending,
      };

  String get label => switch (this) {
        SubscriptionInvoiceStatus.pending => 'Unpaid',
        SubscriptionInvoiceStatus.paid => 'Paid',
        SubscriptionInvoiceStatus.cancelled => 'Cancelled',
      };
}

/// What a school owes the platform for a stretch of service.
class SubscriptionInvoice {
  const SubscriptionInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.amount,
    required this.durationDays,
    required this.durationLabel,
    required this.periodStart,
    required this.periodEnd,
    required this.status,
    required this.issuedAt,
    required this.paidAt,
    required this.method,
    required this.notes,
  });

  final String id;
  final String invoiceNumber;
  final double amount;

  /// The durable fact. The dates below are provisional until it is paid —
  /// settling recomputes the window from when the money actually arrived.
  final int durationDays;
  final String? durationLabel;

  final DateTime? periodStart;
  final DateTime? periodEnd;
  final SubscriptionInvoiceStatus status;
  final DateTime? issuedAt;
  final DateTime? paidAt;

  /// `online` for gateway payments, anything else was taken at the office.
  final String? method;
  final String? notes;

  bool get isOnline => method == 'online';

  /// A free period the platform granted — nothing was collected for it.
  bool get isFree => amount <= 0;

  /// How this invoice was settled.
  ///
  /// A free period has no payment method at all, so calling it "at office"
  /// would be a small lie that adds up in an audit.
  String get settlementLabel {
    if (isFree) return 'granted free';
    return isOnline ? 'online' : 'at office';
  }

  /// "1 year" if the super admin named it, else "365 days".
  String get durationText => durationLabel?.isNotEmpty == true
      ? durationLabel!
      : '$durationDays day${durationDays == 1 ? '' : 's'}';

  factory SubscriptionInvoice.fromJson(Map<String, dynamic> j) =>
      SubscriptionInvoice(
        id: (j['_id'] ?? j['id'] ?? '').toString(),
        invoiceNumber: j['invoiceNumber'] as String? ?? '',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        durationDays: (j['durationDays'] as num?)?.toInt() ?? 0,
        durationLabel: j['durationLabel'] as String?,
        periodStart: _date(j['periodStart']),
        periodEnd: _date(j['periodEnd']),
        status: SubscriptionInvoiceStatus.parse(j['status'] as String?),
        issuedAt: _date(j['issuedAt']),
        paidAt: _date(j['paidAt']),
        method: j['method'] as String?,
        notes: j['notes'] as String?,
      );
}

/// GET /subscriptions/mine — and, for the super admin, of any one school.
class SubscriptionState {
  const SubscriptionState({
    required this.phase,
    required this.periodEnd,
    required this.daysRemaining,
    required this.showWarning,
    required this.adminReadOnly,
    required this.schoolReadOnly,
    required this.outstanding,
    required this.gatewayAvailable,
  });

  final SubscriptionPhase phase;
  final DateTime? periodEnd;

  /// Negative once expired; null when never billed.
  final int? daysRemaining;

  /// True while the admin should see the renewal banner.
  final bool showWarning;
  final bool adminReadOnly;
  final bool schoolReadOnly;

  /// The single unpaid invoice, if there is one — only one can exist at a
  /// time, so the school is never left guessing which to pay.
  final SubscriptionInvoice? outstanding;

  /// False when the platform's own Razorpay keys aren't configured server-side.
  final bool gatewayAvailable;

  factory SubscriptionState.fromJson(Map<String, dynamic> j) =>
      SubscriptionState(
        phase: SubscriptionPhase.parse(j['phase'] as String?),
        periodEnd: _date(j['periodEnd']),
        daysRemaining: (j['daysRemaining'] as num?)?.toInt(),
        showWarning: j['showWarning'] as bool? ?? false,
        adminReadOnly: j['adminReadOnly'] as bool? ?? false,
        schoolReadOnly: j['schoolReadOnly'] as bool? ?? false,
        outstanding: j['outstanding'] == null
            ? null
            : SubscriptionInvoice.fromJson(
                j['outstanding'] as Map<String, dynamic>),
        gatewayAvailable: j['gatewayAvailable'] as bool? ?? false,
      );

  /// The sentence the school's own admin reads.
  ///
  /// Written to the school, never about it — a lapsed plan is usually an
  /// invoice nobody got round to, not a refusal to pay.
  String get message {
    final days = daysRemaining ?? 0;
    final overdue = days.abs();
    String plural(int n) => n == 1 ? 'day' : 'days';

    return switch (phase) {
      SubscriptionPhase.unbilled =>
        'No subscription invoice has been raised for your school yet.',
      SubscriptionPhase.active =>
        'Your subscription is active — $days ${plural(days)} remaining.',
      SubscriptionPhase.expiring => days == 0
          ? 'Your subscription ends today. Renew to avoid interruption.'
          : 'Your subscription ends in $days ${plural(days)}. Renew to avoid interruption.',
      SubscriptionPhase.grace =>
        'Your subscription expired $overdue ${plural(overdue)} ago. You can still work normally for a few more days.',
      SubscriptionPhase.adminLocked =>
        'Your subscription expired $overdue ${plural(overdue)} ago, so admin changes are paused. Settle the invoice to restore them.',
      SubscriptionPhase.locked =>
        'Your subscription expired $overdue ${plural(overdue)} ago and the school is now read-only. Settle the invoice to restore access.',
    };
  }
}

/// What starting a payment produced.
///
/// Two outcomes, because not every invoice needs a gateway: a zero-amount
/// invoice is a free period the platform granted, so the server activates it
/// on the spot and no checkout sheet opens. Callers must branch on [settled]
/// rather than assume an order came back.
class SubscriptionCheckout {
  const SubscriptionCheckout({
    required this.settled,
    required this.invoiceNumber,
    this.order,
    this.periodEnd,
  });

  /// True when the invoice is already active and there is nothing to pay.
  final bool settled;
  final String invoiceNumber;

  /// Null exactly when [settled] is true.
  final CheckoutOrder? order;

  /// End of the newly activated period; only set when [settled] is true.
  final DateTime? periodEnd;

  factory SubscriptionCheckout.fromJson(Map<String, dynamic> j) {
    final settled = j['settled'] as bool? ?? false;
    return SubscriptionCheckout(
      settled: settled,
      invoiceNumber: j['invoiceNumber'] as String? ?? '',
      order: settled ? null : CheckoutOrder.fromJson(j),
      periodEnd: _date(j['periodEnd']),
    );
  }
}

/// One school's line on the super admin's billing list.
class PlatformBillingRow {
  const PlatformBillingRow({
    required this.schoolId,
    required this.schoolName,
    required this.schoolCode,
    required this.state,
  });

  final String schoolId;
  final String schoolName;
  final String schoolCode;
  final SubscriptionState state;

  factory PlatformBillingRow.fromJson(Map<String, dynamic> j) {
    final school = j['school'] as Map<String, dynamic>? ?? const {};
    return PlatformBillingRow(
      schoolId: school['id'] as String? ?? '',
      schoolName: school['name'] as String? ?? 'Unknown school',
      schoolCode: school['code'] as String? ?? '',
      state: SubscriptionState.fromJson(j),
    );
  }
}

DateTime? _date(dynamic value) =>
    value is String ? DateTime.tryParse(value)?.toLocal() : null;
