import 'package:flutter/material.dart';

import '../../../core/network/admin_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';

/// The admin's PTM queue.
///
/// A teacher raises a meeting request; the admin schedules it (picking the
/// date) or declines it. Either way the parent is notified of the outcome —
/// the parent never accepts or requests a meeting themselves.
class AdminPtmScreen extends StatefulWidget {
  const AdminPtmScreen({super.key});

  @override
  State<AdminPtmScreen> createState() => _AdminPtmScreenState();
}

class _AdminPtmScreenState extends State<AdminPtmScreen> {
  late Future<List<PtmModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.listPtmRequests();
  }

  void _reload() {
    if (!mounted) return;
    // Braces, not an arrow: `() => _future = ...` *returns* the Future, and
    // setState rejects a callback that returns one.
    setState(() {
      _future = AdminApi.instance.listPtmRequests();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('PTM'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newClassMeeting,
        backgroundColor: AppColors.adminPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.event_available_rounded),
        label: const Text('New meeting'),
      ),
      body: FutureBuilder<List<PtmModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snap.data ?? const <PtmModel>[];
          if (items.isEmpty) {
            return const EmptyState(
              emoji: '📅',
              title: 'No meetings yet',
              subtitle:
                  'A teacher’s request lands here for you to schedule or '
                  'decline — or tap New meeting to call one for whole classes.',
            );
          }
          // Pending ones first — they're the only rows that need an action.
          final pending = items.where((p) => p.status == 'requested').toList();
          final rest = items.where((p) => p.status != 'requested').toList();

          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: [
                if (pending.isNotEmpty) ...[
                  const _SectionLabel('Awaiting your decision'),
                  for (final p in pending)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _PtmCard(
                        ptm: p,
                        onSchedule: () => _schedule(p),
                        onDecline: () => _respond(p, 'declined'),
                        onComplete: null,
                      ),
                    ),
                ],
                if (rest.isNotEmpty) ...[
                  const _SectionLabel('Decided'),
                  for (final p in rest)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _PtmCard(
                        ptm: p,
                        onSchedule: null,
                        onDecline: null,
                        // A meeting can only be closed off once it has actually
                        // happened — not before the day it's booked for. The
                        // backend enforces this too.
                        onComplete: p.canBeCompleted
                            ? () => _respond(p, 'completed')
                            : null,
                      ),
                    ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  /// The admin calls a meeting for whole classes — "PTM for 1A and 2A on
  /// Friday". Every student in those classes gets their own meeting and every
  /// parent is notified.
  Future<void> _newClassMeeting() async {
    final result = await showAppBottomSheet<({int created, int skipped})>(
      context: context,
      child: const _ClassMeetingSheet(),
    );
    if (result == null || !mounted) return;

    AppToast.show(
      context,
      result.skipped == 0
          ? 'Meeting scheduled for ${result.created} '
                '${result.created == 1 ? 'student' : 'students'} — parents notified'
          // Say it plainly: some children simply have no parent account to
          // notify, and the admin should know rather than assume full coverage.
          : 'Scheduled for ${result.created}; '
                '${result.skipped} skipped (no parent account linked)',
      type: ToastType.success,
    );
    _reload();
  }

  /// Scheduling means committing to a date — that date is what the parent is
  /// told, so ask for it rather than accepting blind.
  Future<void> _schedule(PtmModel p) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      helpText: 'Meeting date',
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
      helpText: 'Meeting time',
    );
    if (!mounted) return;

    final at = DateTime(
      date.year,
      date.month,
      date.day,
      time?.hour ?? 10,
      time?.minute ?? 0,
    );
    await _respond(p, 'scheduled', scheduledAt: at);
  }

  Future<void> _respond(
    PtmModel p,
    String status, {
    DateTime? scheduledAt,
  }) async {
    try {
      await AdminApi.instance.respondPtm(
        p.id,
        status: status,
        scheduledAt: scheduledAt,
      );
      if (!mounted) return;
      AppToast.show(
        context,
        switch (status) {
          'scheduled' => 'Meeting scheduled — the parent has been notified',
          'declined' => 'Request declined — the parent has been notified',
          _ => 'Meeting marked complete',
        },
        type: ToastType.success,
      );
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }
}

/// Pick the classes, the reason, and when. Pops with the created/skipped
/// counts, or null if the admin backed out.
class _ClassMeetingSheet extends StatefulWidget {
  const _ClassMeetingSheet();

  @override
  State<_ClassMeetingSheet> createState() => _ClassMeetingSheetState();
}

class _ClassMeetingSheetState extends State<_ClassMeetingSheet> {
  late Future<List<SchoolClass>> _classes;
  final _selected = <String>{};
  final _reasonCtl = TextEditingController();
  DateTime? _at;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _classes = AdminApi.instance.listClasses();
  }

  @override
  void dispose() {
    _reasonCtl.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _selected.isNotEmpty &&
      _reasonCtl.text.trim().isNotEmpty &&
      _at != null &&
      !_saving;

  Future<void> _pickWhen() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      helpText: 'Meeting date',
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
      helpText: 'Meeting time',
    );
    if (!mounted) return;
    setState(() {
      _at = DateTime(
        date.year,
        date.month,
        date.day,
        time?.hour ?? 10,
        time?.minute ?? 0,
      );
    });
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      final res = await AdminApi.instance.createClassPtm(
        classIds: _selected.toList(),
        reason: _reasonCtl.text.trim(),
        scheduledAt: _at!,
      );
      if (!mounted) return;
      Navigator.of(context).pop(res);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppToast.show(context, 'Could not schedule: $e', type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.8,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'New meeting',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Every student in the chosen classes gets a meeting, and their '
                'parent is notified.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
              const SizedBox(height: 12),

              const Text(
                'Classes',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(height: 8),
              Flexible(
                child: SingleChildScrollView(
                  child: FutureBuilder<List<SchoolClass>>(
                    future: _classes,
                    builder: (context, snap) {
                      if (snap.connectionState == ConnectionState.waiting) {
                        return const Padding(
                          padding: EdgeInsets.all(12),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      final classes = snap.data ?? const <SchoolClass>[];
                      if (classes.isEmpty) {
                        return const Text(
                          'No classes yet.',
                          style: TextStyle(color: AppColors.textMuted),
                        );
                      }
                      return Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final c in classes)
                            NeuChip(
                              label: c.displayName,
                              selected: _selected.contains(c.id),
                              accent: AppColors.adminPrimary,
                              onTap: () => setState(() {
                                if (!_selected.remove(c.id)) {
                                  _selected.add(c.id);
                                }
                              }),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),

              TextField(
                controller: _reasonCtl,
                maxLines: 2,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Reason (e.g. term progress review)',
                  filled: true,
                  fillColor: Neu.well,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // The date is what every parent gets told, so it's required.
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.event_rounded,
                  color: AppColors.adminPrimary,
                ),
                title: Text(
                  _at == null
                      ? 'Pick date & time'
                      : '${Formatters.formatDate(_at!)} at '
                            '${Formatters.formatTime(_at!)}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: _pickWhen,
              ),
              const SizedBox(height: 4),

              PrimaryButton(
                label: _saving ? 'Scheduling…' : 'Schedule meeting',
                color: AppColors.adminPrimary,
                fullWidth: true,
                onPressed: _canSubmit ? _submit : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          color: AppColors.textMuted,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _PtmCard extends StatelessWidget {
  const _PtmCard({
    required this.ptm,
    required this.onSchedule,
    required this.onDecline,
    required this.onComplete,
  });

  final PtmModel ptm;
  final VoidCallback? onSchedule;
  final VoidCallback? onDecline;
  final VoidCallback? onComplete;

  @override
  Widget build(BuildContext context) {
    return NeuCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ptm.studentName ?? 'Meeting request',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              StatusChip(
                label: _statusLabel(ptm.status),
                type: _statusChip(ptm.status),
              ),
            ],
          ),
          if (ptm.requestedByName != null)
            Text(
              'Raised by ${ptm.requestedByName}'
              '${ptm.requestedByRole == 'teacher' ? ' (teacher)' : ''}',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
              ),
            ),
          const SizedBox(height: 6),
          Text(ptm.reason, style: const TextStyle(fontSize: 13)),
          if (ptm.preferredSlots.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Preferred: ${ptm.preferredSlots.join(', ')}',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ),
          if (ptm.scheduledAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Scheduled ${Formatters.formatDate(ptm.scheduledAt!)} '
                'at ${Formatters.formatTime(ptm.scheduledAt!)}',
                style: const TextStyle(
                  color: AppColors.success,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (onSchedule != null || onDecline != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                if (onSchedule != null)
                  Expanded(
                    child: NeuButton(
                      label: 'Schedule',
                      height: 42,
                      onPressed: onSchedule,
                    ),
                  ),
                if (onSchedule != null && onDecline != null)
                  const SizedBox(width: 10),
                if (onDecline != null)
                  Expanded(
                    child: NeuGhostButton(
                      label: 'Decline',
                      color: AppColors.danger,
                      onPressed: onDecline,
                    ),
                  ),
              ],
            ),
          ],
          if (onComplete != null) ...[
            const SizedBox(height: 10),
            NeuGhostButton(
              label: 'Mark completed',
              color: AppColors.textMuted,
              onPressed: onComplete,
            ),
          ] else if (ptm.status == 'scheduled') ...[
            // Scheduled but the day hasn't come — say why there's no button
            // rather than leaving the card looking half-finished.
            const SizedBox(height: 6),
            const Text(
              'Can be marked completed on the meeting date',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }

  static String _statusLabel(String s) => switch (s) {
    'scheduled' => 'Scheduled',
    'declined' => 'Declined',
    'completed' => 'Completed',
    'cancelled' => 'Cancelled',
    _ => 'Requested',
  };

  static ChipType _statusChip(String s) => switch (s) {
    'scheduled' => ChipType.success,
    'declined' || 'cancelled' => ChipType.danger,
    'completed' => ChipType.neutral,
    _ => ChipType.warning,
  };
}
