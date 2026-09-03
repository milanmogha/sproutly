import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../../../core/models/subscription.dart';
import '../../../core/network/subscription_api.dart';
import '../../../core/services/razorpay_checkout.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/cards.dart';
import '../../../core/widgets/neu.dart';

/// The school's own view of what it owes Sproutly.
///
/// Read-only apart from paying: the amount and the duration are the platform
/// owner's to set, and there is no self-service renewal — when a period ends
/// the school talks to the owner, who raises the next invoice.
///
/// Note this screen keeps working when the school is locked out for
/// non-payment: `/subscriptions` is on the backend's always-writable list,
/// because paying is exactly how the lock is lifted.
class AdminSubscriptionScreen extends StatefulWidget {
  const AdminSubscriptionScreen({super.key});

  @override
  State<AdminSubscriptionScreen> createState() =>
      _AdminSubscriptionScreenState();
}

class _AdminSubscriptionScreenState extends State<AdminSubscriptionScreen> {
  late Future<_SubscriptionData> _future;
  bool _paying = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_SubscriptionData> _load() async {
    final api = SubscriptionApi.instance;
    final results = await Future.wait([api.mine(), api.myInvoices()]);
    return _SubscriptionData(
      state: results[0] as SubscriptionState,
      invoices: results[1] as List<SubscriptionInvoice>,
    );
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _pay(SubscriptionInvoice invoice) async {
    // Grabbed before the first await — reaching back into `context` after one
    // is exactly how a payment callback ends up firing into a dead widget.
    final messenger = ScaffoldMessenger.maybeOf(context);
    setState(() => _paying = true);
    try {
      final checkout = await SubscriptionApi.instance.startCheckout(invoice.id);

      // A free period has nothing for a gateway to collect — the server has
      // already activated it, so there is no sheet to open.
      if (checkout.settled) {
        if (!mounted) return;
        AppToast.show(context, 'Your subscription is active',
            type: ToastType.success);
        _refresh();
        return;
      }

      final outcome = await RazorpayCheckout.open(
        order: checkout.order!,
        // The payee here is the platform, not the school — the sheet must say
        // so, or an admin sees their own school's name asking them for money.
        name: 'Sproutly',
        description: 'Subscription ${checkout.invoiceNumber}',
        messenger: messenger,
        verify: ({
          required String orderId,
          required String paymentId,
          required String signature,
        }) =>
            SubscriptionApi.instance.verifyPayment(
          orderId: orderId,
          paymentId: paymentId,
          signature: signature,
        ),
      );
      if (!mounted) return;
      if (outcome == PaymentOutcome.paid) {
        AppToast.show(context, 'Payment received — thank you',
            type: ToastType.success);
        _refresh();
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, _readableError(e), type: ToastType.error);
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  static String _readableError(Object e) {
    if (e.toString().contains('not configured')) {
      return 'Online payment isn’t available right now — please pay at the office.';
    }
    return 'Could not start the payment. Please try again or pay at the office.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Subscription'),
      ),
      body: FutureBuilder<_SubscriptionData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError || !snap.hasData) {
            return _ErrorState(onRetry: _refresh);
          }

          final data = snap.data!;
          final state = data.state;
          final outstanding = state.outstanding;

          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
              children: [
                const Text(
                  'What your school pays Sproutly to use the platform. This is '
                  'separate from the fees parents pay you.',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                ),
                const SizedBox(height: 16),
                _StandingCard(state: state),
                const SizedBox(height: 12),
                if (outstanding != null)
                  _DueCard(
                    invoice: outstanding,
                    canPayOnline: state.gatewayAvailable,
                    paying: _paying,
                    onPay: () => _pay(outstanding),
                  )
                else
                  const AppCard(
                    child: Text(
                      'Nothing to pay right now. When your period is close to '
                      'ending, Sproutly will raise the next invoice and it '
                      'will appear here.',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ),
                const SizedBox(height: 24),
                const Text(
                  'Payment history',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 10),
                if (data.invoices.isEmpty)
                  const Text(
                    'No invoices yet.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  )
                else
                  for (final inv in data.invoices) ...[
                    _HistoryTile(invoice: inv),
                    const SizedBox(height: 8),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SubscriptionData {
  const _SubscriptionData({required this.state, required this.invoices});
  final SubscriptionState state;
  final List<SubscriptionInvoice> invoices;
}

/// Where the school stands right now — the headline of the screen.
class _StandingCard extends StatelessWidget {
  const _StandingCard({required this.state});
  final SubscriptionState state;

  @override
  Widget build(BuildContext context) {
    final accent = subscriptionAccent(state.phase);
    final unbilled = state.phase == SubscriptionPhase.unbilled;

    return AppCard(
      borderLeftColor: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      unbilled ? 'Status' : 'Active until',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                        letterSpacing: 0.4,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      unbilled
                          ? 'Not billed yet'
                          : formatSubscriptionDate(state.periodEnd),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark,
                      ),
                    ),
                  ],
                ),
              ),
              _Pill(label: state.phase.label, color: accent),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            state.message,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          if (state.schoolReadOnly) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Teachers and office staff can no longer make changes either. '
                'Reading records still works.',
                style: TextStyle(
                  color: AppColors.danger,
                  fontSize: 12,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The one thing the admin can act on.
class _DueCard extends StatelessWidget {
  const _DueCard({
    required this.invoice,
    required this.canPayOnline,
    required this.paying,
    required this.onPay,
  });

  final SubscriptionInvoice invoice;
  final bool canPayOnline;
  final bool paying;
  final VoidCallback onPay;

  /// A zero-amount invoice is a free period Sproutly granted — there is
  /// nothing to collect, so it activates rather than being paid.
  bool get _isFree => invoice.amount <= 0;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _isFree ? 'Free period ready' : 'Invoice due',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _isFree ? 'Free' : formatRupees(invoice.amount),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${invoice.invoiceNumber} · ${invoice.durationText} of service',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5),
          ),
          if (invoice.notes?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              invoice.notes!,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 14),
          // A free period needs no gateway, so it stays actionable even when
          // online payment isn't configured.
          if (_isFree || canPayOnline)
            PrimaryButton(
              label: _isFree
                  ? (paying ? 'Activating…' : 'Activate')
                  : (paying ? 'Opening…' : 'Pay online'),
              icon: _isFree ? Iconsax.tick_circle : Iconsax.card,
              color: AppColors.adminPrimary,
              isLoading: paying,
              onPressed: paying ? null : onPay,
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.mutedGray,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'Online payment is unavailable — please pay at the Sproutly '
                'office.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
              ),
            ),
          const SizedBox(height: 10),
          Text(
            _isFree
                ? 'Sproutly has granted this period at no charge — activating '
                    'it starts the clock.'
                : 'Paying early never costs you days — a new period starts '
                    'where the current one ends.',
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 11.5,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.invoice});
  final SubscriptionInvoice invoice;

  @override
  Widget build(BuildContext context) {
    final paid = invoice.status == SubscriptionInvoiceStatus.paid;
    final color = switch (invoice.status) {
      SubscriptionInvoiceStatus.paid => AppColors.success,
      SubscriptionInvoiceStatus.pending => AppColors.warning,
      SubscriptionInvoiceStatus.cancelled => AppColors.textMuted,
    };

    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  invoice.invoiceNumber,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                    fontSize: 13.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${formatSubscriptionDate(invoice.periodStart)} → '
                  '${formatSubscriptionDate(invoice.periodEnd)}',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11.5,
                  ),
                ),
                if (paid)
                  Text(
                    '${invoice.isFree ? 'Activated' : 'Paid'} '
                    '${formatSubscriptionDate(invoice.paidAt)} · '
                    '${invoice.settlementLabel}',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11.5,
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                invoice.isFree ? 'Free' : formatRupees(invoice.amount),
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 4),
              _Pill(label: invoice.status.label, color: color),
            ],
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Iconsax.card_slash,
                size: 40, color: AppColors.textMuted),
            const SizedBox(height: 12),
            const Text(
              'Could not load your subscription',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 16),
            SecondaryButton(label: 'Try again', onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

/// The renewal warning the admin sees on their home screen.
///
/// Only the admin ever sees it. Teachers, office staff and parents don't owe
/// anything, and handing them the school's billing problems isn't their
/// business — the backend enforces the same split in its lock messages.
///
/// Renders nothing at all when there is nothing to warn about, so the home
/// screen is unchanged for a school that is paid up.
class AdminSubscriptionBanner extends StatefulWidget {
  const AdminSubscriptionBanner({super.key});

  @override
  State<AdminSubscriptionBanner> createState() =>
      _AdminSubscriptionBannerState();
}

class _AdminSubscriptionBannerState extends State<AdminSubscriptionBanner> {
  SubscriptionState? _state;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final state = await SubscriptionApi.instance.mine();
      if (mounted) setState(() => _state = state);
    } catch (_) {
      // A billing hiccup must never break the home screen it sits on top of.
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = _state;
    if (state == null || !state.showWarning) return const SizedBox.shrink();

    final accent = subscriptionAccent(state.phase);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
      child: AppCard(
        padding: const EdgeInsets.all(14),
        background: accent.withValues(alpha: 0.08),
        borderLeftColor: accent,
        onTap: () async {
          await Navigator.of(context).push(
            neuRoute(const AdminSubscriptionScreen()),
          );
          // They may have just paid — reflect it without a manual refresh.
          if (mounted) _load();
        },
        child: Row(
          children: [
            Icon(
              state.adminReadOnly ? Iconsax.lock : Iconsax.timer,
              color: accent,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                state.message,
                style: const TextStyle(
                  color: AppColors.textDark,
                  fontSize: 12.5,
                  height: 1.35,
                ),
              ),
            ),
            const SizedBox(width: 6),
            Icon(Iconsax.arrow_right_3, color: accent, size: 16),
          ],
        ),
      ),
    );
  }
}

