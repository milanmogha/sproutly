import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/models/app_user.dart';
import '../../../core/models/student.dart';
import '../../../core/network/admin_api.dart';
import '../../shared/student_attendance_report_screen.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neu.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/cards.dart';

/// Admin attendance dashboard — Student and Teacher tabs, both pulling from
/// the real backend for today's date.
class AdminAttendanceScreen extends StatelessWidget {
  const AdminAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Neu.bg,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          backgroundColor: Neu.bg,
          elevation: 0,
          title: const Text('Attendance'),
          bottom: const TabBar(
            indicatorColor: AppColors.adminPrimary,
            labelColor: AppColors.adminPrimary,
            unselectedLabelColor: AppColors.textMuted,
            tabs: [
              Tab(text: 'Students'),
              Tab(text: 'Teachers'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _StudentAttendanceTab(),
            _StaffAttendanceTab(),
          ],
        ),
      ),
    );
  }
}

// ── Student attendance (read-only reports) ────────────────
//
// Marking student attendance is the class teacher's job (teacher app). Admins
// browse classes → students → each student's weekly / monthly report.

class _StudentAttendanceTab extends StatefulWidget {
  const _StudentAttendanceTab();

  @override
  State<_StudentAttendanceTab> createState() => _StudentAttendanceTabState();
}

class _StudentAttendanceTabState extends State<_StudentAttendanceTab> {
  late Future<List<SchoolClass>> _classesFuture;

  @override
  void initState() {
    super.initState();
    _classesFuture = AdminApi.instance.listClasses();
  }

  void _reload() =>
      setState(() => _classesFuture = AdminApi.instance.listClasses());

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: FutureBuilder<List<SchoolClass>>(
        future: _classesFuture,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _ErrorPlaceholder(
                message: 'Could not load classes.', onRetry: _reload);
          }
          final classes = snap.data ?? [];
          if (classes.isEmpty) {
            return const _EmptyPlaceholder(
                icon: Iconsax.clipboard_text,
                message: 'No classes yet. Create a class first.');
          }
          return ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
            itemCount: classes.length,
            itemBuilder: (_, i) {
              final c = classes[i];
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  onTap: () => Navigator.push(
                    context,
                    neuRoute(_ClassStudentsReportScreen(cls: c)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color:
                              AppColors.adminPrimary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        alignment: Alignment.center,
                        child: const Icon(Iconsax.book_1,
                            color: AppColors.adminPrimary, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(c.displayName,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark)),
                            const SizedBox(height: 2),
                            Text('${c.enrolled} students · tap for reports',
                                style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12)),
                          ],
                        ),
                      ),
                      const Icon(Iconsax.arrow_right_3,
                          color: AppColors.textMuted, size: 18),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

/// Students of a class → tap to open a student's weekly / monthly report.
class _ClassStudentsReportScreen extends StatefulWidget {
  const _ClassStudentsReportScreen({required this.cls});
  final SchoolClass cls;

  @override
  State<_ClassStudentsReportScreen> createState() =>
      _ClassStudentsReportScreenState();
}

class _ClassStudentsReportScreenState
    extends State<_ClassStudentsReportScreen> {
  late Future<List<Student>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.listClassStudents(widget.cls.id);
  }

  void _reload() => setState(
      () => _future = AdminApi.instance.listClassStudents(widget.cls.id));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text('${widget.cls.displayName} · Attendance'),
      ),
      body: FutureBuilder<List<Student>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _ErrorPlaceholder(
                message: 'Could not load students.', onRetry: _reload);
          }
          final students = snap.data ?? [];
          if (students.isEmpty) {
            return const _EmptyPlaceholder(
                icon: Iconsax.people,
                message: 'No students in this class yet.');
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
              itemCount: students.length,
              itemBuilder: (_, i) {
                final s = students[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    onTap: () => Navigator.push(
                      context,
                      neuRoute(StudentAttendanceReportScreen(
                          studentName: s.fullName,
                          accent: AppColors.adminPrimary,
                          fetch: (from, to) =>
                              AdminApi.instance.getStudentAttendanceReport(
                            studentId: s.id,
                            from: from,
                            to: to,
                          ),
                          fetchHolidays: () =>
                              AdminApi.instance.listHolidays(),
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        AnimalAvatar(seed: s.fullName, gender: s.gender),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(s.fullName,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textDark)),
                              const SizedBox(height: 2),
                              Text(s.admissionNumber,
                                  style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 12)),
                            ],
                          ),
                        ),
                        const Icon(Iconsax.chart_2,
                            color: AppColors.textMuted, size: 18),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _StatusBtn extends StatelessWidget {
  const _StatusBtn({
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? color : color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label,
            style: TextStyle(
                color: selected ? Colors.white : color,
                fontWeight: FontWeight.w700,
                fontSize: 13)),
      ),
    );
  }
}

// ── Staff attendance (admin marks the roster) ─────────────

class _StaffData {
  const _StaffData({required this.roster, required this.existing});

  /// Every staff account the admin can mark (teachers, principals, etc.).
  final List<AppUser> roster;

  /// staffId → status already recorded for today ('present' | 'absent' …).
  final Map<String, String> existing;
}

class _StaffAttendanceTab extends StatefulWidget {
  const _StaffAttendanceTab();

  @override
  State<_StaffAttendanceTab> createState() => _StaffAttendanceTabState();
}

class _StaffAttendanceTabState extends State<_StaffAttendanceTab> {
  late Future<_StaffData> _future;
  final String _today = DateTime.now().toIso8601String().split('T').first;

