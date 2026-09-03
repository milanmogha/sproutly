import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../../../core/network/admin_api.dart';
import '../../../core/services/document_download.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neu.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/cards.dart';

// ────────────────────────────────────────────────────────────────
// Admin Fees Screen — 4 tabs: Overview | Invoices | Structures | Generate
// ────────────────────────────────────────────────────────────────

class AdminFeesScreen extends StatefulWidget {
  const AdminFeesScreen({super.key});

  @override
  State<AdminFeesScreen> createState() => _AdminFeesScreenState();
}

class _FeesData {
  const _FeesData({
    required this.collected,
    required this.outstanding,
    required this.invoices,
    required this.structures,
    required this.classes,
  });
  final FeeCollectionSummary collected;
  final FeeOutstandingSummary outstanding;
  final List<InvoiceModel> invoices;
  final List<FeeStructureModel> structures;
  final List<SchoolClass> classes;
}

class _AdminFeesScreenState extends State<AdminFeesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 4, vsync: this);
  late Future<_FeesData> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = () async {
      final api = AdminApi.instance;
      final results = await Future.wait([
        api.collectionSummary(),
        api.outstandingSummary(),
        api.listInvoices(),
        api.listStructures(),
        api.listClasses(),
      ]);
      return _FeesData(
        collected: results[0] as FeeCollectionSummary,
        outstanding: results[1] as FeeOutstandingSummary,
        invoices: results[2] as List<InvoiceModel>,
        structures: results[3] as List<FeeStructureModel>,
        classes: results[4] as List<SchoolClass>,
      );
    }();
  }

  void _reload() => setState(_load);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  // ── Build ────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_FeesData>(
      future: _future,
      builder: (context, snap) {
        final loading =
            snap.connectionState == ConnectionState.waiting && !snap.hasData;
        final error = snap.hasError ? snap.error : null;

        return Scaffold(
          backgroundColor: Neu.bg,
          appBar: AppBar(
            automaticallyImplyLeading: false,
            backgroundColor: Neu.bg,
            elevation: 0,
            title: const Text('Fees'),
            bottom: TabBar(
              controller: _tabs,
              isScrollable: false,
              indicatorColor: AppColors.adminPrimary,
              labelColor: AppColors.adminPrimary,
              unselectedLabelColor: AppColors.textMuted,
              labelStyle: const TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 13),
              tabs: const [
                Tab(text: 'Overview'),
                Tab(text: 'Invoices'),
                Tab(text: 'Structures'),
                Tab(text: 'Generate'),
              ],
            ),
          ),
          body: loading
              ? const Center(child: CircularProgressIndicator())
              : error != null
                  ? _ErrorView(error: error, onRetry: _reload)
                  : TabBarView(
                      controller: _tabs,
                      children: [
                        _OverviewTab(data: snap.data!, onReload: _reload),
                        _InvoicesTab(
                          data: snap.data!,
                          onReload: _reload,
                        ),
                        _StructuresTab(
                          data: snap.data!,
                          onReload: _reload,
                        ),
                        _GenerateTab(
                          data: snap.data!,
                          onReload: _reload,
                        ),
                      ],
                    ),
        );
      },
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Tab 1: Overview
// ────────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.data, required this.onReload});
  final _FeesData data;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    final pending =
        data.invoices.where((i) => i.status == 'pending').length;
    final partial =
        data.invoices.where((i) => i.status == 'partial').length;
    final overdue =
        data.invoices.where((i) => i.status == 'overdue').length;
    final paid =
        data.invoices.where((i) => i.isPaid).length;

    return RefreshIndicator(
      onRefresh: () async => onReload(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          // ── Top stats ──────────────────────────────────
          Row(
            children: [
              Expanded(
                child: _SummaryCard(
                  icon: Iconsax.money_recive,
                  label: 'Total Collected',
                  value: Formatters.formatRupees(
                      data.collected.totalCollected),
                  accent: AppColors.success,
                  subtitle:
                      '${data.collected.paymentCount} payments',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(
                  icon: Iconsax.money_remove,
                  label: 'Outstanding',
                  value: Formatters.formatRupees(
                      data.outstanding.totalOutstanding),
                  accent: AppColors.danger,
                  subtitle:
                      '${data.outstanding.outstandingInvoices} invoices',
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── Status breakdown ───────────────────────────
          const Text('Invoice Status Breakdown',
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.textDark)),
          const SizedBox(height: 12),
          Row(
            children: [
              _StatusTile(
                  label: 'Pending', count: pending,
                  color: AppColors.warning),
              const SizedBox(width: 10),
              _StatusTile(
                  label: 'Partial', count: partial,
                  color: AppColors.info),
              const SizedBox(width: 10),
              _StatusTile(
                  label: 'Overdue', count: overdue,
                  color: AppColors.danger),
              const SizedBox(width: 10),
              _StatusTile(
                  label: 'Paid', count: paid,
                  color: AppColors.success),
            ],
          ),
          const SizedBox(height: 24),

          // ── Quick actions ──────────────────────────────
          const Text('Quick Actions',
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.textDark)),
          const SizedBox(height: 12),
          _QuickAction(
            icon: Iconsax.money_send,
            label: 'Record a payment',
            subtitle: 'Log cash, card, UPI or bank payments',
            onTap: () => _pickInvoiceToRecordPayment(context),
          ),
          const SizedBox(height: 8),
          _QuickAction(
            icon: Iconsax.add_square,
            label: 'Create fee structure',
            subtitle: 'Define fee components and amounts',
            onTap: () => _showStructureSheet(context, onReload: onReload),
          ),
          const SizedBox(height: 8),
          _QuickAction(
            icon: Iconsax.document_upload,
            label: 'Generate invoices in bulk',
            subtitle: 'Create invoices for an entire class at once',
            onTap: () =>
                _showGenerateSheet(context, data, onReload: onReload),
          ),

          // ── Fee structures summary ─────────────────────
          const SizedBox(height: 24),
          const Text('Fee Structures',
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.textDark)),
          const SizedBox(height: 12),
          if (data.structures.isEmpty)
            const Text('No fee structures defined yet.',
                style: TextStyle(color: AppColors.textMuted))
          else
            ...data.structures.map(
              (s) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment:
                              CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(s.name,
                                style: const TextStyle(
                                    fontWeight:
                                        FontWeight.w700)),
                            Text(
                              '${s.frequencyLabel} · ${Formatters.formatRupees(s.totalAmount)}${s.academicYear.isEmpty ? '' : ' · ${s.academicYear}'}',
                              style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(
                        label: s.isActive ? 'Active' : 'Inactive',
                        type: s.isActive
                            ? ChipType.success
                            : ChipType.neutral,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _pickInvoiceToRecordPayment(BuildContext context) {
    // Scheduled installments haven't been billed to anyone yet, so they must
    // not be payable — the backend rejects it, and offering it is misleading.
    final unpaid = data.invoices
        .where((i) => !i.isPaid && !i.isScheduled)
        .toList();
    if (unpaid.isEmpty) {
      AppToast.show(context, 'All invoices are already paid.',
          type: ToastType.info);
      return;
    }
    showAppBottomSheet(
      context: context,
      scrollable: true,
      child: _PaymentPickerSheet(
        invoices: unpaid,
        onPaid: onReload,
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Tab 2: Invoices
// ────────────────────────────────────────────────────────────────

class _InvoicesTab extends StatefulWidget {
  const _InvoicesTab({required this.data, required this.onReload});
  final _FeesData data;
  final VoidCallback onReload;

  @override
  State<_InvoicesTab> createState() => _InvoicesTabState();
}

class _InvoicesTabState extends State<_InvoicesTab> {
  String? _statusFilter; // null = all
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<InvoiceModel> get _filtered {
    final query = _searchCtrl.text.trim().toLowerCase();
    return widget.data.invoices.where((i) {
      if (_statusFilter != null && i.status != _statusFilter) return false;
      if (query.isEmpty) return true;
      final haystack = [
        i.studentName,
        i.admissionNumber,
        i.className,
        i.invoiceNumber,
      ].whereType<String>().join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = _filtered;
    return Column(
      children: [
        // ── Search by child ──────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: NeuInset(
            radius: 24,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: SizedBox(
              height: 48,
              child: Row(
                children: [
                  const Icon(Iconsax.search_normal,
                      size: 20, color: AppColors.textMuted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        hintText: 'Search child, class or invoice no.',
                        border: InputBorder.none,
                        isDense: true,
                      ),
                    ),
                  ),
                  if (_searchCtrl.text.isNotEmpty)
                    GestureDetector(
                      onTap: () => setState(() => _searchCtrl.clear()),
                      child: const Icon(Icons.close,
                          size: 18, color: AppColors.textMuted),
                    ),
                ],
              ),
            ),
          ),
        ),

        // ── Filter chips ─────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _FilterChip(
                  label: 'All',
                  active: _statusFilter == null,
                  onTap: () => setState(() => _statusFilter = null),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Pending',
                  active: _statusFilter == 'pending',
                  color: AppColors.warning,
                  onTap: () =>
                      setState(() => _statusFilter = 'pending'),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Partial',
                  active: _statusFilter == 'partial',
                  color: AppColors.info,
                  onTap: () =>
                      setState(() => _statusFilter = 'partial'),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Paid',
                  active: _statusFilter == 'paid',
                  color: AppColors.success,
                  onTap: () =>
                      setState(() => _statusFilter = 'paid'),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Overdue',
                  active: _statusFilter == 'overdue',
                  color: AppColors.danger,
                  onTap: () =>
                      setState(() => _statusFilter = 'overdue'),
                ),
                const SizedBox(width: 8),
                // The rest of the session, billed in advance but not yet owed.
                _FilterChip(
                  label: 'Upcoming',
                  active: _statusFilter == 'scheduled',
                  onTap: () =>
                      setState(() => _statusFilter = 'scheduled'),
                ),
              ],
            ),
          ),
        ),

        // ── Total row ────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Text(
                '${list.length} invoice${list.length == 1 ? '' : 's'}',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 12),
              ),
              const Spacer(),
              if (_statusFilter != null)
                GestureDetector(
                  onTap: () =>
                      setState(() => _statusFilter = null),
                  child: const Text('Clear filter',
                      style: TextStyle(
                          color: AppColors.adminPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                ),
            ],
          ),
        ),

        // ── List ─────────────────────────────────────────
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async => widget.onReload(),
            child: list.isEmpty
                ? ListView(children: const [
                    SizedBox(height: 80),
                    EmptyState(
                        emoji: '🧾',
                        title: 'No invoices',
                        subtitle:
                            'Generate invoices from the Structures tab.'),
                  ])
                : ListView.builder(
                    physics:
                        const AlwaysScrollableScrollPhysics(
                            parent:
                                BouncingScrollPhysics()),
                    padding:
                        const EdgeInsets.fromLTRB(16, 0, 16, 100),
                    itemCount: list.length,
                    itemBuilder: (_, i) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _InvoiceCard(
                        inv: list[i],
                        onTap: () =>
                            _showInvoiceDetailSheet(
                                context, list[i],
                                onReload: widget.onReload),
                      ),
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Tab 3: Fee Structures
// ────────────────────────────────────────────────────────────────

class _StructuresTab extends StatelessWidget {
  const _StructuresTab({required this.data, required this.onReload});
  final _FeesData data;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: () async => onReload(),
        child: data.structures.isEmpty
            ? ListView(children: const [
                SizedBox(height: 120),
                EmptyState(
                    emoji: '📋',
                    title: 'No fee structures',
                    subtitle:
                        'Tap + to create your first fee structure.'),
              ])
            : ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                itemCount: data.structures.length,
                itemBuilder: (_, i) {
                  final s = data.structures[i];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AppCard(
                      onTap: () => _showStructureSheet(context,
                          structure: s, onReload: onReload),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(s.name,
                                    style: const TextStyle(
                                        fontWeight:
                                            FontWeight.w700)),
                              ),
                              StatusChip(
                                label: s.isActive
                                    ? 'Active'
                                    : 'Inactive',
                                type: s.isActive
                                    ? ChipType.success
                                    : ChipType.neutral,
                              ),
                              const SizedBox(width: 8),
                              _deleteStructureButton(
                                  context, s.id, onReload),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${s.frequencyLabel} · ${Formatters.formatRupees(s.totalAmount)}${s.academicYear.isEmpty ? '' : ' · ${s.academicYear}'}',
                            style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12),
                          ),
                          if (s.className != null) ...[
                            const SizedBox(height: 2),
                            Text('Class: ${s.className}',
                                style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12)),
                          ],
                          if (s.components.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            const Divider(height: 1),
                            const SizedBox(height: 8),
                            for (final c in s.components)
                              Padding(
                                padding:
                                    const EdgeInsets.only(
                                        bottom: 4),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(c.name,
                                          style:
                                              const TextStyle(
                                                  fontSize:
                                                      13)),
                                    ),
                                    Text(
                                        Formatters
                                            .formatRupees(
                                                c.amount),
                                        style: const TextStyle(
                                            fontFamily:
                                                'monospace',
                                            fontSize: 13,
                                            fontWeight:
                                                FontWeight
                                                    .w600)),
                                  ],
                                ),
                              ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
      // Lifted clear of the floating bottom nav that the parent shell overlays
      // on this tab (the shell uses extendBody, so the nav sits over the body).
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 104),
        child: FloatingActionButton.extended(
          heroTag: 'addfeestructure',
          backgroundColor: AppColors.adminPrimary,
          icon: const Icon(Icons.add, color: Colors.white),
          label: const Text('New Structure',
              style: TextStyle(color: Colors.white)),
          onPressed: () =>
              _showStructureSheet(context, onReload: onReload),
        ),
      ),
    );
  }

  Widget _deleteStructureButton(
      BuildContext context, String id, VoidCallback onReload) {
    return GestureDetector(
      onTap: () => _confirmDelete(context, id, onReload),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: AppColors.danger.withAlpha(25),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Icon(Iconsax.trash, size: 16,
            color: AppColors.danger),
      ),
    );
  }

  void _confirmDelete(
      BuildContext context, String id, VoidCallback onReload) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete structure?'),
        content: const Text(
            'This will not delete invoices already generated from it.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await AdminApi.instance.deleteStructure(id);
                onReload();
              } catch (e) {
                if (context.mounted) {
                  AppToast.show(context, 'Failed: $e',
                      type: ToastType.error);
                }
              }
            },
            child: const Text('Delete',
                style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Tab 4: Generate Invoices
// ────────────────────────────────────────────────────────────────

class _GenerateTab extends StatelessWidget {
  const _GenerateTab({required this.data, required this.onReload});
  final _FeesData data;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        const Text('Bulk Invoice Generation',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 18,
                color: AppColors.textDark)),
        const SizedBox(height: 4),
        const Text(
          'Generate invoices for all students in a class from a fee structure.',
          style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
        const SizedBox(height: 24),

        // Recent generations (just show existing structures as prompts)
        if (data.structures.isNotEmpty) ...[
          const Text('Quick Generate',
              style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: AppColors.textDark)),
          const SizedBox(height: 10),
          for (final s in data.structures.where((s) => s.isActive))
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                onTap: () => _showGenerateSheet(context, data,
                    preselectedStructure: s, onReload: onReload),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.adminPrimary
                            .withAlpha(25),
                        borderRadius:
                            BorderRadius.circular(12),
                      ),
                      child: const Icon(
                          Iconsax.document_upload,
                          color: AppColors.adminPrimary,
                          size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment:
                            CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(s.name,
                              style: const TextStyle(
                                  fontWeight:
                                      FontWeight.w700)),
                          Text(
                            '${s.frequencyLabel} · ${s.installmentsPerSession}'
                            ' × ${Formatters.formatRupees(s.totalAmount)}',
                            style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right,
                        color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
        ] else
          const EmptyState(
              emoji: '📋',
              title: 'No fee structures',
              subtitle:
                  'Create a fee structure in the Structures tab first.'),
      ],
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Shared Widgets
// ────────────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('⚠️', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 12),
            const Text('Could not load fees',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark)),
            const SizedBox(height: 4),
            Text('$error',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 12)),
            const SizedBox(height: 16),
            PrimaryButton(
                label: 'Retry',
                color: AppColors.adminPrimary,
                onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
    this.subtitle,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color accent;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: accent.withAlpha(25),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: accent, size: 18),
              ),
              const Spacer(),
              Text(value,
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                      fontFamily: 'monospace',
                      color: accent)),
            ],
          ),
          const SizedBox(height: 8),
          Text(label,
              style: const TextStyle(
                  color: AppColors.textMuted, fontSize: 12)),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(subtitle!,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 11)),
          ],
        ],
      ),
    );
  }
}