// ── Shared presentation ────────────────────────────────────

/// Colour for a phase. Amber means "act soon", red means something has
/// actually stopped working — the distinction is the whole point of the
/// grace window, so it must survive into the UI.
Color subscriptionAccent(SubscriptionPhase phase) => switch (phase) {
      SubscriptionPhase.active => AppColors.success,
      SubscriptionPhase.expiring => AppColors.warning,
      SubscriptionPhase.grace => AppColors.warning,
      SubscriptionPhase.adminLocked => AppColors.danger,
      SubscriptionPhase.locked => AppColors.danger,
      SubscriptionPhase.unbilled => AppColors.textMuted,
    };

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String formatSubscriptionDate(DateTime? date) =>
    date == null ? '—' : '${date.day} ${_months[date.month - 1]} ${date.year}';

/// `₹24,000` — whole rupees, grouped Indian-style (lakh/crore), because these
/// amounts are quoted and remembered, not calculated with.
String formatRupees(double amount) {
  final digits = amount.round().abs().toString();
  if (digits.length <= 3) return '₹$digits';

  // The last three digits group normally; everything above them goes in twos.
  final last3 = digits.substring(digits.length - 3);
  var rest = digits.substring(0, digits.length - 3);
  final groups = <String>[];
  while (rest.length > 2) {
    groups.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) groups.insert(0, rest);
  return '₹${groups.join(',')},$last3';
}
