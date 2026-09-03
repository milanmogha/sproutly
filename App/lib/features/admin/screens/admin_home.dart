import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/network/admin_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neu.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/cards.dart';
import '../../../routing/home_shell.dart';
import '../../shared/notification_bell.dart';
import 'admin_students.dart';
import 'admin_subscription.dart';

class AdminHomeScreen extends StatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
  late Future<AdminDashboardStats> _statsFuture;

  @override
  void initState() {
    super.initState();
    _statsFuture = AdminApi.instance.getDashboardStats();
  }

  void _refresh() => setState(() {
        _statsFuture = AdminApi.instance.getDashboardStats();
      });

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.adminPrimary;
    return Scaffold(
      backgroundColor: Neu.bg,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              // Header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: accent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        alignment: Alignment.center,
                        child: const Text('🎒', style: TextStyle(fontSize: 20)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            FutureBuilder<AdminDashboardStats>(
                              future: _statsFuture,
                              builder: (context, snap) => Text(
                                snap.data?.schoolName ?? 'Your School',
                                style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const Text('Admin Panel',
                                style: TextStyle(
                                    color: AppColors.textMuted, fontSize: 12)),
                          ],
                        ),
                      ),
                      const NotificationBell(),
                    ],
                  ),
                ),
              ),

              // Renewal warning — silent unless the plan is close to expiry
              // or already past it.
              const SliverToBoxAdapter(child: AdminSubscriptionBanner()),

              // Stats grid
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                  child: FutureBuilder<AdminDashboardStats>(
                    future: _statsFuture,
                    builder: (context, snap) {
                      final loading = snap.connectionState ==
                          ConnectionState.waiting;
                      final stats = snap.data;
                      final cards = [
                        StatCard(
                          label: 'Students enrolled',
                          value: loading
                              ? '…'
                              : '${stats?.studentCount ?? 0}',
                          icon: Iconsax.people,
                          accent: AppColors.adminPrimary,
                        ),
                        StatCard(
                          label: 'Active students',
                          value: loading
                              ? '…'
                              : '${stats?.activeStudents ?? 0}',
                          icon: Iconsax.user_tick,
                          accent: AppColors.success,
                        ),
                        StatCard(
                          label: 'Staff accounts',
                          value: loading
                              ? '…'
                              : '${stats?.staffCount ?? 0}',
                          icon: Iconsax.teacher,
                          accent: AppColors.info,
                        ),
                        StatCard(
                          label: 'Other statuses',
                          value: loading
                              ? '…'
                              : '${(stats?.byStatus['inactive'] ?? 0) + (stats?.byStatus['alumni'] ?? 0)}',
                          icon: Iconsax.archive,
                          accent: AppColors.warning,
                        ),
                      ];
                      return GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        // Without this a nested scroll view quietly inherits the
                        // device's bottom inset as padding — dead space under
                        // the last row.
                        padding: EdgeInsets.zero,
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        // Sized to the card's content (icon + value + label);
                        // anything taller leaves dead space inside every tile.
                        childAspectRatio: 1.45,
                        children: [
                          for (int i = 0; i < cards.length; i++)
                            cards[i]
                                .animate(delay: (60 * i).ms)
                                .fadeIn(
                                    duration: 360.ms,
                                    curve: Curves.easeOut)
                                .slideY(
                                    begin: 0.1,
                                    curve: Curves.easeOutCubic),
                        ],
                      );
                    },
                  ),
                ),
              ),

              // Quick actions
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                  child: SizedBox(
                    height: 110,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _Qa(
                            label: 'New\nAdmission',
                            icon: Iconsax.user_add,
                            onTap: () => _openAdmission(context)),
                        _Qa(
                            label: 'Send\nCircular',
                            icon: Iconsax.message,
                            onTap: () => _openCircular(context)),
                        _Qa(
                            label: 'Create\nEvent',
                            icon: Iconsax.calendar_add,
                            onTap: () => _openEvent(context)),
                        _Qa(
                            label: 'Mark\nHoliday',
                            icon: Iconsax.calendar_remove,
                            onTap: () => _openHoliday(context)),
                        _Qa(
                            label: 'Generate\nReport',
                            icon: Iconsax.chart,
                            onTap: () => _openReport(context)),
                      ]
                          .asMap()
                          .entries
                          .map((e) => Padding(
                                padding: const EdgeInsets.only(right: 10),
                                child: e.value
                                    .animate(delay: (150 + 70 * e.key).ms)
                                    .fadeIn(
                                        duration: 360.ms,
                                        curve: Curves.easeOut)
                                    .slideX(
                                        begin: 0.15,
                                        curve: Curves.easeOutCubic),
                              ))
                          .toList(),
                    ),
                  ),
                ),
              ),

              // Today's summary — driven by the live dashboard snapshot.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Today',
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark)),
                      const SizedBox(height: 12),
                      FutureBuilder<AdminDashboardStats>(
                        future: _statsFuture,
                        builder: (context, snap) {
                          final stats = snap.data;
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _attendanceCard(context, stats),
                              const SizedBox(height: 10),
                              _leaveCard(context, stats),
                            ],
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
    );
  }

  // ── Today cards ────────────────────────────────────────────

  Widget _attendanceCard(BuildContext context, AdminDashboardStats? stats) {
    if (stats == null) {
      return const ActionCard(
        title: 'Loading today’s attendance…',
        subtitle: 'Fetching the latest numbers',
        icon: Iconsax.clipboard_text,
        accent: AppColors.textMuted,
      );
    }
    if (stats.attendanceTotal == 0) {
      return ActionCard(
        title: 'No active students yet',
        subtitle: 'Add students to start tracking attendance',
        icon: Iconsax.clipboard_text,
        accent: AppColors.textMuted,
        onTap: () => AppToast.show(context, 'Add students from the Students tab',
            type: ToastType.info),
      );
    }
    if (stats.attendanceComplete) {
      return ActionCard(
        title: 'Attendance marked for today',
        subtitle:
            '${stats.presentToday} present · ${stats.absentToday} absent',
        icon: Iconsax.clipboard_tick,
        accent: AppColors.success,
        onTap: _openAttendanceTab,
      );
    }
    return ActionCard(
      title: '${stats.attendanceNotMarked} students not yet marked',
      subtitle:
          '${stats.attendanceMarked} of ${stats.attendanceTotal} marked so far',
      icon: Iconsax.clipboard_text,
      accent: AppColors.warning,
      onTap: _openAttendanceTab,
    );
  }

  /// Attendance sits at index 2 of the admin bottom nav — see `_AdminShell`.
  void _openAttendanceTab() => HomeShell.selectTab(2);

  Widget _leaveCard(BuildContext context, AdminDashboardStats? stats) {
    final pending = stats?.pendingLeaves ?? 0;
    if (stats != null && pending == 0) {
      return ActionCard(
        title: 'No pending leave requests',
        subtitle: 'You’re all caught up',
        icon: Iconsax.calendar_tick,
        accent: AppColors.success,
        onTap: () => _openStaffLeaves(context),
      );
    }
    return ActionCard(
      title: stats == null
          ? 'Leave requests'
          : '$pending leave request${pending == 1 ? '' : 's'} to review',
      subtitle: 'Tap to open Staff → Leave Requests',
      icon: Iconsax.calendar_tick,
      accent: AppColors.info,
      onTap: () => _openStaffLeaves(context),
    );
  }

  void _openStaffLeaves(BuildContext context) {
    Navigator.of(context).push(
      neuRoute(const AdminStaffScreen()),
    );
  }
}

