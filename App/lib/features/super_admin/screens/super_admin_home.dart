import 'dart:ui' show ImageFilter;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax/iconsax.dart';
import 'package:intl/intl.dart';
import '../../../core/models/app_user.dart';
import '../../../core/models/school.dart';
import '../../../core/models/subscription.dart';
import '../../../core/network/auth_api.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/network/subscription_api.dart';
import '../../admin/screens/admin_subscription.dart' show formatRupees;
import '../../../core/services/services_scope.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../shared/confirm_logout.dart';
import '../../shared/privacy_policy_screen.dart';
import '../../../core/widgets/neu.dart';
import '../../../core/services/notification_badge.dart';
import '../../shared/notification_bell.dart';
import '../../shared/notifications_screen.dart';

// ── Liquid-glass design system (super admin portal) ─────────────────────────
// Frosted translucent surfaces blurring soft color blobs behind them.
// Monochrome type; coral stays the single accent (actions, active nav, focus).

const _ink = AppColors.textDark;
const _mut = AppColors.textMuted;
const _line = Color(0xFFEDEDED);
const _faint = Color(0xFFF5F5F5);
const _accent = AppColors.superAdminPrimary;

const _h1 = TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: _ink);
const _sheetTitle =
    TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: _ink);
const _name = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _ink);
const _sub = TextStyle(fontSize: 12, color: _mut);

// No trial status: a trial is just a short subscription invoice, so it lives
// in the billing data rather than as a state of the school itself.
const _statusOrder = ['active', 'suspended', 'inactive'];

Color _statusColor(String s) => switch (s) {
      'active' => AppColors.success,
      'suspended' => AppColors.warning,
      _ => _mut,
    };

String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
String _date(DateTime? d) =>
    d == null ? '—' : DateFormat('dd MMM yyyy').format(d);

/// Backend error → readable message (mirrors the web console's errorMessage).
String _errorText(Object e) {
  if (e is DioException) {
    final body = e.response?.data;
    final m = body is Map<String, dynamic> ? body['message'] : null;
    if (m is List) return m.join(', ');
    if (m is String) return m;
    return 'Network error — check your connection';
  }
  return 'Something went wrong. Try again.';
}

InputDecoration _dec(String label, {String? prefix}) => InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(fontSize: 13, color: _mut),
      prefixText: prefix,
      counterText: '',
      isDense: true,
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.5),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _accent, width: 1.3),
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _line),
      ),
    );

// ── Glass atoms ─────────────────────────────────────────────────────────────

/// Hairline for rows sitting on glass.
const _gdiv = Divider(height: 1, thickness: 1, color: Color(0x12000000));

/// Frosted glass card: backdrop blur + translucent white sheen + light border.
Widget _glass({required Widget child, EdgeInsets? padding, double radius = 20}) =>
    Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [
          BoxShadow(
              color: Color(0x16000000), blurRadius: 28, offset: Offset(0, 10)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: Container(
            padding: padding ?? const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(radius),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white.withValues(alpha: 0.66),
                  Colors.white.withValues(alpha: 0.38),
                ],
              ),
              border: Border.all(color: Colors.white.withValues(alpha: 0.75)),
            ),
            child: Material(color: Colors.transparent, child: child),
          ),
        ),
      ),
    );

/// Soft radial color blob for the ambient backdrop.
Widget _blob(
        {double? top,
        double? left,
        double? right,
        double? bottom,
        required double size,
        required Color color}) =>
    Positioned(
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      child: IgnorePointer(
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient:
                RadialGradient(colors: [color, color.withValues(alpha: 0)]),
          ),
        ),
      ),
    );

/// Ambient gradient + color blobs every glass surface blurs over.
Widget _backdrop() => Positioned.fill(
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFFDF5F2), Color(0xFFF4F6FB)],
          ),
        ),
        child: Stack(
          children: [
            _blob(top: -90, left: -70, size: 300, color: const Color(0x55E05B4B)),
            _blob(top: 140, right: -90, size: 280, color: const Color(0x4DF59E0B)),
            _blob(bottom: 60, left: -60, size: 300, color: const Color(0x403B82F6)),
            _blob(bottom: -80, right: -40, size: 260, color: const Color(0x33E05B4B)),
          ],
        ),
      ),
    );

/// Glass bottom sheet (drag handle + frosted panel), replaces the solid one.
///
/// Keyboard handling lives here: the sheet is padded by the keyboard inset so
/// its contents sit above the on-screen keyboard, and it is capped to (nearly)
/// the screen height. Pass [scrollable] `true` for form sheets whose body may
/// outgrow the visible area; leave it `false` when the [child] scrolls itself.
Future<T?> _showGlassSheet<T>(
    {required BuildContext context,
    required Widget child,
    bool scrollable = false}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final media = MediaQuery.of(ctx);
      return Padding(
        // Lift the whole sheet clear of the keyboard; rebuilds as it opens.
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: media.size.height - media.padding.top - 24,
          ),
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.white.withValues(alpha: 0.88),
                      Colors.white.withValues(alpha: 0.72),
                    ],
                  ),
                  border: Border(
                      top: BorderSide(
                          color: Colors.white.withValues(alpha: 0.8))),
                ),
                child: Material(
                  color: Colors.transparent,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(height: 8),
                      Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0x33000000),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Flexible(
                        child: scrollable
                            ? SingleChildScrollView(child: child)
                            : child,
                      ),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

/// Hairline-separated columns (KPI / count strips).
Widget _strip(List<Widget> cells) => IntrinsicHeight(
      child: Row(
        children: [
          for (var i = 0; i < cells.length; i++) ...[
            if (i > 0) Container(width: 1, color: const Color(0x12000000)),
            Expanded(child: cells[i]),
          ],
        ],
      ),
    );

/// One strip cell: big number over a tiny muted label (optional status dot).
Widget _cell(String value, String label,
        {VoidCallback? onTap, Color? dot, double size = 22}) =>
    InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: size, fontWeight: FontWeight.w700, color: _ink)),
            const SizedBox(height: 3),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (dot != null) ...[
                  Container(
                      width: 6,
                      height: 6,
                      decoration:
                          BoxDecoration(color: dot, shape: BoxShape.circle)),
                  const SizedBox(width: 5),
                ],
                Flexible(
                  child: Text(label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: _mut)),
                ),
              ],
            ),
          ],
        ),
      ),
    );

/// Small-caps section label with optional trailing action.
class _Label extends StatelessWidget {
  const _Label(this.text, {this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 0, 2, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(text.toUpperCase(),
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1,
                    color: _mut)),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Page title used by tab screens (no AppBar — the backdrop runs edge-to-edge).
class _PageTitle extends StatelessWidget {
  const _PageTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 16),
      child: Text(text, style: _h1),
    );
  }
}

