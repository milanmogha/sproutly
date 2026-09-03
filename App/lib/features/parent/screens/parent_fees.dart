import 'package:iconsax/iconsax.dart';
import 'package:flutter/material.dart';
import '../../../core/models/student.dart';
import '../../../core/network/parent_api.dart';
import '../../../core/services/document_download.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';
import 'fee_checkout.dart';

class ParentFeesScreen extends StatefulWidget {
  const ParentFeesScreen({super.key});

  @override
  State<ParentFeesScreen> createState() => _ParentFeesScreenState();
}

class _ParentFeesScreenState extends State<ParentFeesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  Future<List<InvoiceModel>>? _future;
  Student? _child;

  @override
  void initState() {
    super.initState();
    ParentApi.instance.selectedChild.addListener(_onChildChanged);
    _load();
  }

  void _onChildChanged() {
    if (mounted) _load();
  }

  void _load() {
    setState(() {
      _child = ParentApi.instance.selectedChild.value;
      if (_child == null) {
        // Home screen may not have run yet — load children first.
        _future = ParentApi.instance.childrenCached().then((kids) {
          final kid = ParentApi.instance.selectedChild.value;
          if (kid == null) return <InvoiceModel>[];
          _child = kid;
          return ParentApi.instance.getStudentInvoices(kid.id);
        });
      } else {
        _future = ParentApi.instance.getStudentInvoices(_child!.id);
      }
    });
  }

  @override
  void dispose() {
    ParentApi.instance.selectedChild.removeListener(_onChildChanged);
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text(
            _child == null ? 'Fees' : 'Fees • ${_child!.firstName}',
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.textDark)),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.parentPrimary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.parentPrimary,
          indicatorWeight: 3,
          tabs: const [Tab(text: 'Pending'), Tab(text: 'History')],
        ),
      ),
      body: FutureBuilder<List<InvoiceModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '⚠️',
              title: 'Could not load fees',
              subtitle: '${snap.error}',
            );
          }
          final all = snap.data ?? const <InvoiceModel>[];
          final pending = all.where((i) => !i.isPaid).toList();
          final history = all.where((i) => i.isPaid).toList();
          return TabBarView(
            controller: _tabs,
            children: [
              RefreshIndicator(
                onRefresh: () async => _load(),
                child: _PendingList(items: pending, onPaid: _load),
              ),
              RefreshIndicator(
                onRefresh: () async => _load(),
                child: _HistoryList(items: history, onPaid: _load),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _PendingList extends StatelessWidget {
  const _PendingList({required this.items, required this.onPaid});
  final List<InvoiceModel> items;

  /// Reloads the invoice list once an online payment settles.
  final VoidCallback onPaid;

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.parentPrimary;
    final total = items.fold<double>(0, (a, b) => a + b.balance);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        NeuCard(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Total outstanding',
                  style:
                      TextStyle(color: AppColors.textMuted, fontSize: 13)),
              const SizedBox(height: 4),
              Text(
                Formatters.formatRupees(total),
                style: TextStyle(
                  color: accent,
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 6),
              Text(
                items.isEmpty
                    ? 'All clear! Nothing to pay right now.'
                    : 'Please pay at the school office to avoid late charges.',
                style:
                    const TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (items.isEmpty)
          const EmptyState(
            emoji: '🎉',
            title: 'You\'re all paid up',
            subtitle: 'No outstanding fees right now.',
          )
        else
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _FeeCard(
                key: ValueKey(item.id),
                item: item,
                onTap: () => _showInvoiceSheet(context, item, onPaid),
              ),
            ),
      ],
    );
  }
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.items, required this.onPaid});
  final List<InvoiceModel> items;
  final VoidCallback onPaid;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        children: const [
          SizedBox(height: 80),
          EmptyState(
            emoji: '🧾',
            title: 'No history yet',
            subtitle: 'Paid invoices will show up here.',
          ),
        ],
      );
    }
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      itemCount: items.length,
      itemBuilder: (_, i) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: _FeeCard(
          key: ValueKey(items[i].id),
          item: items[i],
          onTap: () => _showInvoiceSheet(context, items[i], onPaid),
        ),
      ),
    );
  }
}

class _FeeCard extends StatelessWidget {
  const _FeeCard({super.key, required this.item, required this.onTap});
  final InvoiceModel item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.parentPrimary;
    final chipType = switch (item.status) {
      'paid' => ChipType.success,
      'overdue' => ChipType.danger,
      _ => ChipType.warning,
    };
    final chipLabel = switch (item.status) {
      'paid' => 'Paid',
      'partial' => 'Partial',
      'overdue' => 'Overdue',
      _ => 'Pending',
    };
    return NeuCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          NeuIconWell(icon: Iconsax.money_recive, color: accent, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('${item.period} • ${item.invoiceNumber}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                  item.dueDate == null
                      ? 'No due date'
                      : 'Due ${Formatters.formatShortDate(item.dueDate!)}',
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                  Formatters.formatRupees(
                      item.isPaid ? item.totalAmount : item.balance),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontFamily: 'monospace',
                      fontSize: 15)),
              const SizedBox(height: 4),
              StatusChip(label: chipLabel, type: chipType),
            ],
          ),
        ],
      ),
    );
  }
}

