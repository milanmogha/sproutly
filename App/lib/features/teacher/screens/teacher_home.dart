import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/network/admin_api.dart' show SchoolClass, AttendanceClassSummary;
import '../../../core/models/student.dart';
import '../../../core/network/auth_api.dart';
import '../../../core/network/teacher_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';
import '../../shared/notification_bell.dart';
import 'teacher_academics.dart';
import 'teacher_attendance.dart';
import 'teacher_more.dart';
import 'teacher_students.dart';

class TeacherHomeScreen extends StatefulWidget {
  const TeacherHomeScreen({super.key});

  @override
  State<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends State<TeacherHomeScreen> {
  late Future<_HomeData> _future;
  final String _today = DateTime.now().toIso8601String().split('T').first;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = _fetchHomeData();
  }

  Future<_HomeData> _fetchHomeData() async {
    final api = TeacherApi.instance;
    final classes = await api.listClasses();
    AttendanceClassSummary? summary;
    var sheet = <ClassAttendanceRecord>[];
    var events = <EventModel>[];
    if (classes.isNotEmpty) {
      final results = await Future.wait([
        api.getClassSummary(classes.first.id, _today),
        api.getClassSheet(classes.first.id, _today),
        api.getEvents(),
      ]);
      summary = results[0] as AttendanceClassSummary;
      sheet = results[1] as List<ClassAttendanceRecord>;
      events = results[2] as List<EventModel>;
    } else {
      events = await api.getEvents();
    }
    return _HomeData(
        classes: classes, summary: summary, sheet: sheet, events: events);
  }