/// Status dot + capitalized muted text — replaces filled chips.
class _StatusDot extends StatelessWidget {
  const _StatusDot(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
                color: _statusColor(status), shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(_cap(status),
            style: const TextStyle(
                fontSize: 12, color: _mut, fontWeight: FontWeight.w500)),
      ],
    );
  }
}

/// Monochrome circle initial.
class _Avatar extends StatelessWidget {
  const _Avatar(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: const BoxDecoration(color: _faint, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        text.trim().isEmpty ? '?' : text.trim()[0].toUpperCase(),
        style: const TextStyle(
            color: _ink, fontWeight: FontWeight.w700, fontSize: 14),
      ),
    );
  }
}

/// Hairline action row: icon · title · chevron.
class _ActionRow extends StatelessWidget {
  const _ActionRow(
      {required this.icon, required this.title, required this.onTap, this.color});
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color ?? _mut),
            const SizedBox(width: 12),
            Expanded(
              child: Text(title,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: color ?? _ink)),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: _mut),
          ],
        ),
      ),
    );
  }
}

/// Small glass icon button (bell, back).
Widget _glassIcon(
        {required IconData icon, required VoidCallback onTap}) =>
    _glass(
      radius: 21,
      padding: EdgeInsets.zero,
      child: SizedBox(
        width: 42,
        height: 42,
        child: InkWell(
          onTap: onTap,
          child: Icon(icon, size: 20, color: _ink),
        ),
      ),
    );

/// Frosted bottom nav for the super admin shell: content scrolls beneath it
/// (shell uses extendBody) and the bar blurs whatever passes under.
class SuperAdminNavBar extends StatelessWidget {
  const SuperAdminNavBar(
      {super.key, required this.currentIndex, required this.onTap});
  final int currentIndex;
  final ValueChanged<int> onTap;

  static const _tabs = [
    (label: 'Home', icon: Iconsax.home, active: Iconsax.home_1),
    (label: 'Schools', icon: Iconsax.building, active: Iconsax.buildings),
    (label: 'Users', icon: Iconsax.people, active: Iconsax.people1),
    (label: 'Settings', icon: Iconsax.setting_2, active: Iconsax.setting_21),
  ];

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.6),
            border: Border(
                top: BorderSide(color: Colors.white.withValues(alpha: 0.7))),
          ),
          child: SafeArea(
            top: false,
            child: SizedBox(
              height: 58,
              child: Row(
                children: [
                  for (var i = 0; i < _tabs.length; i++)
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          onTap(i);
                        },
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              i == currentIndex
                                  ? _tabs[i].active
                                  : _tabs[i].icon,
                              size: 22,
                              color: i == currentIndex ? _accent : _mut,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _tabs[i].label,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: i == currentIndex
                                    ? FontWeight.w600
                                    : FontWeight.w500,
                                color: i == currentIndex ? _accent : _mut,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Home (web: DashboardPage) ───────────────────────────────────────────────

class SuperAdminHomeScreen extends StatefulWidget {
  const SuperAdminHomeScreen({super.key});

  @override
  State<SuperAdminHomeScreen> createState() => _SuperAdminHomeScreenState();
}

class _SuperAdminHomeScreenState extends State<SuperAdminHomeScreen> {
  SchoolStats? _stats;

  /// Schools whose plan is expiring, in grace, or already locked — the
  /// backend's own `showWarning` flag, so this can't drift from what the
  /// billing screens and the write guard think.
  int? _needsRenewal;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Post-frame: ServicesScope lookups aren't allowed inside initState.
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    final s = context.services;
    try {
      final stats = s.schools.stats();
      await Future.wait([s.schools.refresh(), s.users.refresh()]);
      final result = await stats;
      if (!mounted) return;
      setState(() {
        _stats = result;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = _errorText(e));
    }

    // Separate and non-fatal: a billing hiccup shouldn't blank the dashboard.
    try {
      final rows = await SubscriptionApi.instance.overview();
      if (mounted) {
        setState(() =>
            _needsRenewal = rows.where((r) => r.state.showWarning).length);
      }
    } catch (_) {
      // Leaves the tile showing "—".
    }
  }

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    final email = AuthApi.instance.currentSession?.email;
    final pad = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          _backdrop(),
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              color: _accent,
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                padding: EdgeInsets.fromLTRB(20, 8, 20, 24 + pad),
                children: [
                  // Header
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('Platform overview', style: _h1),
                            const SizedBox(height: 2),
                            Text(
                              (email == null || email.isEmpty)
                                  ? 'Sproutly super admin'
                                  : email,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13, color: _mut),
                            ),
                          ],
                        ),
                      ),
                      UnreadBadge(
                        child: _glassIcon(
                          icon: Iconsax.notification,
                          onTap: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) =>
                                      const NotificationsScreen()),
                            );
                            NotificationBadge.instance.refresh();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  if (_error != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: AppColors.danger.withValues(alpha: 0.35)),
                      ),
                      child: Text(_error!,
                          style: const TextStyle(
                              color: AppColors.danger, fontSize: 13)),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // KPIs — same four as the web dashboard, in one glass grid.
                  const _Label('Overview'),
                  _glass(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _strip([
                          _cell('${_stats?.total ?? '—'}', 'Schools',
                              onTap: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                        builder: (_) =>
                                            const SuperAdminSchoolsScreen()),
                                  )),
                          _cell('${_stats?.byStatus['active'] ?? '—'}',
                              'Active schools',
                              dot: AppColors.success),
                        ]),
                        _gdiv,
                        _strip([
                          _cell('${_needsRenewal ?? '—'}', 'Needs renewal',
                              dot: (_needsRenewal ?? 0) > 0
                                  ? AppColors.warning
                                  : AppColors.success),
                          ValueListenableBuilder(
                            valueListenable: services.users.total,
                            builder: (_, total, _) => _cell(
                                '$total', 'Accounts',
                                onTap: () => Navigator.of(context).push(
                                      MaterialPageRoute(
                                          builder: (_) =>
                                              const SuperAdminUsersScreen()),
                                    )),
                          ),
                        ]),
                      ],
                    ),
                  ),

                  // Status distribution.
                  if (_stats != null && _stats!.total > 0) ...[
                    const SizedBox(height: 20),
                    const _Label('By status'),
                    _glass(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: Row(
                              children: [
                                for (final s in _statusOrder)
                                  if ((_stats!.byStatus[s] ?? 0) > 0)
                                    Expanded(
                                      flex: _stats!.byStatus[s]!,
                                      child: Container(
                                          height: 6, color: _statusColor(s)),
                                    ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 16,
                            runSpacing: 6,
                            children: [
                              for (final s in _statusOrder)
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                          color: _statusColor(s),
                                          shape: BoxShape.circle),
                                    ),
                                    const SizedBox(width: 5),
                                    Text(
                                        '${_cap(s)} ${_stats!.byStatus[s] ?? 0}',
                                        style: const TextStyle(
                                            fontSize: 12, color: _mut)),
                                  ],
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Recently added schools (backend returns newest first).
                  const SizedBox(height: 20),
                  _Label(
                    'Recent schools',
                    trailing: GestureDetector(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const SuperAdminSchoolsScreen()),
                      ),
                      child: const Text('View all',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _accent)),
                    ),
                  ),
                  ValueListenableBuilder(
                    valueListenable: services.schools.schoolsListenable,
                    builder: (context, schools, _) {
                      if (schools.isEmpty) {
                        return _glass(
                          padding: const EdgeInsets.all(24),
                          child: const Center(
                            child: Text('No schools yet — add the first one.',
                                style: TextStyle(color: _mut, fontSize: 13)),
                          ),
                        );
                      }
                      final recent = schools.take(6).toList();
                      return _glass(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            for (var i = 0; i < recent.length; i++) ...[
                              if (i > 0) _gdiv,
                              _SchoolTile(school: recent[i], showCity: false),
                            ],
                          ],
                        ),
                      );
                    },
                  ),

                  // Quick actions — same two as the web dashboard.
                  const SizedBox(height: 20),
                  const _Label('Quick actions'),
                  _glass(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _ActionRow(
                          icon: Iconsax.building_4,
                          title: 'Onboard a new school',
                          onTap: () => _openAddSchool(context),
                        ),
                        _gdiv,
                        _ActionRow(
                          icon: Iconsax.user_add,
                          title: 'Add a school admin',
                          onTap: () => _openAddUser(context),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One school row: initial · name · code/city/date · status dot.
class _SchoolTile extends StatelessWidget {
  const _SchoolTile({required this.school, this.showCity = true});
  final School school;
  final bool showCity;

  @override
  Widget build(BuildContext context) {
    final detail = showCity
        ? [
            school.code,
            if (school.city != null && school.city!.isNotEmpty) school.city!,
            _date(school.createdAt),
          ].join(' · ')
        : '${school.code} · added ${_date(school.createdAt)}';
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
            builder: (_) => _SchoolDetailScreen(schoolId: school.id)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            _Avatar(school.name),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(school.name, style: _name),
                  const SizedBox(height: 2),
                  Text(detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _sub),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _StatusDot(school.status),
          ],
        ),
      ),
    );
  }
}