// ── Quick-action tile ──────────────────────────────────────

/// Raised soft-UI tile that sinks in while pressed — mirrors the quick actions
/// on the parent and teacher home screens.
class _Qa extends StatefulWidget {
  const _Qa({required this.label, required this.icon, required this.onTap});
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  State<_Qa> createState() => _QaState();
}

class _QaState extends State<_Qa> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.adminPrimary;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap();
      },
      child: SizedBox(
        width: 92,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              curve: Curves.easeOut,
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: _pressed ? Neu.concave : Neu.convex,
                boxShadow: _pressed ? null : Neu.raisedShadow,
                border: _pressed
                    ? Border.all(color: const Color(0x141E3A8A), width: 0.8)
                    : null,
              ),
              child: AnimatedScale(
                scale: _pressed ? 0.88 : 1,
                duration: const Duration(milliseconds: 160),
                curve: Curves.easeOutCubic,
                child: Icon(widget.icon, color: accent, size: 24),
              ),
            ),
            const SizedBox(height: 8),
            Text(widget.label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: AppColors.textDark,
                    fontWeight: FontWeight.w600,
                    fontSize: 11.5,
                    height: 1.15)),
          ],
        ),
      ),
    );
  }
}

// ── Bottom-sheet quick-action helpers ─────────────────────

