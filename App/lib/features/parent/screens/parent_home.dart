import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/models/student.dart';
import '../../../core/network/auth_api.dart';
import '../../../core/network/parent_api.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';
import '../widgets/max_kit.dart';
import '../../shared/notification_bell.dart';
import '../screens/parent_academics.dart';
import '../screens/parent_attendance.dart';
import '../screens/parent_fees.dart';
import '../screens/parent_student_profile.dart';
import '../screens/complete_profile_screen.dart';

/// Parent home — a loud "maximalism" dashboard: a soft-pink canvas with bold
/// flat colour blocks (a bright-green hero child card, an ink-black status
/// card, grape/ink stat tiles), pill controls and chunky rounded type. All the
/// content is real (children, diary, attendance, fees, events, homework).
class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({super.key});

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  late Future<List<Student>> _future;
  late Future<List<EventModel>> _eventsFuture;
  Future<double>? _duesFuture;
  Future<({int present, int total})>? _attendanceFuture;
  Student? _selected;

  @override
  void initState() {
    super.initState();
    _eventsFuture = ParentApi.instance.getEvents();
    _load();
  }

  void _load() {
    _future = ParentApi.instance.getMyChildren().then((list) {
      if (list.isNotEmpty && _selected == null) {
        final sel = ParentApi.instance.selectedChild.value ?? list.first;
        setState(() {
          _selected = sel;
          _duesFuture = _duesFor(sel);
          _attendanceFuture = _attendanceFor(sel);
        });
      }
      return list;
    });
  }

  void _select(Student s) {
    setState(() {
      _selected = s;
      _duesFuture = _duesFor(s);
      _attendanceFuture = _attendanceFor(s);
    });
    ParentApi.instance.selectedChild.value = s;
  }

  Future<double> _duesFor(Student s) async {
    final invoices = await ParentApi.instance.getStudentDues(s.id);
    return invoices.fold<double>(0, (a, b) => a + b.balance);
  }

  /// Present-day count over the trailing 30 days for the stat tile + the
  /// status-card progress bar.
  Future<({int present, int total})> _attendanceFor(Student s) async {
    final now = DateTime.now();
    final from = now.subtract(const Duration(days: 29));
    String fmt(DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    final days =
        await ParentApi.instance.getAttendanceRange(s.id, fmt(from), fmt(now));
    final marked =
        days.where((d) => d.status.isNotEmpty && d.status != 'unmarked');
    final present = marked.where((d) => d.status == 'present').length;
    return (present: present, total: marked.length);
  }

  Future<void> _openCompleteProfile(Student s) async {
    final done = await Navigator.of(context).push<bool>(
      neuRoute(CompleteProfileScreen(student: s)),
    );
    if (done == true && mounted) {
      AppToast.show(context, 'Profile completed', type: ToastType.success);
      setState(() {
        _selected = null;
        _load();
      });
    }
  }

  void _openProfile() {
    if (_selected != null) {
      Navigator.of(context).push(
        neuRoute(ParentStudentProfileScreen(student: _selected)),
      );
    }
  }

  String get _parentName {
    final session = AuthApi.instance.currentSession;
    if (session == null) return 'Parent';
    final email = session.email;
    if (email.isEmpty) return 'Parent';
    return email.split('@').first.replaceAll('.', ' ');
  }

  String get _prettyName => _parentName
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .map((w) => w[0].toUpperCase() + w.substring(1))
      .join(' ');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Max.canvas,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: Max.grape,
          onRefresh: () async {
            setState(() {
              _selected = null;
              _load();
            });
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics()),
            slivers: [
              // ── Header: avatar + greeting + bell ─────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: _openProfile,
                        child: Container(
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: Max.softShadow,
                          ),
                          child: _HeaderAvatar(
                              name: _parentName, student: _selected),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Welcome back!',
                                style: Max.body(12.5,
                                    w: FontWeight.w700, color: Max.textMuted)),
                            const SizedBox(height: 1),
                            Text(
                              _prettyName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Max.display(21, w: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      const NotificationBell(),
                    ],
                  ),
                ),
              ),

              // ── Search pill ──────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: MaxSearchPill(
                    hint: 'Search academics & activities',
                    onTap: () => Navigator.of(context).push(
                      neuRoute(const ParentAcademicsScreen()),
                    ),
                  ),
                ),
              ),

              // ── Child selector (segmented) ───────────────────────
              SliverToBoxAdapter(
                child: FutureBuilder<List<Student>>(
                  future: _future,
                  builder: (_, snap) {
                    final children = snap.data ?? const <Student>[];
                    if (children.length < 2) return const SizedBox.shrink();
                    final selIndex = children
                        .indexWhere((c) => c.id == _selected?.id)
                        .clamp(0, children.length - 1);
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                      child: MaxSegmented(
                        selectedIndex: selIndex,
                        onChanged: (i) => _select(children[i]),
                        items: [
                          for (final c in children.take(3))
                            (
                              label: c.firstName,
                              icon: Iconsax.user,
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              // ── Hero child block + ink status card ───────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: _selected == null
                      ? const _HeroSkeleton()
                      : Column(
                          children: [
                            _HeroChildCard(
                              student: _selected!,
                              onTap: _openProfile,
                            ),
                            const SizedBox(height: 12),
                            _StatusInkCard(
                              student: _selected!,
                              attendance: _attendanceFuture,
                              onOpenAttendance: () =>
                                  Navigator.of(context).push(
                                neuRoute(ParentAttendanceScreen(
                                    studentId: _selected?.id)),
                              ),
                            ),
                          ],
                        )
                          .animate()
                          .fadeIn(duration: 360.ms, curve: Curves.easeOut)
                          .slideY(begin: 0.06, curve: Curves.easeOutCubic),
                ),
              ),

              // ── Complete-profile nudge ───────────────────────────
              if (_selected != null && !_selected!.profileCompleted)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: _CompleteProfileBanner(
                      name: _selected!.firstName,
                      onTap: () => _openCompleteProfile(_selected!),
                    ),
                  ),
                ),

              // ── Your stats ───────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
                  child: MaxSectionHeader(
                    title: 'Your stats',
                    actionLabel: 'View all',
                    onAction: () => Navigator.of(context).push(
                      neuRoute(ParentAttendanceScreen(
                          studentId: _selected?.id)),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: FutureBuilder<({int present, int total})>(
                          future: _attendanceFuture,
                          builder: (_, snap) {
                            final v = snap.data;
                            final value = _selected == null
                                ? '—'
                                : (v == null ? '…' : '${v.present}');
                            return MaxStatCard(
                              value: value,
                              label: 'Days present',
                              icon: Iconsax.calendar_tick,
                              color: Max.grape,
                              onTap: () => Navigator.of(context).push(
                                neuRoute(ParentAttendanceScreen(
                                    studentId: _selected?.id)),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FutureBuilder<double>(
                          future: _duesFuture,
                          builder: (_, snap) {
                            final total = snap.data ?? 0;
                            final value = _selected == null
                                ? '—'
                                : (snap.connectionState ==
                                            ConnectionState.waiting &&
                                        !snap.hasData)
                                    ? '…'
                                    : (total <= 0
                                        ? 'Clear'
                                        : Formatters.formatRupees(total));
                            return MaxStatCard(
                              value: value,
                              label: 'Fees due',
                              icon: Iconsax.money_recive,
                              color: Max.ink,
                              iconBg: Max.grape,
                              onTap: () => Navigator.of(context)
                                  .push(neuRoute(const ParentFeesScreen())),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Today's diary ────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const MaxSectionHeader(title: "Today's diary"),
                      const SizedBox(height: 14),
                      if (_selected == null)
                        MaxCard(
                          child: Text('Select a child to see their day.',
                              style: Max.body(13.5, color: Max.textMuted)),
                        )
                      else
                        FutureBuilder<DiaryModel>(
                          key: ValueKey('diary-${_selected!.id}'),
                          future: ParentApi.instance.getDiary(_selected!.id),
                          builder: (_, snap) {
                            final entries = _lastDiaryUpdate(
                                snap.data?.entries ?? const <DiaryEntry>[]);
                            if (snap.connectionState ==
                                ConnectionState.waiting) {
                              return const MaxCard(
                                child: Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(8),
                                    child: CircularProgressIndicator(
                                        color: Max.grape),
                                  ),
                                ),
                              );
                            }
                            if (entries.isEmpty) {
                              return MaxCard(
                                child: Text(
                                    'No diary updates yet today — check back later!',
                                    style:
                                        Max.body(13, color: Max.textMuted)),
                              );
                            }
                            return MaxCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  for (int i = 0; i < entries.length; i++) ...[
                                    if (i > 0) const SizedBox(height: 14),
                                    _DiaryRow(
                                      label: _diaryLabel(entries[i].kind),
                                      value: entries[i].subtitle == null
                                          ? entries[i].title
                                          : '${entries[i].title} • ${entries[i].subtitle}',
                                      icon: _diaryIcon(entries[i].kind),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ),

              // ── Upcoming events ──────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
                  child: FutureBuilder<List<EventModel>>(
                    future: _eventsFuture,
                    builder: (_, snap) {
                      final now = DateTime.now();
                      final events = (snap.data ?? const <EventModel>[])
                          .where((e) => e.audience != 'teachers')
                          .where((e) =>
                              e.startDate == null ||
                              !e.startDate!.isBefore(
                                  DateTime(now.year, now.month, now.day)))
                          .take(4)
                          .toList();
                      if (events.isEmpty) return const SizedBox.shrink();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const MaxSectionHeader(title: 'Upcoming events'),
                          const SizedBox(height: 14),
                          for (final e in events)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _UpcomingEventCard(event: e),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ),

              // ── Due soon (homework) ──────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      MaxSectionHeader(
                        title: 'Due soon',
                        actionLabel: 'See all',
                        onAction: () => Navigator.of(context)
                            .push(neuRoute(const ParentAcademicsScreen())),
                      ),
                      const SizedBox(height: 14),
                      if (_selected?.classId == null)
                        MaxCard(
                          child: Text('No class assigned yet.',
                              style: Max.body(13.5, color: Max.textMuted)),
                        )
                      else
                        FutureBuilder<List<HomeworkModel>>(
                          key: ValueKey('hw-${_selected!.classId}'),
                          future: ParentApi.instance
                              .getHomework(_selected!.classId!),
                          builder: (_, snap) {
                            final items =
                                (snap.data ?? const <HomeworkModel>[])
                                    .take(3)
                                    .toList();
                            if (items.isEmpty) {
                              return MaxCard(
                                child: Text('No homework right now — enjoy!',
                                    style:
                                        Max.body(13, color: Max.textMuted)),
                              );
                            }
                            return MaxCard(
                              padding: const EdgeInsets.all(10),
                              child: Column(
                                children: [
                                  for (int i = 0; i < items.length; i++) ...[
                                    if (i > 0) const SizedBox(height: 4),
                                    _HomeworkRow(
                                      subject: items[i].subject,
                                      title: items[i].title,
                                      due: items[i].dueDate == null
                                          ? ''
                                          : 'Due ${Formatters.formatShortDate(items[i].dueDate!)}',
                                      onTap: () => _openHomeworkDetail(
                                          context, items[i]),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 110)),
            ],
          ),
        ),
      ),
    );
  }

  /// Teachers may send several updates during the day; parents see only the
  /// most recent one. One "send" posts its sections within seconds of each
  /// other, so entries near the newest timestamp form the last update.
  static List<DiaryEntry> _lastDiaryUpdate(List<DiaryEntry> entries) {
    final stamped = entries.where((e) => e.when != null);
    if (stamped.isEmpty) return entries;
    final newest =
        stamped.map((e) => e.when!).reduce((a, b) => a.isAfter(b) ? a : b);
    const window = Duration(minutes: 2);
    return entries
        .where((e) => e.when != null && newest.difference(e.when!) <= window)
        .toList();
  }

  static String _diaryLabel(String kind) => switch (kind) {
        'meal' => 'Meal',
        'nap' => 'Nap',
        'activity' => 'Activity',
        'health' => 'Health',
        'observation' => 'Mood',
        _ => 'Update',
      };

  static IconData _diaryIcon(String kind) => switch (kind) {
        'meal' => Iconsax.cake,
        'nap' => Iconsax.moon,
        'activity' => Iconsax.colorfilter,
        'health' => Iconsax.health,
        'observation' => Iconsax.emoji_happy,
        _ => Iconsax.note,
      };

  void _openHomeworkDetail(BuildContext context, HomeworkModel hw) {
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(hw.subject,
                style: Max.body(12, w: FontWeight.w700, color: Max.textMuted)),
            const SizedBox(height: 4),
            Text(hw.title, style: Max.display(20, w: FontWeight.w600)),
            const SizedBox(height: 10),
            Row(
              children: [
                const StatusChip(label: 'Pending', type: ChipType.warning),
                const SizedBox(width: 8),
                if (hw.dueDate != null)
                  Text('Due ${Formatters.formatShortDate(hw.dueDate!)}',
                      style: Max.body(12, color: Max.textMuted)),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              hw.description ??
                  'Help your child complete this at home and hand it to the teacher.',
              style: Max.body(13.5, color: Max.textMuted, h: 1.45),
            ),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Got it',
              fullWidth: true,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Header avatar ────────────────────────────────────────────

class _HeaderAvatar extends StatelessWidget {
  const _HeaderAvatar({required this.name, required this.student});
  final String name;
  final Student? student;

  @override
  Widget build(BuildContext context) {
    if (student != null) {
      return AnimalAvatar(
          seed: student!.fullName, gender: student!.gender, size: 48);
    }
    return InitialAvatar(name: name, size: 48, color: Max.grape);
  }
}

// ── Hero child card (bright-green flat block) ────────────────

class _HeroChildCard extends StatelessWidget {
  const _HeroChildCard({required this.student, required this.onTap});
  final Student student;
  final VoidCallback onTap;

  String get _age {
    final dob = student.dateOfBirth;
    if (dob == null) return '';
    final now = DateTime.now();
    int years = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      years--;
    }
    if (years <= 0) {
      int months = (now.year - dob.year) * 12 + now.month - dob.month;
      if (now.day < dob.day) months--;
      return months <= 0 ? '' : '$months mo';
    }
    return '$years yrs';
  }

  @override
  Widget build(BuildContext context) {
    const onGreen = Color(0xFF10331A);
    final meta = <Widget>[
      if (student.className != null && student.className!.isNotEmpty)
        MaxMetaChip(
            icon: Iconsax.teacher, label: student.className!, color: onGreen),
      if (_age.isNotEmpty)
        MaxMetaChip(icon: Iconsax.cake, label: _age, color: onGreen),
    ];
    return MaxCard(
      color: Max.green,
      onTap: onTap,
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('My little one',
                        style: Max.body(12.5,
                            w: FontWeight.w800,
                            color: onGreen.withValues(alpha: 0.7))),
                    const SizedBox(height: 4),
                    Text(
                      student.fullName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Max.display(27,
                          w: FontWeight.w600, color: onGreen, h: 1.05),
                    ),
                  ],
                ),
              ),
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: onGreen.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_outward_rounded,
                    color: onGreen, size: 22),
              ),
            ],
          ),
          if (meta.isNotEmpty) ...[
            const SizedBox(height: 16),
            Wrap(spacing: 16, runSpacing: 8, children: meta),
          ],
        ],
      ),
    );
  }
}

// ── Ink status card (attendance snapshot + CTA) ──────────────

class _StatusInkCard extends StatelessWidget {
  const _StatusInkCard({
    required this.student,
    required this.attendance,
    required this.onOpenAttendance,
  });
  final Student student;
  final Future<({int present, int total})>? attendance;
  final VoidCallback onOpenAttendance;

  @override
  Widget build(BuildContext context) {
    return MaxCard(
      color: Max.ink,
      padding: const EdgeInsets.all(18),
      child: FutureBuilder<({int present, int total})>(
        future: attendance,
        builder: (_, snap) {
          final v = snap.data;
          final ratio =
              (v == null || v.total == 0) ? 0.0 : v.present / v.total;
          final pct = (ratio * 100).round();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.10),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Iconsax.calendar_tick,
                        color: Max.green, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Attendance this month',
                            style: Max.body(13,
                                w: FontWeight.w700,
                                color: Max.onInk.withValues(alpha: 0.7))),
                        const SizedBox(height: 2),
                        Text(
                          v == null
                              ? 'Loading…'
                              : (v.total == 0
                                  ? 'No days marked yet'
                                  : '${v.present} of ${v.total} days present'),
                          style: Max.display(16,
                              w: FontWeight.w600, color: Max.onInk),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: Stack(
                  children: [
                    Container(
                      height: 8,
                      color: Colors.white.withValues(alpha: 0.12),
                    ),
                    LayoutBuilder(
                      builder: (_, c) => Container(
                        height: 8,
                        width: c.maxWidth * ratio.clamp(0.0, 1.0),
                        decoration: BoxDecoration(
                          color: Max.green,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Text(v == null ? '' : '$pct% present',
                      style: Max.body(12.5,
                          w: FontWeight.w800,
                          color: Max.green)),
                  const Spacer(),
                  _InkPillButton(
                      label: 'Attendance', onTap: onOpenAttendance),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _InkPillButton extends StatelessWidget {
  const _InkPillButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 9, 12, 9),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label,
                style: Max.body(13, w: FontWeight.w800, color: Max.ink)),
            const SizedBox(width: 6),
            Container(
              width: 22,
              height: 22,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                  color: Max.ink, shape: BoxShape.circle),
              child: const Icon(Icons.arrow_forward_rounded,
                  color: Colors.white, size: 14),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Hero skeleton (no child yet) ─────────────────────────────

class _HeroSkeleton extends StatelessWidget {
  const _HeroSkeleton();

  @override
  Widget build(BuildContext context) {
    return MaxCard(
      color: Max.green,
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('No child linked yet',
              style: Max.display(20,
                  w: FontWeight.w600, color: const Color(0xFF10331A))),
          const SizedBox(height: 6),
          Text('Your school will link your child soon.',
              style: Max.body(13,
                  color: const Color(0xFF10331A).withValues(alpha: 0.75))),
        ],
      ),
    );
  }
}

// ── Complete-profile banner ──────────────────────────────────

class _CompleteProfileBanner extends StatelessWidget {
  const _CompleteProfileBanner({required this.name, required this.onTap});
  final String name;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return MaxCard(
      onTap: onTap,
      color: Max.cardPink,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
                color: Max.grape, shape: BoxShape.circle),
            child: const Icon(Iconsax.user_edit, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Complete $name's profile",
                    style: Max.body(14, w: FontWeight.w800)),
                const SizedBox(height: 2),
                Text('Add medical, guardian & contact details',
                    style: Max.body(12, color: Max.textMuted)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: Max.grape),
        ],
      ),
    );
  }
}

// ── Upcoming event card ──────────────────────────────────────

class _UpcomingEventCard extends StatelessWidget {
  const _UpcomingEventCard({required this.event});
  final EventModel event;

  @override
  Widget build(BuildContext context) {
    final date = event.startDate;
    final subtitle = [
      if (date != null) Formatters.formatDate(date),
      if (event.venue != null && event.venue!.isNotEmpty) event.venue!,
    ].join(' · ');
    return MaxCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Max.cardPink,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Text('🎉', style: TextStyle(fontSize: 24)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(event.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Max.body(15, w: FontWeight.w800)),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Max.body(12, color: Max.textMuted)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Diary row ────────────────────────────────────────────────

class _DiaryRow extends StatelessWidget {
  const _DiaryRow(
      {required this.label, required this.value, required this.icon});
  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Max.cardPink,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: Max.grape, size: 18),
        ),
        const SizedBox(width: 12),
        Text(label, style: Max.body(13, color: Max.textMuted)),
        const Spacer(),
        Flexible(
          child: Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.end,
              style: Max.body(13, w: FontWeight.w800)),
        ),
      ],
    );
  }
}

// ── Homework row ─────────────────────────────────────────────

class _HomeworkRow extends StatelessWidget {
  const _HomeworkRow({
    required this.subject,
    required this.title,
    required this.due,
    required this.onTap,
  });
  final String subject;
  final String title;
  final String due;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Max.cardPink,
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: const Text('✏️', style: TextStyle(fontSize: 22)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(subject,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Max.body(11, color: Max.textMuted)),
                    Text(title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Max.body(14, w: FontWeight.w700)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (due.isNotEmpty)
                    Text(due,
                        maxLines: 1,
                        style: Max.body(11, color: Max.textMuted)),
                  const SizedBox(height: 4),
                  const StatusChip(label: 'Pending', type: ChipType.warning),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