void _showInvoiceSheet(
  BuildContext context,
  InvoiceModel item,
  VoidCallback onPaid,
) {
  showAppBottomSheet<void>(
    context: context,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.invoiceNumber,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Text(item.period,
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.parentBg,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                for (final line in item.lineItems) ...[
                  Row(
                    children: [
                      Text(line.name,
                          style:
                              const TextStyle(color: AppColors.textMuted)),
                      const Spacer(),
                      Text(Formatters.formatRupees(line.amount),
                          style: const TextStyle(
                              fontFamily: 'monospace', fontSize: 14)),
                    ],
                  ),
                  const SizedBox(height: 8),
                ],
                const Divider(height: 12, color: AppColors.mutedGray),
                Row(
                  children: [
                    const Text('Total',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    const Spacer(),
                    Text(Formatters.formatRupees(item.totalAmount),
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontFamily: 'monospace',
                            fontSize: 16)),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Text('Paid',
                        style: TextStyle(color: AppColors.textMuted)),
                    const Spacer(),
                    Text(Formatters.formatRupees(item.amountPaid),
                        style: const TextStyle(
                            fontFamily: 'monospace',
                            color: AppColors.success)),
                  ],
                ),
                if (!item.isPaid) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Text('Balance',
                          style: TextStyle(color: AppColors.textMuted)),
                      const Spacer(),
                      Text(Formatters.formatRupees(item.balance),
                          style: const TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w700,
                              color: AppColors.danger)),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (item.isPaid)
            const Text(
              'Invoice settled — thank you!',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            )
          else
            _PayNowButton(item: item, onPaid: onPaid),
          const SizedBox(height: 8),
          // Offered whether paid or not: unpaid it prints as the invoice being
          // asked for, paid it becomes the receipt.
          _DownloadReceiptButton(item: item),
        ],
      ),
    ),
  );
}

/// Downloads the printable fee document and opens it on the device.
class _DownloadReceiptButton extends StatefulWidget {
  const _DownloadReceiptButton({required this.item});
  final InvoiceModel item;

  @override
  State<_DownloadReceiptButton> createState() => _DownloadReceiptButtonState();
}

class _DownloadReceiptButtonState extends State<_DownloadReceiptButton> {
  bool _busy = false;

  Future<void> _download() async {
    setState(() => _busy = true);
    final outcome = await DocumentDownload.open(
      path: '/fees/invoices/${widget.item.id}/receipt.pdf',
      fallbackName: '${widget.item.invoiceNumber}.pdf',
    );
    if (!mounted) return;
    setState(() => _busy = false);

    switch (outcome) {
      case DownloadOutcome.opened:
        break;
      case DownloadOutcome.savedOnly:
        AppToast.show(context, 'Saved, but no PDF viewer is installed',
            type: ToastType.info);
      case DownloadOutcome.notAllowed:
        AppToast.show(context, 'This document isn’t available to you',
            type: ToastType.error);
      case DownloadOutcome.failed:
        AppToast.show(context, 'Could not download the document',
            type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SecondaryButton(
      label: _busy
          ? 'Preparing…'
          : (widget.item.isPaid ? 'Download receipt' : 'Download invoice'),
      icon: Iconsax.document_download,
      color: AppColors.parentPrimary,
      onPressed: _busy ? null : _download,
    );
  }
}

/// Pays one invoice online. Only shown when the school has switched on its
/// Razorpay account — otherwise the parent is pointed at the office, which
/// stays the fallback for every school.
class _PayNowButton extends StatefulWidget {
  const _PayNowButton({required this.item, required this.onPaid});
  final InvoiceModel item;
  final VoidCallback onPaid;

  @override
  State<_PayNowButton> createState() => _PayNowButtonState();
}

class _PayNowButtonState extends State<_PayNowButton> {
  bool _busy = false;

  /// The school, fetched up front rather than on tap: it says whether online
  /// payments are switched on at all, and offering a button that can only fail
  /// is worse than not offering one.
  SchoolContact? _school;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSchool();
  }

  Future<void> _loadSchool() async {
    try {
      final school = await ParentApi.instance.getSchoolContact();
      if (mounted) setState(() { _school = school; _loading = false; });
    } catch (_) {
      // Treat an unreachable school as "no online payments" — the office is
      // always a valid way to pay, so this degrades rather than breaks.
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pay() async {
    setState(() => _busy = true);
    final child = ParentApi.instance.selectedChild.value;

    final outcome = await FeeCheckout.start(
      context: context,
      invoiceId: widget.item.id,
      studentName: child?.firstName ?? 'Student',
      // Shown as the merchant name on the Razorpay sheet.
      schoolName: _school?.name ?? 'School fees',
    );
    if (!mounted) return;
    setState(() => _busy = false);

    if (outcome == FeePaymentOutcome.paid) {
      Navigator.of(context).maybePop();
      AppToast.show(
        context,
        'Payment received — thank you!',
        type: ToastType.success,
      );
      widget.onPaid();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
        height: 52,
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    // This school takes fees at the office only.
    if (!(_school?.onlinePaymentsEnabled ?? false)) {
      return const Text(
        'Please pay at the school office — the receipt appears here once it is recorded.',
        style: TextStyle(color: AppColors.textMuted, fontSize: 12),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PrimaryButton(
          label: 'Pay ${Formatters.formatRupees(widget.item.balance)}',
          icon: Iconsax.card,
          isLoading: _busy,
          color: AppColors.parentPrimary,
          onPressed: _busy ? null : _pay,
        ),
        const SizedBox(height: 8),
        const Text(
          'Or pay at the school office — the receipt appears here either way.',
          style: TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
      ],
    );
  }
}