void _openAdmission(BuildContext context) {
  final nameCtl = TextEditingController();
  final parentCtl = TextEditingController();
  final phoneCtl = TextEditingController();
  showAppBottomSheet<void>(
    context: context,
    scrollable: true,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('New admission inquiry',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 12),
          TextField(
              controller: nameCtl,
              decoration: const InputDecoration(
                  labelText: 'Child name', border: OutlineInputBorder())),
          const SizedBox(height: 8),
          TextField(
              controller: parentCtl,
              decoration: const InputDecoration(
                  labelText: 'Parent name', border: OutlineInputBorder())),
          const SizedBox(height: 8),
          TextField(
              controller: phoneCtl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                  labelText: 'Phone', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          Builder(builder: (ctx) {
            return PrimaryButton(
              label: 'Save inquiry',
              color: AppColors.adminPrimary,
              fullWidth: true,
              onPressed: () async {
                if (nameCtl.text.trim().isEmpty ||
                    parentCtl.text.trim().isEmpty ||
                    phoneCtl.text.trim().isEmpty) {
                  AppToast.show(ctx, 'Child, parent and phone are required',
                      type: ToastType.error);
                  return;
                }
                try {
                  await AdminApi.instance.createInquiry(
                    childName: nameCtl.text.trim(),
                    parentName: parentCtl.text.trim(),
                    parentPhone: phoneCtl.text.trim(),
                  );
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  AppToast.show(ctx, 'Inquiry saved',
                      type: ToastType.success);
                } catch (e) {
                  if (!ctx.mounted) return;
                  AppToast.show(ctx, 'Failed: $e', type: ToastType.error);
                }
              },
            );
          }),
        ],
      ),
    ),
  );
}

void _openCircular(BuildContext context) {
  final titleCtl = TextEditingController();
  final bodyCtl = TextEditingController();
  showAppBottomSheet<void>(
    context: context,
    scrollable: true,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Send circular',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 12),
          TextField(
              controller: titleCtl,
              decoration: const InputDecoration(
                  labelText: 'Title', border: OutlineInputBorder())),
          const SizedBox(height: 8),
          TextField(
              controller: bodyCtl,
              maxLines: 5,
              decoration: const InputDecoration(
                  labelText: 'Message', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          Builder(builder: (ctx) {
            return PrimaryButton(
              label: 'Send to all parents',
              color: AppColors.adminPrimary,
              fullWidth: true,
              onPressed: () async {
                if (titleCtl.text.trim().isEmpty ||
                    bodyCtl.text.trim().isEmpty) {
                  AppToast.show(ctx, 'Title and message are required',
                      type: ToastType.error);
                  return;
                }
                try {
                  await AdminApi.instance.createCircular(
                    title: titleCtl.text.trim(),
                    body: bodyCtl.text.trim(),
                  );
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  AppToast.show(ctx, 'Circular sent',
                      type: ToastType.success);
                } catch (e) {
                  if (!ctx.mounted) return;
                  AppToast.show(ctx, 'Failed: $e', type: ToastType.error);
                }
              },
            );
          }),
        ],
      ),
    ),
  );
}

void _openEvent(BuildContext context) {
  final titleCtl = TextEditingController();
  DateTime date = DateTime.now().add(const Duration(days: 7));
  showAppBottomSheet<void>(
    context: context,
    scrollable: true,
    child: StatefulBuilder(builder: (ctx, setSt) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Create event',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark)),
            const SizedBox(height: 12),
            TextField(
                controller: titleCtl,
                decoration: const InputDecoration(
                    labelText: 'Title', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            ListTile(
              tileColor: Neu.bg,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.mutedGray),
              ),
              title: const Text('Date'),
              subtitle: Text('${date.day}/${date.month}/${date.year}'),
              trailing: const Icon(Icons.calendar_today_rounded, size: 18),
              onTap: () async {
                final picked = await showDatePicker(
                  context: ctx,
                  initialDate: date,
                  firstDate: DateTime.now(),
                  lastDate: DateTime(2028, 12, 31),
                );
                if (picked != null) setSt(() => date = picked);
              },
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Publish',
              color: AppColors.adminPrimary,
              fullWidth: true,
              onPressed: () async {
                if (titleCtl.text.trim().isEmpty) {
                  AppToast.show(ctx, 'Title is required',
                      type: ToastType.error);
                  return;
                }
                try {
                  await AdminApi.instance.createEvent(
                    title: titleCtl.text.trim(),
                    startDate:
                        '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
                  );
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  AppToast.show(ctx, 'Event published',
                      type: ToastType.success);
                } catch (e) {
                  if (!ctx.mounted) return;
                  AppToast.show(ctx, 'Failed: $e', type: ToastType.error);
                }
              },
            ),
          ],
        ),
      );
    }),
  );
}

void _openHoliday(BuildContext context) {
  // Uses the real holidays endpoint (A4) via the shared form in
  // admin_students.dart — no longer posts a generic event tagged "Holiday".
  showAdminHolidayForm(context).then((created) {
    if (created == true && context.mounted) {
      AppToast.show(context, 'Holiday marked', type: ToastType.success);
    }
  });
}

void _openReport(BuildContext context) {
  Navigator.of(context).push(
    neuRoute(const AdminReportsScreen()),
  );
}