// ── Schools (web: SchoolsPage) ──────────────────────────────────────────────

class SuperAdminSchoolsScreen extends StatefulWidget {
  const SuperAdminSchoolsScreen({super.key});

  @override
  State<SuperAdminSchoolsScreen> createState() =>
      _SuperAdminSchoolsScreenState();
}

class _SuperAdminSchoolsScreenState extends State<SuperAdminSchoolsScreen> {
  SchoolStats? _stats;
  String _search = '';
  String? _status; // null = all

  @override
  void initState() {
    super.initState();
    // Post-frame: ServicesScope lookups aren't allowed inside initState.
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadStats());
  }

  Future<void> _loadStats() async {
    if (!mounted) return;
    try {
      final stats = await context.services.schools.stats();
      if (mounted) setState(() => _stats = stats);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final schoolsService = context.services.schools;
    final pad = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          _backdrop(),
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              color: _accent,
              onRefresh: () =>
                  Future.wait([schoolsService.refresh(), _loadStats()]),
              child: ValueListenableBuilder(
                valueListenable: schoolsService.schoolsListenable,
                builder: (context, schools, _) {
                  final q = _search.trim().toLowerCase();
                  final filtered = schools
                      .where((s) =>
                          (_status == null || s.status == _status) &&
                          (q.isEmpty ||
                              s.name.toLowerCase().contains(q) ||
                              s.code.toLowerCase().contains(q)))
                      .toList();
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.fromLTRB(20, 4, 20, 96 + pad),
                    children: [
                      const _PageTitle('Schools'),
                      if (_stats != null) ...[
                        _glass(
                          padding: EdgeInsets.zero,
                          child: _strip([
                            for (final s in _statusOrder)
                              _cell('${_stats!.byStatus[s] ?? 0}', _cap(s),
                                  dot: _statusColor(s), size: 18),
                          ]),
                        ),
                        const SizedBox(height: 12),
                      ],
                      TextField(
                        onChanged: (v) => setState(() => _search = v),
                        style: const TextStyle(fontSize: 14, color: _ink),
                        decoration: InputDecoration(
                          hintText: 'Search name or code…',
                          hintStyle:
                              const TextStyle(fontSize: 14, color: _mut),
                          prefixIcon: const Icon(Iconsax.search_normal,
                              size: 18, color: _mut),
                          isDense: true,
                          filled: true,
                          fillColor: Colors.white.withValues(alpha: 0.55),
                          contentPadding:
                              const EdgeInsets.symmetric(vertical: 12),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                                color: Colors.white.withValues(alpha: 0.75)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide:
                                const BorderSide(color: _accent, width: 1.3),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            FilterChipX(
                              label: 'All',
                              selected: _status == null,
                              accent: _accent,
                              onTap: () => setState(() => _status = null),
                            ),
                            for (final s in _statusOrder) ...[
                              const SizedBox(width: 8),
                              FilterChipX(
                                label: _cap(s),
                                selected: _status == s,
                                accent: _accent,
                                onTap: () => setState(
                                    () => _status = _status == s ? null : s),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (filtered.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 60),
                          child: Center(
                            child: Text('No schools found.',
                                style: TextStyle(color: _mut, fontSize: 13)),
                          ),
                        )
                      else
                        _glass(
                          padding: EdgeInsets.zero,
                          child: Column(
                            children: [
                              for (var i = 0; i < filtered.length; i++) ...[
                                if (i > 0) _gdiv,
                                _SchoolTile(school: filtered[i]),
                              ],
                            ],
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: Padding(
        padding:
            EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom),
        child: FloatingActionButton.extended(
          heroTag: 'addschool',
          elevation: 0,
          highlightElevation: 0,
          backgroundColor: _accent,
          icon: const Icon(Icons.add, color: Colors.white, size: 20),
          label:
              const Text('Add school', style: TextStyle(color: Colors.white)),
          onPressed: () => _openAddSchool(context),
        ),
      ),
    );
  }
}

// ── School detail (web: SchoolDetailPage) ───────────────────────────────────

class _SchoolDetailScreen extends StatefulWidget {
  const _SchoolDetailScreen({required this.schoolId});
  final String schoolId;

  @override
  State<_SchoolDetailScreen> createState() => _SchoolDetailScreenState();
}

class _SchoolDetailScreenState extends State<_SchoolDetailScreen> {
  SchoolOverview? _overview;
  List<AppUser>? _accounts;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Post-frame: ServicesScope lookups aren't allowed inside initState.
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    final s = context.services;
    try {
      final results = await Future.wait<dynamic>([
        s.schools.overview(widget.schoolId),
        s.users.forSchool(widget.schoolId),
      ]);
      if (!mounted) return;
      setState(() {
        _overview = results[0] as SchoolOverview;
        _accounts = (results[1] as List).cast<AppUser>();
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = _errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = _overview;
    final pad = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          _backdrop(),
          SafeArea(
            bottom: false,
            child: Column(
              children: [
                // Glass header: back button + school name.
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                  child: Row(
                    children: [
                      _glassIcon(
                        icon: Iconsax.arrow_left_2,
                        onTap: () => Navigator.of(context).pop(),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(o?.school.name ?? 'School',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: _ink)),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _error != null
                      ? Center(
                          child: Text(_error!,
                              style:
                                  const TextStyle(color: AppColors.danger)))
                      : o == null
                          ? const Center(
                              child:
                                  CircularProgressIndicator(color: _accent))
                          : RefreshIndicator(
                              color: _accent,
                              onRefresh: _load,
                              child: ListView(
                                physics:
                                    const AlwaysScrollableScrollPhysics(),
                                padding:
                                    EdgeInsets.fromLTRB(20, 4, 20, 32 + pad),
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                            '${o.school.code} · joined ${_date(o.school.createdAt)}',
                                            style: const TextStyle(
                                                color: _mut, fontSize: 13)),
                                      ),
                                      _StatusDot(o.school.status),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  _glass(
                                    padding: EdgeInsets.zero,
                                    child: _strip([
                                      _cell('${o.students}', 'Students',
                                          size: 18),
                                      _cell(
                                          '${o.usersByRole['teacher'] ?? 0}',
                                          'Teachers',
                                          size: 18),
                                      _cell('${o.usersByRole['parent'] ?? 0}',
                                          'Parents',
                                          size: 18),
                                      _cell(
                                          '${o.usersByRole.values.fold<int>(0, (a, b) => a + b)}',
                                          'Accounts',
                                          size: 18),
                                    ]),
                                  ),
                                  const SizedBox(height: 20),
                                  const _Label('School info'),
                                  _glass(
                                    child: Column(
                                      children: [
                                        _InfoRow(
                                            label: 'Contact email',
                                            value: o.school.contactEmail),
                                        _InfoRow(
                                            label: 'Contact phone',
                                            value: o.school.contactPhone),
                                        _InfoRow(
                                            label: 'Address',
                                            value: o.school.address),
                                        _InfoRow(
                                            label: 'Active',
                                            value: o.school.isActive
                                                ? 'Yes'
                                                : 'No'),
                                      ],
                                    ),
                                  ),
                                  // The two money flows, in the order they
                                  // matter to the platform: what the school
                                  // owes us, then how its parents pay it.
                                  const SizedBox(height: 20),
                                  const _Label('Sproutly subscription'),
                                  _SubscriptionSection(
                                    schoolId: o.school.id,
                                    schoolName: o.school.name,
                                  ),
                                  const SizedBox(height: 20),
                                  const _Label('Online fee payments'),
                                  _PaymentGatewaySection(
                                    schoolId: o.school.id,
                                    schoolName: o.school.name,
                                  ),
                                  const SizedBox(height: 20),
                                  const _Label('Accounts'),
                                  _glass(
                                    padding: EdgeInsets.zero,
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Padding(
                                          padding: EdgeInsets.fromLTRB(
                                              16, 12, 16, 8),
                                          child: Text(
                                              'Everyone who signs in under this school.',
                                              style: _sub),
                                        ),
                                        _gdiv,
                                        if (_accounts == null ||
                                            _accounts!.isEmpty)
                                          const Padding(
                                            padding: EdgeInsets.all(24),
                                            child: Center(
                                              child: Text('No accounts yet.',
                                                  style: TextStyle(
                                                      color: _mut,
                                                      fontSize: 13)),
                                            ),
                                          )
                                        else
                                          for (var i = 0;
                                              i < _accounts!.length;
                                              i++) ...[
                                            if (i > 0) _gdiv,
                                            _UserTile(
                                                user: _accounts![i],
                                                onChanged: _load),
                                          ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, this.value});
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 116,
            child: Text(label,
                style: const TextStyle(color: _mut, fontSize: 13)),
          ),
          Expanded(
            child: Text(
              (value == null || value!.isEmpty) ? '—' : value!,
              style: const TextStyle(
                  color: _ink, fontSize: 13, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Users (web: UsersPage) ──────────────────────────────────────────────────

class SuperAdminUsersScreen extends StatelessWidget {
  const SuperAdminUsersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    final pad = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          _backdrop(),
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              color: _accent,
              onRefresh: () => Future.wait(
                  [services.users.refresh(), services.schools.refresh()]),
              child: AnimatedBuilder(
                animation: Listenable.merge([
                  services.users.usersListenable,
                  services.schools.schoolsListenable,
                ]),
                builder: (context, _) {
                  final users = services.users.usersListenable.value;
                  final schoolName = {
                    for (final s in services.schools.schoolsListenable.value)
                      s.id: s.name,
                  };
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.fromLTRB(20, 4, 20, 24 + pad),
                    children: [
                      const _PageTitle('Users'),
                      if (users.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 60),
                          child: Center(
                            child: Text('No users yet.',
                                style: TextStyle(color: _mut, fontSize: 13)),
                          ),
                        )
                      else ...[
                        ValueListenableBuilder(
                          valueListenable: services.users.total,
                          builder: (_, total, _) => _Label(total == 0
                              ? 'All accounts'
                              : 'All accounts · $total'),
                        ),
                        _glass(
                          padding: EdgeInsets.zero,
                          child: Column(
                            children: [
                              for (var i = 0; i < users.length; i++) ...[
                                if (i > 0) _gdiv,
                                _UserTile(
                                  user: users[i],
                                  schoolName: users[i].schoolId == null
                                      ? 'Platform'
                                      : schoolName[users[i].schoolId],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
      // No add button here — school admins are created from Home's
      // "Add a school admin" quick action (or when onboarding a school).
    );
  }
}

/// One account row: initial · name · contact/role/school · status dot.
class _UserTile extends StatelessWidget {
  const _UserTile({required this.user, this.schoolName, this.onChanged});
  final AppUser user;
  final String? schoolName;
  final Future<void> Function()? onChanged;

  @override
  Widget build(BuildContext context) {
    final contact = user.email.isNotEmpty ? user.email : (user.phone ?? '—');
    final detail =
        [contact, user.role, if (schoolName != null) schoolName!].join(' · ');
    return InkWell(
      onTap: () => _openUserSheet(context, user, onChanged: onChanged),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            _Avatar(user.name),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(user.name, style: _name),
                  const SizedBox(height: 2),
                  Text(detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _sub),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _StatusDot(user.active ? 'active' : 'inactive'),
          ],
        ),
      ),
    );
  }
}

void _openUserSheet(BuildContext context, AppUser user,
    {Future<void> Function()? onChanged}) {
  final usersService = context.services.users;
  final lastLogin = user.lastLoginAt == null
      ? 'Never signed in'
      : 'Last login ${DateFormat('dd MMM yyyy, h:mm a').format(user.lastLoginAt!)}';
  _showGlassSheet<void>(
    context: context,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(user.name, style: _sheetTitle),
          const SizedBox(height: 4),
          Text(
              '${user.email.isNotEmpty ? user.email : (user.phone ?? '—')} · ${user.role}',
              style: const TextStyle(fontSize: 13, color: _mut)),
          const SizedBox(height: 2),
          Text(lastLogin, style: _sub),
          const SizedBox(height: 16),
          PrimaryButton(
            label: user.active ? 'Suspend account' : 'Reactivate account',
            color: user.active ? AppColors.danger : _accent,
            onPressed: () async {
              try {
                await usersService.setActive(user.id, !user.active);
                await onChanged?.call();
                if (!context.mounted) return;
                Navigator.pop(context);
                AppToast.show(
                    context,
                    user.active
                        ? '${user.name} suspended'
                        : '${user.name} reactivated',
                    type: ToastType.success);
              } catch (e) {
                if (context.mounted) {
                  AppToast.show(context, _errorText(e), type: ToastType.error);
                }
              }
            },
          ),
        ],
      ),
    ),
  );
}

// ── Create school / create user sheets (web: SchoolForm / UserForm) ─────────

void _openAddSchool(BuildContext context) {
  final schoolsService = context.services.schools;
  final c = List.generate(8, (_) => TextEditingController());
  final [name, code, city, contactEmail, contactPhone, adminName, adminEmail,
      adminPhone] = c;
  bool saving = false;
  _showGlassSheet<void>(
    context: context,
    child: StatefulBuilder(builder: (ctx, setSt) {
      Future<void> submit() async {
        if (name.text.trim().isEmpty ||
            adminName.text.trim().isEmpty ||
            adminEmail.text.trim().isEmpty) {
          AppToast.show(ctx, 'Fill in the school and admin details',
              type: ToastType.error);
          return;
        }
        setSt(() => saving = true);
        try {
          final created = await schoolsService.createSchool(
            name: name.text.trim(),
            code: code.text.trim(),
            city: city.text.trim(),
            contactEmail: contactEmail.text.trim(),
            contactPhone: contactPhone.text.trim(),
            adminName: adminName.text.trim(),
            adminEmail: adminEmail.text.trim(),
            adminPhone: adminPhone.text.trim(),
          );
          if (ctx.mounted) Navigator.pop(ctx);
          if (!context.mounted) return;
          if (created.adminInviteUrl != null) {
            _showInviteSheet(context,
                email: adminEmail.text.trim(), url: created.adminInviteUrl!);
          } else {
            AppToast.show(context, 'School created — invite sent to admin',
                type: ToastType.success);
          }
        } catch (e) {
          setSt(() => saving = false);
          if (!ctx.mounted) return;
          AppToast.show(ctx, _errorText(e), type: ToastType.error);
        }
      }

      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('New school', style: _sheetTitle),
              const SizedBox(height: 4),
              const Text('Creating a school also creates its admin login.',
                  style: _sub),
              const SizedBox(height: 16),
              TextField(controller: name, decoration: _dec('School name')),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                        controller: code,
                        maxLength: 20,
                        decoration: _dec('Code (auto if empty)')),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                      child:
                          TextField(controller: city, decoration: _dec('City'))),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                  controller: contactEmail,
                  keyboardType: TextInputType.emailAddress,
                  decoration: _dec('Contact email (optional)')),
              const SizedBox(height: 10),
              TextField(
                  controller: contactPhone,
                  keyboardType: TextInputType.phone,
                  decoration: _dec('Contact phone (optional)')),
              const SizedBox(height: 20),
              const _Label('Admin account'),
              const Text(
                  "We'll email this admin a link to set their password and "
                  'activate the account.',
                  style: _sub),
              const SizedBox(height: 12),
              TextField(controller: adminName, decoration: _dec('Admin name')),
              const SizedBox(height: 10),
              TextField(
                  controller: adminEmail,
                  keyboardType: TextInputType.emailAddress,
                  decoration: _dec('Admin email')),
              const SizedBox(height: 10),
              TextField(
                  controller: adminPhone,
                  keyboardType: TextInputType.phone,
                  decoration: _dec('Admin phone (optional)')),
              const SizedBox(height: 16),
              PrimaryButton(
                label: saving ? 'Creating…' : 'Create school',
                color: _accent,
                onPressed: saving ? null : submit,
              ),
            ],
          ),
        ),
      );
    }),
  );
}

/// The super admin can only create school admin accounts — teachers, parents
/// and students are onboarded by each school itself.
void _openAddUser(BuildContext context) {
  final services = context.services;
  final name = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  String? schoolId;
  bool saving = false;
  _showGlassSheet<void>(
    context: context,
    child: StatefulBuilder(builder: (ctx, setSt) {
      Future<void> submit() async {
        if (name.text.trim().isEmpty ||
            email.text.trim().isEmpty ||
            schoolId == null) {
          AppToast.show(ctx, 'Fill in the required fields',
              type: ToastType.error);
          return;
        }
        setSt(() => saving = true);
        try {
          final digits = phone.text.trim();
          final inviteUrl = await services.users.createUser(
            name: name.text.trim(),
            role: 'admin',
            schoolId: schoolId!,
            email: email.text.trim(),
            phone: digits.isEmpty ? null : '+91$digits',
          );
          if (ctx.mounted) Navigator.pop(ctx);
          if (!context.mounted) return;
          if (inviteUrl != null) {
            _showInviteSheet(context,
                email: email.text.trim(), url: inviteUrl);
          } else {
            AppToast.show(context, 'Admin account created',
                type: ToastType.success);
          }
        } catch (e) {
          setSt(() => saving = false);
          if (!ctx.mounted) return;
          AppToast.show(ctx, _errorText(e), type: ToastType.error);
        }
      }

      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('New school admin', style: _sheetTitle),
              const SizedBox(height: 4),
              const Text(
                  'A set-password invite is emailed. Teachers and parents '
                  'are added by their school.',
                  style: _sub),
              const SizedBox(height: 16),
              TextField(controller: name, decoration: _dec('Name')),
              const SizedBox(height: 10),
              TextField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: _dec('Email')),
              const SizedBox(height: 10),
              TextField(
                controller: phone,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: _dec('Mobile number (optional)', prefix: '+91 '),
              ),
              const SizedBox(height: 10),
              ValueListenableBuilder(
                valueListenable: services.schools.schoolsListenable,
                builder: (_, schools, _) => DropdownButtonFormField<String>(
                  initialValue: schoolId,
                  decoration: _dec('School'),
                  items: [
                    for (final s in schools)
                      DropdownMenuItem(
                          value: s.id, child: Text('${s.name} (${s.code})')),
                  ],
                  onChanged: (v) => setSt(() => schoolId = v),
                ),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: saving ? 'Creating…' : 'Create admin',
                color: _accent,
                onPressed: saving ? null : submit,
              ),
            ],
          ),
        ),
      );
    }),
  );
}

/// Post-create sheet showing the set-password invite link (email delivery may
/// not be wired), mirroring the web console's invite panel.
void _showInviteSheet(BuildContext context,
    {required String email, required String url}) {
  _showGlassSheet<void>(
    context: context,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Iconsax.tick_circle,
                  size: 20, color: AppColors.success),
              const SizedBox(width: 8),
              const Text('Invite sent', style: _sheetTitle),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            "Sent to $email. They'll set a password to activate the account.",
            style: const TextStyle(fontSize: 13, color: _mut, height: 1.4),
          ),
          const SizedBox(height: 16),
          const _Label('Set-password link'),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _line),
            ),
            child: SelectableText(url,
                style: const TextStyle(
                    fontFamily: 'monospace', fontSize: 12, color: _ink)),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  label: 'Copy link',
                  color: _ink,
                  icon: Iconsax.copy,
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: url));
                    if (context.mounted) {
                      AppToast.show(context, 'Link copied',
                          type: ToastType.success);
                    }
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: PrimaryButton(
                  label: 'Done',
                  color: _accent,
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

// ── Settings (account + sign out; web keeps this in the sidebar) ────────────

class SuperAdminSettingsScreen extends StatelessWidget {
  const SuperAdminSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = AuthApi.instance.currentSession;
    final pad = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          _backdrop(),
          SafeArea(
            bottom: false,
            child: ListView(
              padding: EdgeInsets.fromLTRB(20, 4, 20, 24 + pad),
              children: [
                const _PageTitle('Settings'),
                const _Label('Account'),
                _glass(
                  child: Row(
                    children: [
                      _Avatar(session?.email ?? 'S'),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(session?.email ?? '—',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: _name),
                            const SizedBox(height: 2),
                            const Text('Platform super admin', style: _sub),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const _Label('Legal'),
                _glass(
                  padding: EdgeInsets.zero,
                  child: _ActionRow(
                    icon: Iconsax.shield_tick,
                    title: 'Privacy Policy',
                    onTap: () => Navigator.of(context).push(
                      neuRoute(
                        const PrivacyPolicyScreen(accent: _accent),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const _Label('Session'),
                _glass(
                  padding: EdgeInsets.zero,
                  child: _ActionRow(
                    icon: Iconsax.logout,
                    title: 'Log out',
                    color: AppColors.danger,
                    onTap: () => confirmLogout(context),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Payment gateway (super admin enters each school's Razorpay keys) ────────
//
// Fees move parent → school directly, into the school's OWN Razorpay account,
// so the platform never holds the money. The school hands over its keys and
// the super admin enters them here; the school's own admin can neither see nor
// change them (the endpoints are super-admin-only).

/// Status card on the school detail page — tap to edit.
class _PaymentGatewaySection extends StatefulWidget {
  const _PaymentGatewaySection({
    required this.schoolId,
    required this.schoolName,
  });
  final String schoolId;
  final String schoolName;

  @override
  State<_PaymentGatewaySection> createState() => _PaymentGatewaySectionState();
}

class _PaymentGatewaySectionState extends State<_PaymentGatewaySection> {
  PaymentGatewayStatus? _status;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    // Post-frame: ServicesScope lookups aren't allowed inside initState.
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    try {
      final s = await context.services.schools.paymentGateway(widget.schoolId);
      if (!mounted) return;
      setState(() {
        _status = s;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _errorText(e);
          _loading = false;
        });
      }
    }
  }

  Future<void> _edit() async {
    final saved = await _showGlassSheet<bool>(
      context: context,
      scrollable: true,
      child: _PaymentGatewaySheet(
        schoolId: widget.schoolId,
        schoolName: widget.schoolName,
        current: _status,
      ),
    );
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return _glass(
        child: const Center(
          child: Padding(
            padding: EdgeInsets.all(8),
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: _accent),
            ),
          ),
        ),
      );
    }
    if (_error != null) {
      return _glass(
        child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
      );
    }

    final s = _status!;
    final label = s.enabled
        ? 'Live'
        : s.isConfigured
            ? 'Set up - paused'
            : 'Not set up';
    final chip = s.enabled
        ? ChipType.success
        : s.isConfigured
            ? ChipType.warning
            : ChipType.neutral;

    return _glass(
      child: InkWell(
        onTap: _edit,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text('Razorpay account',
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: _ink)),
                ),
                StatusChip(label: label, type: chip),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              s.isConfigured
                  ? 'Key ${s.keyId}'
                  : 'Parents can only pay at the office until this is set up.',
              style: _sub,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Iconsax.edit_2, size: 16, color: _accent),
                const SizedBox(width: 6),
                Text(s.isConfigured ? 'Edit keys' : 'Add keys',
                    style: const TextStyle(
                        color: _accent,
                        fontWeight: FontWeight.w600,
                        fontSize: 13)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Edit sheet. Secrets are write-only — the API never returns them, so a blank
/// field means "keep what is stored" rather than "clear it".
class _PaymentGatewaySheet extends StatefulWidget {
  const _PaymentGatewaySheet({
    required this.schoolId,
    required this.schoolName,
    required this.current,
  });
  final String schoolId;
  final String schoolName;
  final PaymentGatewayStatus? current;

  @override
  State<_PaymentGatewaySheet> createState() => _PaymentGatewaySheetState();
}

class _PaymentGatewaySheetState extends State<_PaymentGatewaySheet> {
  late final _keyId = TextEditingController(text: widget.current?.keyId ?? '');
  final _keySecret = TextEditingController();
  final _webhookSecret = TextEditingController();
  late bool _enabled = widget.current?.enabled ?? false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _keyId.dispose();
    _keySecret.dispose();
    _webhookSecret.dispose();
    super.dispose();
  }

  bool get _hasKeySecret => widget.current?.hasKeySecret ?? false;
  bool get _hasWebhookSecret => widget.current?.hasWebhookSecret ?? false;

  /// The URL this school pastes into its own Razorpay dashboard. Each school
  /// signs with its own webhook secret, so each gets its own callback path.
  String get _webhookUrl =>
      '${DioClient.instance.dio.options.baseUrl}/fees/webhook/razorpay/${widget.schoolId}';

  Future<void> _save() async {
    final keyId = _keyId.text.trim();
    if (keyId.isEmpty) {
      setState(() => _error = 'Key ID is required.');
      return;
    }
    if (!_hasKeySecret && _keySecret.text.trim().isEmpty) {
      setState(() => _error = 'Key secret is required the first time.');
      return;
    }
    // Enabling without a webhook secret would let payments start but never be
    // confirmed — the backend refuses it too, this just says so sooner.
    if (_enabled && !_hasWebhookSecret && _webhookSecret.text.trim().isEmpty) {
      setState(() => _error =
          'A webhook secret is needed before payments can be enabled.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.services.schools.savePaymentGateway(
        widget.schoolId,
        keyId: keyId,
        keySecret: _keySecret.text.trim(),
        webhookSecret: _webhookSecret.text.trim(),
        enabled: _enabled,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _errorText(e);
        });
      }
    }
  }

  Future<void> _remove() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.services.schools.clearPaymentGateway(widget.schoolId);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _errorText(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Online fee payments', style: _sheetTitle),
          const SizedBox(height: 2),
          Text(
            '${widget.schoolName} collects into its own Razorpay account - ask the school for these from their dashboard.',
            style: _sub,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _keyId,
            decoration: _dec('Key ID'),
            autocorrect: false,
            textCapitalization: TextCapitalization.none,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _keySecret,
            obscureText: true,
            autocorrect: false,
            decoration: _dec(_hasKeySecret
                ? 'Key secret (stored - leave blank to keep)'
                : 'Key secret'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _webhookSecret,
            obscureText: true,
            autocorrect: false,
            decoration: _dec(_hasWebhookSecret
                ? 'Webhook secret (stored - leave blank to keep)'
                : 'Webhook secret'),
          ),
          const SizedBox(height: 16),
          const Text('Webhook URL for this school',
              style: TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 13, color: _ink)),
          const SizedBox(height: 2),
          const Text(
            'The school adds this in Razorpay - Settings - Webhooks, subscribed to payment.captured and payment.failed.',
            style: _sub,
          ),
          const SizedBox(height: 8),
          InkWell(
            onTap: () async {
              await Clipboard.setData(ClipboardData(text: _webhookUrl));
              if (!context.mounted) return;
              AppToast.show(context, 'Webhook URL copied',
                  type: ToastType.success);
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _faint,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _line),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(_webhookUrl,
                        style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: _mut)),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Iconsax.copy, size: 16, color: _accent),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            value: _enabled,
            activeThumbColor: _accent,
            onChanged: (v) => setState(() => _enabled = v),
            title: const Text('Accept online payments',
                style: TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14, color: _ink)),
            subtitle: const Text(
              'Off means parents only see "pay at school".',
              style: _sub,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Save payment settings',
            isLoading: _saving,
            color: _accent,
            onPressed: _saving ? null : _save,
          ),
          if (widget.current?.isConfigured ?? false) ...[
            const SizedBox(height: 8),
            SecondaryButton(
              label: 'Remove credentials',
              color: AppColors.danger,
              onPressed: _saving ? null : _remove,
            ),
          ],
        ],
      ),
    );
  }
}

// ── Subscription (school → Sproutly) ──────────────────────────────────────
//
// The other direction of money from _PaymentGatewaySection above: that one is
// how a school collects fees from its parents, this one is what the school
// pays the platform. Keeping them adjacent but clearly named is deliberate —
// confusing the two would be an expensive mistake.

/// A school's billing position, with the controls to move it along.
class _SubscriptionSection extends StatefulWidget {
  const _SubscriptionSection({
    required this.schoolId,
    required this.schoolName,
  });
  final String schoolId;
  final String schoolName;

  @override
  State<_SubscriptionSection> createState() => _SubscriptionSectionState();
}

class _SubscriptionSectionState extends State<_SubscriptionSection> {
  SubscriptionState? _state;
  List<SubscriptionInvoice> _invoices = const [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    try {
      final api = SubscriptionApi.instance;
      final results = await Future.wait<dynamic>([
        api.forSchool(widget.schoolId),
        api.invoicesForSchool(widget.schoolId),
      ]);
      if (!mounted) return;
      setState(() {
        _state = results[0] as SubscriptionState;
        _invoices = (results[1] as List).cast<SubscriptionInvoice>();
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _errorText(e);
          _loading = false;
        });
      }
    }
  }

  Future<void> _raise() async {
    final created = await _showGlassSheet<bool>(
      context: context,
      scrollable: true,
      child: _RaiseInvoiceSheet(
        schoolId: widget.schoolId,
        schoolName: widget.schoolName,
      ),
    );
    if (created == true) await _load();
  }

  Future<void> _settle(SubscriptionInvoice invoice) async {
    final paid = await _showGlassSheet<bool>(
      context: context,
      scrollable: true,
      child: _RecordSubscriptionPaymentSheet(invoice: invoice),
    );
    if (paid == true) await _load();
  }

  Future<void> _cancel(SubscriptionInvoice invoice) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel this invoice?'),
        content: Text(
          '${invoice.invoiceNumber} for ${formatRupees(invoice.amount)} will be '
          'voided. Do this to correct a mistake — the school can then be billed '
          'again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep it'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Cancel invoice'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await SubscriptionApi.instance.cancelInvoice(invoice.id);
      await _load();
    } catch (e) {
      if (mounted) AppToast.show(context, _errorText(e), type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return _glass(
        child: const Center(
          child: Padding(
            padding: EdgeInsets.all(8),
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: _accent),
            ),
          ),
        ),
      );
    }
    if (_error != null) {
      return _glass(
        child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
      );
    }

    final state = _state!;
    final outstanding = state.outstanding;
    final unbilled = state.phase == SubscriptionPhase.unbilled;
    final days = state.daysRemaining;

    return _glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(unbilled ? 'Status' : 'Active until', style: _sub),
                    const SizedBox(height: 2),
                    Text(
                      unbilled ? 'Never billed' : _date(state.periodEnd),
                      style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: _ink),
                    ),
                    if (days != null)
                      Text(
                        days >= 0
                            ? '$days day${days == 1 ? '' : 's'} remaining'
                            : '${-days} day${days == -1 ? '' : 's'} overdue',
                        style: _sub,
                      ),
                  ],
                ),
              ),
              StatusChip(
                label: state.phase.label,
                type: _phaseChip(state.phase),
              ),
            ],
          ),

          // The one unpaid invoice, if any — only one can exist at a time, so
          // the school is never left guessing which to pay.
          if (outstanding != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${outstanding.invoiceNumber} · '
                    '${outstanding.isFree ? 'Free' : formatRupees(outstanding.amount)}',
                    style: _name,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${outstanding.durationText} · raised ${_date(outstanding.issuedAt)} · '
                    '${outstanding.isFree ? 'the school activates it' : 'awaiting payment'}',
                    style: _sub,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: PrimaryButton(
                          label: 'Record payment',
                          color: _accent,
                          onPressed: () => _settle(outstanding),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: () => _cancel(outstanding),
                        tooltip: 'Cancel invoice',
                        icon: const Icon(Iconsax.trash,
                            size: 18, color: AppColors.danger),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Record a payment only for money taken at your office — '
                    'anything paid online settles itself through Razorpay.',
                    style: _sub,
                  ),
                ],
              ),
            ),
          ] else ...[
            const SizedBox(height: 14),
            PrimaryButton(
              label: 'Raise an invoice',
              color: _accent,
              onPressed: _raise,
            ),
          ],

          if (_invoices.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('History',
                style: TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 13, color: _ink)),
            const SizedBox(height: 6),
            for (var i = 0; i < _invoices.length; i++) ...[
              if (i > 0) _gdiv,
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_invoices[i].invoiceNumber, style: _name),
                          Text(
                            '${_date(_invoices[i].periodStart)} → ${_date(_invoices[i].periodEnd)}'
                            '${_invoices[i].paidAt == null ? '' : ' · ${_invoices[i].settlementLabel}'}',
                            style: _sub,
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                            _invoices[i].isFree
                                ? 'Free'
                                : formatRupees(_invoices[i].amount),
                            style: _name),
                        Text(_invoices[i].status.label, style: _sub),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