  String get _teacherName {
    final session = AuthApi.instance.currentSession;
    if (session == null) return 'Teacher';
    final email = session.email;
    if (email.isEmpty) return 'Teacher';
    return email.split('@').first.replaceAll('.', ' ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async => setState(_load),
          child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics()),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${Formatters.greetingForHour(DateTime.now().hour)}, ${_teacherName.split(' ').first}',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark,
                            ),
                          ),
                          Text(
                            Formatters.formatDate(DateTime.now()),
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    const NotificationBell(),
                    const SizedBox(width: 12),
                    NeuBox(
                      shape: BoxShape.circle,
                      padding: const EdgeInsets.all(3),
                      child: InitialAvatar(
                          name: _teacherName,
                          color: AppColors.teacherPrimary),
                    ),
                  ],
                ),
              ),
            ),

            // Today's class card (from real API)
            SliverToBoxAdapter(
              child: FutureBuilder<_HomeData>(
                future: _future,
                builder: (_, snap) {
                  final cls = snap.data?.classes.firstOrNull;
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                    child: NeuTilt(
                      child: NeuCard(
                        shadow: Neu.floatShadow,
                        onTap: () => Navigator.of(context).push(
                          neuRoute(TeacherAttendanceMarkingScreen(
                            initialClassId: cls?.id,
                          )),
                        ),
                        child: Row(
                          children: [
                            const NeuIconWell(
                              icon: Icons.class_rounded,
                              size: 58,
                              iconSize: 30,
                              inset: true,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    cls?.displayName ?? 'Loading class…',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 16,
                                        color: AppColors.textDark),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Tap to mark attendance',
                                    style: TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded,
                                color: AppColors.textMuted),
                          ],
                        ),
                      ),
                    )
                        .animate()
                        .fadeIn(duration: 380.ms, curve: Curves.easeOut)
                        .slideY(begin: 0.08, curve: Curves.easeOutCubic),
                  );
                },
              ),
            ),

            // Quick actions — four floating neu buttons, all on screen.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
                child: Row(
                  children: [
                    _QuickAction(
                        label: 'Attendance',
                        icon: Iconsax.clipboard_text,
                        color: AppColors.teacherPrimary,
                        onTap: () => Navigator.of(context).push(
                              neuRoute(
                                  const TeacherAttendanceMarkingScreen()),
                            )),
                    _QuickAction(
                        label: 'Homework',
                        icon: Iconsax.book,
                        color: AppColors.info,
                        onTap: () => Navigator.of(context).push(
                              neuRoute(const TeacherAcademicsScreen()),
                            )),
                    _QuickAction(
                        label: 'Photos',
                        icon: Iconsax.camera,
                        color: AppColors.warning,
                        onTap: () => Navigator.of(context).push(
                              neuRoute(const TeacherGalleryUploadScreen()),
                            )),
                    _QuickAction(
                        label: 'Diary',
                        icon: Iconsax.note,
                        color: AppColors.success,
                        onTap: () => Navigator.of(context).push(
                              neuRoute(const TeacherStudentsScreen()),
                            )),
                  ]
                      .asMap()
                      .entries
                      .map((e) => Expanded(
                            child: e.value
                                .animate(delay: (120 + 70 * e.key).ms)
                                .fadeIn(
                                    duration: 360.ms, curve: Curves.easeOut)
                                .slideY(
                                    begin: 0.2,
                                    curve: Curves.easeOutCubic),
                          ))
                      .toList(),
                ),
              ),
            ),

            // Pending tasks
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Pending tasks',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textDark)),
                    const SizedBox(height: 12),
                    NeuCard(
                      onTap: () => Navigator.of(context).push(
                        neuRoute(const TeacherAttendanceMarkingScreen()),
                      ),
                      child: Row(
                        children: const [
                          Expanded(
                            child: Text('Mark attendance for Pre-Nursery A',
                                style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    color: AppColors.textDark)),
                          ),
                          StatusChip(label: 'Due', type: ChipType.warning),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    NeuCard(
                      onTap: () => _openAddRemarks(context),
                      child: Row(
                        children: const [
                          Expanded(
                            child: Text('Add 3 missing teacher remarks',
                                style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    color: AppColors.textDark)),
                          ),
                          StatusChip(label: 'Due', type: ChipType.warning),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Attendance summary donut (real, today's first class) + late arrivals
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
                child: FutureBuilder<_HomeData>(
                  future: _future,
                  builder: (_, snap) {
                    final data = snap.data;
                    final present = data?.present ?? 0;
                    final absent = data?.absent ?? 0;
                    final late = data?.late ?? 0;
                    final notMarked = data?.notMarked ?? 0;
                    final total = present + absent + late + notMarked;
                    final pct = total > 0 ? (present / total * 100).round() : 0;
                    final lateNames = (data?.sheet ?? [])
                        .where((r) => r.status == 'late')
                        .map((r) => r.studentName)
                        .toList();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        NeuCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text("Today's attendance",
                                  style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textDark)),
                              const SizedBox(height: 12),
                              SizedBox(
                                height: 160,
                                child: TweenAnimationBuilder<double>(
                                  tween: Tween(begin: 0, end: 1),
                                  duration: const Duration(milliseconds: 700),
                                  builder: (_, t, _) => Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      // Inset well behind the donut center —
                                      // the chart reads as a carved dial.
                                      const NeuBox(
                                        inset: true,
                                        shape: BoxShape.circle,
                                        child: SizedBox(
                                            width: 92, height: 92),
                                      ),
                                      PieChart(
                                        PieChartData(
                                          startDegreeOffset: -90,
                                          sectionsSpace: total == 0 ? 0 : 4,
                                          centerSpaceRadius: 50,
                                          sections: total == 0
                                              ? [
                                                  PieChartSectionData(
                                                    value: 1,
                                                    color: AppColors.mutedGray,
                                                    radius: 22,
                                                    showTitle: false,
                                                  ),
                                                ]
                                              : [
                                                  PieChartSectionData(
                                                    value: present * t,
                                                    color: AppColors.success,
                                                    radius: 22,
                                                    showTitle: false,
                                                  ),
                                                  PieChartSectionData(
                                                    value: absent * t,
                                                    color: AppColors.danger,
                                                    radius: 22,
                                                    showTitle: false,
                                                  ),
                                                  PieChartSectionData(
                                                    value: late * t,
                                                    color: AppColors.warning,
                                                    radius: 22,
                                                    showTitle: false,
                                                  ),
                                                  PieChartSectionData(
                                                    value: notMarked * t,
                                                    color: AppColors.mutedGray,
                                                    radius: 22,
                                                    showTitle: false,
                                                  ),
                                                ],
                                        ),
                                      ),
                                      Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text('$pct%',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                  fontSize: 20,
                                                  color: AppColors.textDark)),
                                          const Text('Present',
                                              style: TextStyle(
                                                  color: AppColors.textMuted,
                                                  fontSize: 12)),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 16,
                                runSpacing: 6,
                                children: [
                                  _LegendDot(
                                      color: AppColors.success,
                                      label: 'Present $present'),
                                  _LegendDot(
                                      color: AppColors.danger,
                                      label: 'Absent $absent'),
                                  _LegendDot(
                                      color: AppColors.warning,
                                      label: 'Late $late'),
                                  if (notMarked > 0)
                                    _LegendDot(
                                        color: AppColors.mutedGray,
                                        label: 'Unmarked $notMarked'),
                                ],
                              ),
                            ],
                          ),
                        ),
                        if (lateNames.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          NeuCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.schedule_rounded,
                                        size: 16, color: AppColors.warning),
                                    const SizedBox(width: 6),
                                    Text('Late arrivals today (${lateNames.length})',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 14,
                                            color: AppColors.textDark)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(lateNames.join(', '),
                                    style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 13)),
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

            // Upcoming events (real)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
                child: FutureBuilder<_HomeData>(
                  future: _future,
                  builder: (_, snap) {
                    final now = DateTime.now();
                    final events = (snap.data?.events ?? const <EventModel>[])
                        .where((e) => e.audience != 'parents')
                        .where((e) =>
                            e.startDate == null ||
                            !e.startDate!.isBefore(
                                DateTime(now.year, now.month, now.day)))
                        .take(6)
                        .toList();
                    if (events.isEmpty) return const SizedBox.shrink();
                    const colors = [
                      AppColors.warning,
                      AppColors.info,
                      AppColors.success,
                      AppColors.teacherPrimary,
                    ];
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Upcoming events',
                            style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textDark)),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 130,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              for (int i = 0; i < events.length; i++)
                                Padding(
                                  padding: const EdgeInsets.only(
                                      right: 14, bottom: 4),
                                  child: _EventTile(
                                    title: events[i].title,
                                    date: events[i].startDate == null
                                        ? ''
                                        : Formatters.formatShortDate(
                                            events[i].startDate!),
                                    color: colors[i % colors.length],
                                    emoji: '🎉',
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
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
}

class _HomeData {
  const _HomeData({
    required this.classes,
    this.summary,
    this.sheet = const [],
    this.events = const [],
  });
  final List<SchoolClass> classes;
  final AttendanceClassSummary? summary;
  final List<ClassAttendanceRecord> sheet;
  final List<EventModel> events;

  int get present => sheet.where((r) => r.status == 'present').length;
  int get absent => sheet.where((r) => r.status == 'absent').length;
  int get late => sheet.where((r) => r.status == 'late').length;
  int get marked => present + absent + late;
  int get notMarked =>
      (summary?.total ?? sheet.length) - marked > 0
          ? (summary?.total ?? sheet.length) - marked
          : 0;
}

/// Floating circular shortcut: a raised neu disc that sinks in on touch,
/// with its label resting on the page below (no card box, no clipping).
class _QuickAction extends StatefulWidget {
  const _QuickAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  State<_QuickAction> createState() => _QuickActionState();
}

class _QuickActionState extends State<_QuickAction> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap();
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
              child: Icon(widget.icon, color: widget.color, size: 24),
            ),
          ),
          const SizedBox(height: 8),
          Text(widget.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textDark,
                fontWeight: FontWeight.w600,
                fontSize: 11.5,
                height: 1.1,
              )),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                  offset: const Offset(1, 2),
                  blurRadius: 3,
                  color: color.withValues(alpha: 0.5)),
            ],
          ),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile(
      {required this.title,
      required this.date,
      required this.color,
      required this.emoji});
  final String title;
  final String date;
  final Color color;
  final String emoji;
  @override
  Widget build(BuildContext context) {
    return NeuTilt(
      maxTilt: 0.05,
      child: SizedBox(
        width: 152,
        child: NeuCard(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 26)),
              const Spacer(),
              Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      color: color, fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 2),
              Text(date,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}


void _openAddRemarks(BuildContext context) {
  showAppBottomSheet<void>(
    context: context,
    scrollable: true,
    child: const _AddRemarkSheet(),
  );
}

class _AddRemarkSheet extends StatefulWidget {
  const _AddRemarkSheet();
  @override
  State<_AddRemarkSheet> createState() => _AddRemarkSheetState();
}

class _AddRemarkSheetState extends State<_AddRemarkSheet> {
  List<SchoolClass>? _classes;
  List<Student>? _students;
  SchoolClass? _selectedClass;
  Student? _selectedStudent;
  bool _loadingStudents = false;

  final _remarkCtl = TextEditingController();
  String _category = 'general';

  static const _categories = [
    'general',
    'behavior',
    'academic',
    'social',
    'participation',
  ];

  @override
  void initState() {
    super.initState();
    TeacherApi.instance.listClasses().then((c) {
      if (mounted) setState(() => _classes = c);
    });
  }

  Future<void> _loadStudents(String classId) async {
    setState(() => _loadingStudents = true);
    try {
      final s = await TeacherApi.instance.getClassStudents(classId);
      if (mounted) setState(() => _students = s);
    } catch (_) {
      if (mounted) setState(() => _students = []);
    } finally {
      if (mounted) setState(() => _loadingStudents = false);
    }
  }

  Future<void> _save() async {
    if (_selectedStudent == null || _remarkCtl.text.trim().isEmpty) return;
    try {
      await TeacherApi.instance.addRemark(
        studentId: _selectedStudent!.id,
        remark: _remarkCtl.text.trim(),
        category: _category,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      AppToast.show(context, 'Remark saved', type: ToastType.success);
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed to save remark', type: ToastType.error);
    }
  }

  @override
  void dispose() {
    _remarkCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Add teacher remark',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          if (_selectedStudent != null) ...[
            const SizedBox(height: 4),
            Text('For ${_selectedStudent!.fullName}',
                style: const TextStyle(color: AppColors.textMuted)),
          ],
          const SizedBox(height: 12),
          // Class picker
          if (_classes == null)
            const Center(child: CircularProgressIndicator())
          else
            DropdownButtonFormField<SchoolClass>(
              value: _selectedClass,
              decoration: const InputDecoration(
                labelText: 'Class',
                border: OutlineInputBorder(),
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              items: _classes!.map((c) {
                return DropdownMenuItem(
                    value: c, child: Text(c.displayName));
              }).toList(),
              onChanged: (c) {
                if (c == null) return;
                setState(() {
                  _selectedClass = c;
                  _selectedStudent = null;
                });
                _loadStudents(c.id);
              },
            ),
          const SizedBox(height: 8),
          // Student picker
          if (_selectedClass != null) ...[
            if (_loadingStudents)
              const Center(child: CircularProgressIndicator())
            else if (_students == null || _students!.isEmpty)
              const Text('No students in this class',
                  style: TextStyle(color: AppColors.textMuted))
            else
              DropdownButtonFormField<Student>(
                value: _selectedStudent,
                decoration: const InputDecoration(
                  labelText: 'Student',
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                items: _students!.map((s) {
                  return DropdownMenuItem(
                      value: s, child: Text(s.fullName));
                }).toList(),
                onChanged: (s) => setState(() => _selectedStudent = s),
              ),
            const SizedBox(height: 8),
          ],
          // Category
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(
              labelText: 'Category',
              border: OutlineInputBorder(),
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            items: _categories.map((cat) {
              return DropdownMenuItem(
                  value: cat,
                  child: Text('${cat[0].toUpperCase()}${cat.substring(1)}'));
            }).toList(),
            onChanged: (v) {
              if (v != null) setState(() => _category = v);
            },
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _remarkCtl,
            maxLines: 4,
            // Rebuild so the Save button enables/disables as the field fills.
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'e.g. "Participated actively in circle time"',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          PrimaryButton(
            label: 'Save remark',
            color: AppColors.teacherPrimary,
            fullWidth: true,
            onPressed:
                _selectedStudent == null || _remarkCtl.text.trim().isEmpty
                    ? null
                    : _save,
          ),
        ],
      ),
    );
  }
}