  // Explicit taps by the admin this session; falls back to any existing
  // record, then to 'present' by default.
  final Map<String, String> _statusMap = {};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_StaffData> _load() async {
    final results = await Future.wait([
      AdminApi.instance.listStaff(),
      AdminApi.instance.getStaffAttendance(_today),
    ]);
    final users = results[0] as List<AppUser>;
    final records = results[1] as List<StaffAttendanceRecord>;
    // Only teachers' attendance is taken here.
    final roster = users.where((u) => u.role == 'Teacher').toList();
    final existing = <String, String>{
      for (final r in records) r.staffId: r.status,
    };
    return _StaffData(roster: roster, existing: existing);
  }

  void _reload() => setState(() {
        _statusMap.clear();
        _future = _load();
      });

  String _statusFor(String id, Map<String, String> existing) =>
      _statusMap[id] ?? existing[id] ?? 'present';

  Future<void> _save(_StaffData data) async {
    setState(() => _saving = true);
    try {
      final entries = data.roster
          .map((u) => {
                'staffId': u.id,
                'status': _statusFor(u.id, data.existing),
              })
          .toList();
      await AdminApi.instance
          .markStaffAttendance(date: _today, entries: entries);
      if (!mounted) return;
      AppToast.show(context, 'Teacher attendance saved',
          type: ToastType.success);
      _reload();
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  bool get _isSunday => DateTime.now().weekday == DateTime.sunday;

  /// Opens the teacher's monthly report — the same parent-style calendar the
  /// student reports use. Staff and student reports share the same shape, so
  /// the staff report is mapped onto the student model the screen renders.
  void _openReport(BuildContext context, AppUser u) {
    Navigator.push(
      context,
      neuRoute(StudentAttendanceReportScreen(
        studentName: u.name,
        accent: AppColors.adminPrimary,
        fetch: (from, to) async {
          final r = await AdminApi.instance.getStaffAttendanceReport(
              staffId: u.id, from: from, to: to);
          return StudentAttendanceReport(
            from: r.from,
            to: r.to,
            present: r.present,
            absent: r.absent,
            late: r.late,
            onLeave: r.onLeave,
            halfDay: r.halfDay,
            marked: r.marked,
            workingDays: r.workingDays,
            presentRate: r.presentRate,
            days: [
              for (final d in r.days)
                StudentAttendanceDay(date: d.date, status: d.status),
            ],
          );
        },
        fetchHolidays: () => AdminApi.instance.listHolidays(),
      )),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Attendance is taken Monday–Saturday only.
    if (_isSunday) {
      return const _EmptyPlaceholder(
        icon: Iconsax.calendar_remove,
        message:
            'It’s Sunday — a weekly holiday.\nTeacher attendance isn’t taken today.',
      );
    }
    return FutureBuilder<_StaffData>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return _ErrorPlaceholder(
              message: 'Could not load teachers.', onRetry: _reload);
        }
        final data = snap.data!;
        if (data.roster.isEmpty) {
          return const _EmptyPlaceholder(
            icon: Iconsax.teacher,
            message:
                'No teacher accounts yet.\nAdd teachers from the Staff screen first.',
          );
        }
        final present = data.roster
            .where((u) => _statusFor(u.id, data.existing) == 'present')
            .length;
        final absent = data.roster.length - present;

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
              child: Row(
                children: [
                  Expanded(
                    child: StatCard(
                        label: 'Present',
                        value: '$present',
                        icon: Iconsax.user_tick,
                        accent: AppColors.success),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: StatCard(
                        label: 'Absent',
                        value: '$absent',
                        icon: Iconsax.user_remove,
                        accent: AppColors.danger),
                  ),
                ],
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async => _reload(),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
                  children: [
                    for (final u in data.roster)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: AppCard(
                          onTap: () => _openReport(context, u),
                          child: Row(
                            children: [
                              InitialAvatar(
                                  name: u.name,
                                  color: AppColors.adminPrimary),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(u.name,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textDark)),
                                    const SizedBox(height: 2),
                                    Text('${u.role} · tap for report',
                                        style: const TextStyle(
                                            color: AppColors.textMuted,
                                            fontSize: 12)),
                                  ],
                                ),
                              ),
                              _StatusBtn(
                                label: 'P',
                                selected: _statusFor(u.id, data.existing) ==
                                    'present',
                                color: AppColors.success,
                                onTap: () => setState(
                                    () => _statusMap[u.id] = 'present'),
                              ),
                              const SizedBox(width: 6),
                              _StatusBtn(
                                label: 'A',
                                selected: _statusFor(u.id, data.existing) ==
                                    'absent',
                                color: AppColors.danger,
                                onTap: () => setState(
                                    () => _statusMap[u.id] = 'absent'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    PrimaryButton(
                      label: _saving ? 'Saving…' : 'Save teacher attendance',
                      color: AppColors.adminPrimary,
                      fullWidth: true,
                      onPressed: _saving ? null : () => _save(data),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ── Shared placeholders ────────────────────────────────────

class _EmptyPlaceholder extends StatelessWidget {
  const _EmptyPlaceholder({required this.icon, required this.message});
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.textMuted, size: 48),
            const SizedBox(height: 16),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 14)),
          ],
        ),
      ),
    );
  }
}

class _ErrorPlaceholder extends StatelessWidget {
  const _ErrorPlaceholder(
      {required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Iconsax.warning_2, color: AppColors.danger, size: 40),
          const SizedBox(height: 12),
          Text(message,
              style: const TextStyle(color: AppColors.textMuted)),
          const SizedBox(height: 12),
          SecondaryButton(
              label: 'Try again',
              color: AppColors.adminPrimary,
              onPressed: onRetry),
        ],
      ),
    );
  }
}