ChipType _phaseChip(SubscriptionPhase phase) => switch (phase) {
      SubscriptionPhase.active => ChipType.success,
      SubscriptionPhase.expiring => ChipType.warning,
      SubscriptionPhase.grace => ChipType.warning,
      SubscriptionPhase.adminLocked => ChipType.danger,
      SubscriptionPhase.locked => ChipType.danger,
      SubscriptionPhase.unbilled => ChipType.neutral,
    };

/// Bills a school for an arbitrary stretch of days.
///
/// Days rather than fixed plans on purpose: a 15-day trial and a two-year
/// contract are the same shape here, just different numbers.
class _RaiseInvoiceSheet extends StatefulWidget {
  const _RaiseInvoiceSheet({required this.schoolId, required this.schoolName});
  final String schoolId;
  final String schoolName;

  @override
  State<_RaiseInvoiceSheet> createState() => _RaiseInvoiceSheetState();
}

class _RaiseInvoiceSheetState extends State<_RaiseInvoiceSheet> {
  static const _presets = [
    ('15 days', 15),
    ('1 month', 30),
    ('3 months', 90),
    ('6 months', 180),
    ('1 year', 365),
  ];

  final _amount = TextEditingController();
  final _days = TextEditingController(text: '365');
  final _label = TextEditingController(text: '1 year');
  final _notes = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _days.dispose();
    _label.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final amount = double.tryParse(_amount.text.trim());
    final days = int.tryParse(_days.text.trim());
    if (amount == null || amount < 0) {
      setState(() => _error = 'Enter a valid amount.');
      return;
    }
    if (days == null || days < 1 || days > 3650) {
      setState(() => _error = 'Duration must be between 1 and 3650 days.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await SubscriptionApi.instance.createInvoice(
        widget.schoolId,
        amount: amount,
        durationDays: days,
        durationLabel: _label.text.trim(),
        notes: _notes.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _errorText(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentDays = int.tryParse(_days.text.trim());
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Raise a subscription invoice', style: _sheetTitle),
          const SizedBox(height: 2),
          Text(
            '${widget.schoolName} will see this as due, and can pay online or at your office.',
            style: _sub,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: _dec('Amount', prefix: '₹ '),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final p in _presets)
                ChoiceChip(
                  label: Text(p.$1, style: const TextStyle(fontSize: 12)),
                  selected: currentDays == p.$2,
                  selectedColor: _accent.withValues(alpha: 0.15),
                  onSelected: (_) => setState(() {
                    _days.text = '${p.$2}';
                    _label.text = p.$1;
                  }),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _days,
                  keyboardType: TextInputType.number,
                  decoration: _dec('Days'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _label,
                  maxLength: 40,
                  decoration: _dec('Shown as'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            maxLines: 2,
            maxLength: 500,
            decoration: _dec('Notes (optional)'),
          ),
          const SizedBox(height: 4),
          const Text(
            'The period is set when the invoice is paid, not now — paying early '
            'adds to whatever is left, so nothing already bought is lost.',
            style: _sub,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Raise invoice',
            isLoading: _saving,
            color: _accent,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}

/// Money taken at the platform owner's office — the offline half of the two
/// ways a school can settle.
class _RecordSubscriptionPaymentSheet extends StatefulWidget {
  const _RecordSubscriptionPaymentSheet({required this.invoice});
  final SubscriptionInvoice invoice;

  @override
  State<_RecordSubscriptionPaymentSheet> createState() =>
      _RecordSubscriptionPaymentSheetState();
}

class _RecordSubscriptionPaymentSheetState
    extends State<_RecordSubscriptionPaymentSheet> {
  static const _methods = [
    ('cash', 'Cash'),
    ('upi', 'UPI'),
    ('bank_transfer', 'Bank transfer'),
    ('cheque', 'Cheque'),
    ('card', 'Card'),
  ];

  String _method = 'cash';
  final _reference = TextEditingController();
  DateTime _paidAt = DateTime.now();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _reference.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await SubscriptionApi.instance.recordPayment(
        widget.invoice.id,
        method: _method,
        reference: _reference.text.trim(),
        paidAt: _paidAt,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _errorText(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Record an office payment', style: _sheetTitle),
          const SizedBox(height: 2),
          Text(
            '${widget.invoice.invoiceNumber} · ${formatRupees(widget.invoice.amount)}',
            style: _sub,
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final m in _methods)
                ChoiceChip(
                  label: Text(m.$2, style: const TextStyle(fontSize: 12)),
                  selected: _method == m.$1,
                  selectedColor: _accent.withValues(alpha: 0.15),
                  onSelected: (_) => setState(() => _method = m.$1),
                ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reference,
            maxLength: 120,
            decoration: _dec('Reference (optional)'),
          ),
          const SizedBox(height: 4),
          // Back-dating matters: the new period is measured from when the
          // money actually arrived, not from now.
          InkWell(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _paidAt,
                firstDate: DateTime.now().subtract(const Duration(days: 365)),
                lastDate: DateTime.now(),
              );
              if (picked != null) setState(() => _paidAt = picked);
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _faint,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _line),
              ),
              child: Row(
                children: [
                  const Text('Received on', style: _sub),
                  const Spacer(),
                  Text(_date(_paidAt), style: _name),
                  const SizedBox(width: 8),
                  const Icon(Iconsax.calendar, size: 16, color: _accent),
                ],
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Mark as paid',
            isLoading: _saving,
            color: _accent,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}