class _StatusTile extends StatelessWidget {
  const _StatusTile({
    required this.label,
    required this.count,
    required this.color,
  });
  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: AppCard(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('$count',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 22,
                    color: color)),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    this.color,
    required this.onTap,
  });
  final String label;
  final bool active;
  final Color? color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return NeuChip(
      label: label,
      selected: active,
      onTap: onTap,
      accent: color ?? AppColors.adminPrimary,
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.adminPrimary.withAlpha(18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.adminPrimary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark)),
                Text(subtitle,
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.inv, required this.onTap});
  final InvoiceModel inv;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (chipLabel, chipType) = switch (inv.status) {
      'paid' => ('Paid', ChipType.success),
      'partial' => ('Partial', ChipType.info),
      'overdue' => ('Overdue', ChipType.danger),
      // A future month of a session billed in advance — not owed yet.
      'scheduled' => ('Scheduled', ChipType.neutral),
      _ => ('Pending', ChipType.warning),
    };
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  inv.studentName ?? inv.invoiceNumber,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (inv.className != null) inv.className!,
                    inv.period,
                    if (inv.dueDate != null)
                      'Due ${Formatters.formatShortDate(inv.dueDate!)}',
                  ].join(' · '),
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
                    inv.isPaid ? inv.totalAmount : inv.balance),
                style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              StatusChip(label: chipLabel, type: chipType),
            ],
          ),
        ],
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Bottom Sheets
// ────────────────────────────────────────────────────────────────

/// Invoice detail sheet — full breakdown + record-payment button.
void _showInvoiceDetailSheet(BuildContext context, InvoiceModel inv,
    {required VoidCallback onReload}) {
  showAppBottomSheet(
    context: context,
    scrollable: true,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(inv.studentName ?? inv.invoiceNumber,
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 4),
          Text(
            [
              if (inv.className != null) inv.className!,
              if (inv.admissionNumber != null) inv.admissionNumber!,
              inv.invoiceNumber,
            ].join(' · '),
            style: const TextStyle(
                color: AppColors.textMuted, fontSize: 12)),
          const SizedBox(height: 2),
          Text(
            '${inv.period} · Total ${Formatters.formatRupees(inv.totalAmount)}',
            style: const TextStyle(color: AppColors.textMuted)),
          if (inv.dueDate != null) ...[
            const SizedBox(height: 2),
            Text('Due ${Formatters.formatShortDate(inv.dueDate!)}',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          // Line items
          if (inv.lineItems.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.adminTint,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  for (final line in inv.lineItems) ...[
                    Row(
                      children: [
                        Text(line.name,
                            style: const TextStyle(
                                color: AppColors.textMuted)),
                        const Spacer(),
                        Text(
                            Formatters.formatRupees(
                                line.amount),
                            style: const TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 14)),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],
                  const Divider(
                      height: 12, color: AppColors.mutedGray),
                  Row(
                    children: [
                      const Text('Total',
                          style: TextStyle(
                              fontWeight: FontWeight.w700)),
                      const Spacer(),
                      Text(
                          Formatters.formatRupees(
                              inv.totalAmount),
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
                          style: TextStyle(
                              color: AppColors.textMuted)),
                      const Spacer(),
                      Text(
                          Formatters.formatRupees(
                              inv.amountPaid),
                          style: const TextStyle(
                              fontFamily: 'monospace',
                              color: AppColors.success)),
                    ],
                  ),
                  if (!inv.isPaid) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Text('Balance',
                            style: TextStyle(
                                color:
                                    AppColors.textMuted)),
                        const Spacer(),
                        Text(
                            Formatters.formatRupees(
                                inv.balance),
                            style: const TextStyle(
                                fontFamily: 'monospace',
                                fontWeight:
                                    FontWeight.w700,
                                color: AppColors.danger)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 16),
          if (inv.isPaid)
            const Text('Invoice fully settled.',
                style: TextStyle(color: AppColors.success))
          else if (inv.isScheduled)
            const Text(
              'Not billed yet — this reaches the parent on its own month, '
              'and can be paid from then.',
              style: TextStyle(color: AppColors.textMuted),
            )
          else
            Builder(builder: (ctx) {
              return _RecordPaymentButton(
                inv: inv,
                onRecorded: () {
                  Navigator.pop(ctx);
                  onReload();
                },
              );
            }),
          // Not offered for a scheduled invoice: it hasn't been billed, so
          // there is nothing to hand a parent yet.
          if (!inv.isScheduled) ...[
            const SizedBox(height: 8),
            _DownloadInvoiceButton(inv: inv),
          ],
        ],
      ),
    ),
  );
}

/// Downloads the printable fee document for one invoice and opens it.
class _DownloadInvoiceButton extends StatefulWidget {
  const _DownloadInvoiceButton({required this.inv});
  final InvoiceModel inv;

  @override
  State<_DownloadInvoiceButton> createState() => _DownloadInvoiceButtonState();
}

class _DownloadInvoiceButtonState extends State<_DownloadInvoiceButton> {
  bool _busy = false;

  Future<void> _download() async {
    setState(() => _busy = true);
    final outcome = await DocumentDownload.open(
      path: '/fees/invoices/${widget.inv.id}/receipt.pdf',
      fallbackName: '${widget.inv.invoiceNumber}.pdf',
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
          : (widget.inv.isPaid ? 'Download receipt' : 'Download invoice'),
      icon: Iconsax.document_download,
      color: AppColors.adminPrimary,
      onPressed: _busy ? null : _download,
    );
  }
}

/// Simple pick-list to select an unpaid invoice for payment.
class _PaymentPickerSheet extends StatelessWidget {
  const _PaymentPickerSheet(
      {required this.invoices, required this.onPaid});
  final List<InvoiceModel> invoices;
  final VoidCallback onPaid;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Select an invoice to record payment',
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.textDark)),
          const SizedBox(height: 12),
          for (final inv in invoices)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                onTap: () {
                  Navigator.pop(context);
                  _showInvoiceDetailSheet(context, inv,
                      onReload: onPaid);
                },
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment:
                            CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(inv.invoiceNumber,
                              style: const TextStyle(
                                  fontWeight:
                                      FontWeight.w700)),
                          Text(
                            '${inv.period} · Balance ${Formatters.formatRupees(inv.balance)}',
                            style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right,
                        color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Full payment-recording form with amount + method.
class _RecordPaymentButton extends StatefulWidget {
  const _RecordPaymentButton(
      {required this.inv, required this.onRecorded});
  final InvoiceModel inv;
  final VoidCallback onRecorded;

  @override
  State<_RecordPaymentButton> createState() =>
      _RecordPaymentButtonState();
}

class _RecordPaymentButtonState extends State<_RecordPaymentButton> {
  bool _showForm = false;
  final _amountCtrl = TextEditingController();
  String _method = 'cash';
  final _noteCtrl = TextEditingController();
  bool _loading = false;

  static const _methods = [
    ('cash', 'Cash', Iconsax.money),
    ('card', 'Card', Iconsax.card),
    ('upi', 'UPI', Iconsax.mobile),
    ('bank_transfer', 'Bank Transfer', Iconsax.bank),
    ('cheque', 'Cheque', Iconsax.book),
  ];

  @override
  void initState() {
    super.initState();
    _amountCtrl.text = widget.inv.balance.toStringAsFixed(0);
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_showForm) {
      return PrimaryButton(
        label:
            'Record Payment (${Formatters.formatRupees(widget.inv.balance)})',
        color: AppColors.success,
        fullWidth: true,
        onPressed: () => setState(() => _showForm = true),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Payment Details',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.textDark)),
        const SizedBox(height: 12),

        // Amount
        Row(
          children: [
            const Text('Amount:', style: TextStyle(fontSize: 14)),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _amountCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(
                        decimal: true),
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(10),
                  ),
                  hintText: '0',
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            GestureDetector(
              onTap: () {
                _amountCtrl.text = widget.inv.balance
                    .toStringAsFixed(0);
              },
              child: Text('Full balance',
                  style: TextStyle(
                      color: AppColors.adminPrimary,
                      fontSize: 11)),
            ),
            const Spacer(),
            Text(
                'Balance: ${Formatters.formatRupees(widget.inv.balance)}',
                style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11)),
          ],
        ),
        const SizedBox(height: 16),

        // Method
        const Text('Method:',
            style: TextStyle(fontSize: 14)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: _methods
              .map((m) => GestureDetector(
                    onTap: () =>
                        setState(() => _method = m.$1),
                    child: Container(
                      padding:
                          const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8),
                      decoration: BoxDecoration(
                        color: _method == m.$1
                            ? AppColors.adminPrimary
                            : AppColors.adminPrimary
                                .withAlpha(18),
                        borderRadius:
                            BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(m.$3,
                              size: 14,
                              color: _method == m.$1
                                  ? Colors.white
                                  : AppColors
                                      .adminPrimary),
                          const SizedBox(width: 6),
                          Text(m.$2,
                              style: TextStyle(
                                  color: _method == m.$1
                                      ? Colors.white
                                      : AppColors
                                          .adminPrimary,
                                  fontSize: 12,
                                  fontWeight:
                                      FontWeight.w600)),
                        ],
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 14),

        // Note
        TextField(
          controller: _noteCtrl,
          decoration: InputDecoration(
            hintText: 'Note (optional)',
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Actions
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _loading
                    ? null
                    : () => setState(() => _showForm = false),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: PrimaryButton(
                label: _loading ? 'Recording…' : 'Record Payment',
                color: AppColors.success,
                fullWidth: true,
                onPressed: _loading ? null : () => _record(),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _record() async {
    final amount = double.tryParse(_amountCtrl.text.trim());
    if (amount == null || amount <= 0) {
      AppToast.show(context, 'Enter a valid amount',
          type: ToastType.error);
      return;
    }
    if (amount > widget.inv.balance) {
      AppToast.show(context,
          'Amount exceeds balance (${Formatters.formatRupees(widget.inv.balance)})',
          type: ToastType.error);
      return;
    }
    setState(() => _loading = true);
    try {
      await AdminApi.instance.recordPayment(
        invoiceId: widget.inv.id,
        amount: amount,
        method: _method,
        note:
            _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
      );
      if (!mounted) return;
      AppToast.show(context, 'Payment recorded — receipt issued',
          type: ToastType.success);
      widget.onRecorded();
    } catch (e) {
      if (mounted) {
        AppToast.show(context, 'Failed: $e',
            type: ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Fee Structure Create / Edit Sheet
// ────────────────────────────────────────────────────────────────

void _showStructureSheet(BuildContext context,
    {FeeStructureModel? structure, required VoidCallback onReload}) {
  showAppBottomSheet(
    context: context,
    isDismissible: true,
    scrollable: true,
    child: _StructureForm(
      structure: structure,
      onSaved: onReload,
    ),
  );
}

class _StructureForm extends StatefulWidget {
  const _StructureForm({this.structure, required this.onSaved});
  final FeeStructureModel? structure;
  final VoidCallback onSaved;

  @override
  State<_StructureForm> createState() => _StructureFormState();
}

class _StructureFormState extends State<_StructureForm> {
  final _nameCtrl = TextEditingController();
  final _yearCtrl = TextEditingController();
  String _frequency = 'monthly';
  final _dueDayCtrl = TextEditingController();
  final List<_ComponentEntry> _components = [];
  bool _saving = false;

  bool get _isEdit => widget.structure != null;

  static const _frequencies = [
    ('monthly', 'Monthly'),
    ('quarterly', 'Quarterly'),
    ('term', 'Term'),
    ('annual', 'Annual'),
  ];

  /// Plain-words summary of what the chosen frequency will bill, so the admin
  /// knows the amounts entered below are charged per installment.
  String get _frequencyHint => switch (_frequency) {
        'monthly' => '12 invoices per session (Apr–Mar), one every month.',
        'quarterly' => '4 invoices per session: Apr, Jul, Oct and Jan.',
        'term' => '2 invoices per session: Term 1 (Apr) and Term 2 (Oct).',
        _ => '1 invoice for the whole session, due in April.',
      };

  @override
  void initState() {
    super.initState();
    if (widget.structure != null) {
      final s = widget.structure!;
      _nameCtrl.text = s.name;
      _yearCtrl.text = s.academicYear;
      _frequency = s.frequency;
      if (s.dueDayOfMonth != null) {
        _dueDayCtrl.text = s.dueDayOfMonth.toString();
      }
      for (final c in s.components) {
        _components.add(_ComponentEntry(
          nameCtrl: TextEditingController(text: c.name),
          amountCtrl:
              TextEditingController(text: c.amount.toStringAsFixed(0)),
        ));
      }
    } else {
      // Academic year runs April–March, so before April we are still in the
      // year that started last calendar year.
      final now = DateTime.now();
      final start = now.month >= 4 ? now.year : now.year - 1;
      _yearCtrl.text = '$start-${start + 1}';
    }
    if (_components.isEmpty) {
      _addComponent();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _yearCtrl.dispose();
    _dueDayCtrl.dispose();
    for (final c in _components) {
      c.nameCtrl.dispose();
      c.amountCtrl.dispose();
    }
    super.dispose();
  }

  void _addComponent() {
    setState(() {
      _components.add(_ComponentEntry(
        nameCtrl: TextEditingController(),
        amountCtrl: TextEditingController(),
      ));
    });
  }

  void _removeComponent(int i) {
    if (_components.length <= 1) return;
    setState(() {
      _components[i].nameCtrl.dispose();
      _components[i].amountCtrl.dispose();
      _components.removeAt(i);
    });
  }

  @override
  Widget build(BuildContext context) {
    final total = _components.fold<double>(
      0,
      (s, c) => s + (double.tryParse(c.amountCtrl.text) ?? 0),
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_isEdit ? 'Edit Fee Structure' : 'New Fee Structure',
              style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                  color: AppColors.textDark)),
          const SizedBox(height: 16),

          // Name
          _field('Name', _nameCtrl, hint: 'e.g. Nursery Fees 2026'),
          const SizedBox(height: 12),

          // Academic Year
          _field('Academic Year', _yearCtrl,
              hint: 'e.g. 2026-2027 (optional)'),
          const SizedBox(height: 12),

          // Frequency
          const Text('Frequency',
              style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _frequencies
                .map((f) => GestureDetector(
                      onTap: () =>
                          setState(() => _frequency = f.$1),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: _frequency == f.$1
                              ? AppColors.adminPrimary
                              : AppColors.adminPrimary
                                  .withAlpha(18),
                          borderRadius:
                              BorderRadius.circular(10),
                        ),
                        child: Text(f.$2,
                            style: TextStyle(
                                color: _frequency == f.$1
                                    ? Colors.white
                                    : AppColors.adminPrimary,
                                fontWeight: FontWeight.w600,
                                fontSize: 12)),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 6),
          Text(_frequencyHint,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textMuted)),
          const SizedBox(height: 12),

          // Due day — applies to every frequency: each invoice falls due on
          // this day of its start month (Apr/Jul/Oct/Jan for quarterly, etc.).
          _field('Due day of month', _dueDayCtrl,
              hint: 'e.g. 10 — day each invoice falls due (optional)',
              keyboardType: TextInputType.number),
          const SizedBox(height: 4),
          const Text(
            'Each invoice is due on this day of its start month. '
            'Defaults to the 10th.',
            style: TextStyle(fontSize: 11, color: AppColors.textMuted),
          ),
          const SizedBox(height: 16),

          // Components
          Row(
            children: [
              const Text('Fee Components',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600)),
              const Spacer(),
              Text(Formatters.formatRupees(total),
                  style: const TextStyle(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w700,
                      color: AppColors.adminPrimary)),
            ],
          ),
          const SizedBox(height: 8),
          for (var i = 0; i < _components.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextField(
                      controller: _components[i].nameCtrl,
                      decoration: InputDecoration(
                        hintText: 'Component name',
                        isDense: true,
                        contentPadding:
                            const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller:
                          _components[i].amountCtrl,
                      keyboardType:
                          const TextInputType.numberWithOptions(
                              decimal: true),
                      decoration: InputDecoration(
                        prefixText: '₹ ',
                        hintText: 'Amount',
                        isDense: true,
                        contentPadding:
                            const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  GestureDetector(
                    onTap: () => _removeComponent(i),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.danger
                            .withAlpha(20),
                        borderRadius:
                            BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.close,
                          size: 16,
                          color: AppColors.danger),
                    ),
                  ),
                ],
              ),
            ),
          GestureDetector(
            onTap: _addComponent,
            child: Row(
              children: [
                Icon(Icons.add,
                    size: 16, color: AppColors.adminPrimary),
                const SizedBox(width: 4),
                const Text('Add component',
                    style: TextStyle(
                        color: AppColors.adminPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Save
          PrimaryButton(
            label: _saving
                ? 'Saving…'
                : _isEdit
                    ? 'Update Structure'
                    : 'Create Structure',
            color: AppColors.adminPrimary,
            fullWidth: true,
            onPressed: _saving ? null : () => _save(),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {String? hint, TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            hintText: hint,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      AppToast.show(context, 'Enter a name.',
          type: ToastType.error);
      return;
    }
    final year = _yearCtrl.text.trim();
    if (!RegExp(r'^\d{4}-\d{4}$').hasMatch(year)) {
      AppToast.show(context,
          'Academic year must look like 2026-2027.',
          type: ToastType.error);
      return;
    }
    final components = [
      for (final c in _components)
        if (c.nameCtrl.text.trim().isNotEmpty &&
            (double.tryParse(c.amountCtrl.text) ?? 0) > 0)
          (
            name: c.nameCtrl.text.trim(),
            amount: double.parse(c.amountCtrl.text),
          ),
    ];
    if (components.isEmpty) {
      AppToast.show(context,
          'Add at least one component with a name and amount.',
          type: ToastType.error);
      return;
    }
    final dueDay = int.tryParse(_dueDayCtrl.text.trim());

    setState(() => _saving = true);
    try {
      await AdminApi.instance.saveStructure(
        id: _isEdit ? widget.structure!.id : null,
        name: name,
        academicYear: year,
        frequency: _frequency,
        components: components,
        dueDayOfMonth: dueDay,
      );
      if (!mounted) return;
      AppToast.show(context,
          _isEdit ? 'Structure updated.' : 'Structure created.',
          type: ToastType.success);
      widget.onSaved();
      Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        AppToast.show(context, 'Failed: $e',
            type: ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _ComponentEntry {
  _ComponentEntry({required this.nameCtrl, required this.amountCtrl});
  final TextEditingController nameCtrl;
  final TextEditingController amountCtrl;
}

// ────────────────────────────────────────────────────────────────
// Generate Invoices Sheet
// ────────────────────────────────────────────────────────────────

void _showGenerateSheet(BuildContext context, _FeesData data,
    {FeeStructureModel? preselectedStructure,
    required VoidCallback onReload}) {
  showAppBottomSheet(
    context: context,
    isDismissible: true,
    scrollable: true,
    child: _GenerateForm(
      data: data,
      preselectedStructure: preselectedStructure,
      onGenerated: onReload,
    ),
  );
}

class _GenerateForm extends StatefulWidget {
  const _GenerateForm({
    required this.data,
    this.preselectedStructure,
    required this.onGenerated,
  });
  final _FeesData data;
  final FeeStructureModel? preselectedStructure;
  final VoidCallback onGenerated;

  @override
  State<_GenerateForm> createState() => _GenerateFormState();
}

class _GenerateFormState extends State<_GenerateForm> {
  FeeStructureModel? _selectedStructure;
  SchoolClass? _selectedClass;
  bool _generating = false;
  int? _generatedCount;

  /// Plain-words preview of what the backend will create for the selected
  /// structure: how many invoices per student, and when they fall due.
  String? get _schedulePreview {
    final s = _selectedStructure;
    if (s == null) return null;
    final day = s.dueDayOfMonth ?? 10;
    final amount = Formatters.formatRupees(s.totalAmount);
    return switch (s.frequency) {
      'monthly' =>
        '12 invoices per student — $amount due on day $day of every '
            'month, April to March.',
      'quarterly' =>
        '4 invoices per student — $amount due on day $day of April, '
            'July, October and January.',
      'term' =>
        '2 invoices per student — $amount due on day $day of April '
            '(Term 1) and October (Term 2).',
      _ =>
        '1 invoice per student — $amount for the whole session, due on '
            'day $day of April. Parents are notified right away.',
    };
  }

  @override
  void initState() {
    super.initState();
    _selectedStructure = widget.preselectedStructure;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Generate Invoices',
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                  color: AppColors.textDark)),
          const SizedBox(height: 4),
          const Text(
            'All students in the selected class will get an invoice.',
            style:
                TextStyle(color: AppColors.textMuted, fontSize: 13)),
          const SizedBox(height: 20),

          // Structure picker
          const Text('Fee Structure',
              style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          ...widget.data.structures
              .where((s) => s.isActive)
              .map((s) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: GestureDetector(
                      onTap: () =>
                          setState(() => _selectedStructure = s),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: _selectedStructure?.id == s.id
                                ? AppColors.adminPrimary
                                : AppColors.mutedGray,
                            width:
                                _selectedStructure?.id == s.id
                                    ? 2
                                    : 1,
                          ),
                          borderRadius:
                              BorderRadius.circular(12),
                          color:
                              _selectedStructure?.id == s.id
                                  ? AppColors.adminPrimary
                                      .withAlpha(15)
                                  : null,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment
                                        .start,
                                mainAxisSize:
                                    MainAxisSize.min,
                                children: [
                                  Text(s.name,
                                      style: const TextStyle(
                                          fontWeight:
                                              FontWeight
                                                  .w600)),
                                  Text(
                                    '${s.frequencyLabel} · ${Formatters.formatRupees(s.totalAmount)}',
                                    style: const TextStyle(
                                        color: AppColors
                                            .textMuted,
                                        fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            if (_selectedStructure?.id ==
                                s.id)
                              const Icon(
                                  Icons.check_circle,
                                  color: AppColors
                                      .adminPrimary,
                                  size: 22),
                          ],
                        ),
                      ),
                    ),
                  )),
          if (widget.data.structures
              .where((s) => s.isActive)
              .isEmpty)
            const Text('No active fee structures.',
                style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12)),
          const SizedBox(height: 16),

          // Class picker
          const Text('Target Class',
              style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          if (widget.data.classes.isEmpty)
            const Text('No classes available.',
                style: TextStyle(
                    color: AppColors.textMuted, fontSize: 12))
          else
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: widget.data.classes
                  .map((c) => GestureDetector(
                        onTap: () =>
                            setState(() => _selectedClass = c),
                        child: Container(
                          padding:
                              const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 8),
                          decoration: BoxDecoration(
                            color:
                                _selectedClass?.id == c.id
                                    ? AppColors.adminPrimary
                                    : AppColors.adminPrimary
                                        .withAlpha(18),
                            borderRadius:
                                BorderRadius.circular(10),
                          ),
                          child: Text(c.displayName,
                              style: TextStyle(
                                  color:
                                      _selectedClass?.id ==
                                              c.id
                                          ? Colors.white
                                          : AppColors
                                              .adminPrimary,
                                  fontWeight:
                                      FontWeight.w600,
                                  fontSize: 12)),
                        ),
                      ))
                  .toList(),
            ),
          const SizedBox(height: 16),

          // Billing schedule preview — periods and due dates are computed by
          // the backend from the structure's frequency and due-day.
          if (_schedulePreview != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.adminPrimary.withAlpha(12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Iconsax.calendar,
                      size: 18, color: AppColors.adminPrimary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${_selectedStructure!.academicYear} session: '
                      '$_schedulePreview',
                      style: const TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: AppColors.textDark),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Result
          if (_generatedCount != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                '✅ $_generatedCount invoice(s) generated.',
                style: const TextStyle(color: AppColors.success),
              ),
            ),

          // Generate button
          PrimaryButton(
            label: _generating
                ? 'Generating…'
                : 'Generate Invoices',
            color: AppColors.adminPrimary,
            fullWidth: true,
            onPressed: _canGenerate && !_generating
                ? () => _generate()
                : null,
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  bool get _canGenerate =>
      _selectedStructure != null && _selectedClass != null;

  Future<void> _generate() async {
    setState(() => _generating = true);
    try {
      final res = await AdminApi.instance.generateInvoices(
        feeStructureId: _selectedStructure!.id,
        classId: _selectedClass!.id,
      );
      if (!mounted) return;
      setState(() => _generatedCount = res.created);
      widget.onGenerated();
      if (res.created == 0) {
        AppToast.show(context,
            'Nothing new — this class already has all '
            '${res.installments} installment(s) for the session.',
            type: ToastType.info);
      } else {
        AppToast.show(
            context,
            '${res.created} invoice(s) created across '
            '${res.installments} installment(s)'
            '${res.skipped > 0 ? ', ${res.skipped} already existed' : ''}.',
            type: ToastType.success);
      }
    } catch (e) {
      if (mounted) {
        AppToast.show(context, 'Failed: $e',
            type: ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }
}
