import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/models/student.dart';
import '../../../core/network/admin_api.dart' show SchoolClass;
import '../../../core/network/teacher_api.dart';
import 'teacher_attendance.dart';
import 'teacher_more.dart' show TeacherDiaryScreen;
import '../../shared/student_attendance_report_screen.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/neu.dart';

class TeacherStudentsScreen extends StatefulWidget {
  const TeacherStudentsScreen({super.key});

  @override
  State<TeacherStudentsScreen> createState() => _TeacherStudentsScreenState();
}

class _TeacherStudentsScreenState extends State<TeacherStudentsScreen> {
  final _searchCtl = TextEditingController();
  late Future<List<SchoolClass>> _classesFuture;
  String? _selectedClassId;
  List<Student> _students = [];
  bool _loading = false;
  bool _noClasses = false;

  @override
  void initState() {
    super.initState();
    // Only the classes this teacher is in charge of.
    _classesFuture = TeacherApi.instance.listMyClasses().then((classes) {
      if (classes.isNotEmpty) {
        _selectedClassId = classes.first.id;
        _loadStudents(classes.first.id);
      } else if (mounted) {
        setState(() => _noClasses = true);
      }
      return classes;
    });
  }

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  Future<void> _loadStudents(String classId) async {
    setState(() => _loading = true);
    try {
      final list = await TeacherApi.instance.getClassStudents(classId);
      if (!mounted) return;
      setState(() {
        _students = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  List<Student> get _filtered {
    final q = _searchCtl.text.toLowerCase();
    if (q.isEmpty) return _students;
    return _students
        .where((s) => s.fullName.toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Students'),
      ),
      body: Column(
        children: [
          // Search bar — carved into the page.
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
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
                        controller: _searchCtl,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          hintText: 'Search students',
                          border: InputBorder.none,
                          isDense: true,
                        ),
                      ),
                    ),
                    if (_searchCtl.text.isNotEmpty)
                      GestureDetector(
                        onTap: () {
                          _searchCtl.clear();
                          setState(() {});
                        },
                        child: const Icon(Icons.close_rounded,
                            size: 18, color: AppColors.textMuted),
                      ),
                  ],
                ),
              ),
            ),
          ),
          // Class tabs
          FutureBuilder<List<SchoolClass>>(
            future: _classesFuture,
            builder: (_, snap) {
              final classes = snap.data ?? [];
              if (classes.isEmpty) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                child: SizedBox(
                  height: 42,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: classes.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (_, i) {
                      final cls = classes[i];
                      final selected = _selectedClassId == cls.id;
                      return Center(
                        child: NeuChip(
                          label: cls.displayName,
                          selected: selected,
                          onTap: () {
                            if (!selected) {
                              setState(() => _selectedClassId = cls.id);
                              _loadStudents(cls.id);
                            }
                          },
                        ),
                      );
                    },
                  ),
                ),
              );
            },
          ),
          // Student list
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: () async {
                      if (_selectedClassId != null) {
                        await _loadStudents(_selectedClassId!);
                      }
                    },
                    child: _filtered.isEmpty
                        ? ListView(
                            children: [
                              const SizedBox(height: 80),
                              Center(
                                child: Text(
                                    _noClasses
                                        ? 'No class is assigned to you yet.\nYour admin assigns classes.'
                                        : 'No students found.',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                        color: AppColors.textMuted)),
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics: const BouncingScrollPhysics(),
                            padding:
                                const EdgeInsets.fromLTRB(20, 8, 20, 110),
                            itemCount: _filtered.length,
                            itemBuilder: (_, i) {
                              final s = _filtered[i];
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: NeuCard(
                                  padding: const EdgeInsets.all(14),
                                  onTap: () => Navigator.push(
                                      context,
                                      neuRoute(
                                          StudentDetailScreen(student: s))),
                                  child: Row(
                                    children: [
                                      NeuBox(
                                        shape: BoxShape.circle,
                                        padding: const EdgeInsets.all(3),
                                        child:
                                            AnimalAvatar(seed: s.fullName, gender: s.gender),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(s.fullName,
                                                style: const TextStyle(
                                                    fontWeight: FontWeight.w700,
                                                    color: AppColors.textDark,
                                                    fontSize: 14)),
                                            const SizedBox(height: 2),
                                            Text(s.admissionNumber,
                                                style: const TextStyle(
                                                    color: AppColors.textMuted,
                                                    fontSize: 12)),
                                          ],
                                        ),
                                      ),
                                      StatusChip(
                                          label: _capitalize(s.status),
                                          type: s.status == 'active'
                                              ? ChipType.success
                                              : ChipType.neutral),
                                    ],
                                  ),
                                ),
                              )
                                  .animate(
                                      delay: Duration(milliseconds: 25 * i))
                                  .fadeIn(duration: 260.ms)
                                  .slideY(begin: 0.04);
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

// ── Student detail ─────────────────────────────────────────

class StudentDetailScreen extends StatelessWidget {
  const StudentDetailScreen({super.key, required this.student});
  final Student student;

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.teacherPrimary;
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text(student.fullName),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          NeuTilt(
            child: NeuCard(
              shadow: Neu.floatShadow,
              child: Row(
                children: [
                  NeuBox(
                    shape: BoxShape.circle,
                    padding: const EdgeInsets.all(4),
                    child: AnimalAvatar(seed: student.fullName, gender: student.gender, size: 68),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(student.fullName,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 18,
                                color: AppColors.textDark)),
                        const SizedBox(height: 4),
                        Text(
                          [
                            student.admissionNumber,
                            if (student.dateOfBirth != null)
                              'DOB ${student.dateOfBirth!.day}/${student.dateOfBirth!.month}/${student.dateOfBirth!.year}',
                          ].join(' · '),
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 12),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            StatusChip(
                              label: student.status[0].toUpperCase() +
                                  student.status.substring(1),
                              type: student.status == 'active'
                                  ? ChipType.success
                                  : ChipType.neutral,
                            ),
                            if (student.parentUserId != null) ...[
                              const SizedBox(width: 6),
                              const StatusChip(
                                  label: 'Parent app active',
                                  type: ChipType.info),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ).animate().fadeIn(duration: 320.ms).slideY(begin: 0.06),
          const SizedBox(height: 18),
          if (!student.medicalInfo.isEmpty) ...[
            Row(
              children: const [
                Icon(Iconsax.health, size: 16, color: AppColors.danger),
                SizedBox(width: 6),
                Text('Health & Alerts',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark)),
              ],
            ),
            const SizedBox(height: 8),
            NeuCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final row in <(String, String, Color)>[
                    if ((student.medicalInfo.bloodGroup ?? '').isNotEmpty)
                      (
                        'Blood group',
                        student.medicalInfo.bloodGroup!,
                        AppColors.textDark
                      ),
                    if (student.medicalInfo.allergies.isNotEmpty)
                      (
                        'Allergies',
                        student.medicalInfo.allergies.join(', '),
                        AppColors.danger
                      ),
                    if (student.medicalInfo.conditions.isNotEmpty)
                      (
                        'Conditions',
                        student.medicalInfo.conditions.join(', '),
                        AppColors.warning
                      ),
                    if (student.medicalInfo.medications.isNotEmpty)
                      (
                        'Medications',
                        student.medicalInfo.medications.join(', '),
                        AppColors.info
                      ),
                  ])
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 96,
                            child: Text(row.$1,
                                style: TextStyle(
                                    color: row.$3,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13)),
                          ),
                          Expanded(
                            child: Text(row.$2,
                                style: const TextStyle(
                                    color: AppColors.textDark, fontSize: 13)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 18),
          ],
          if (student.guardians.isNotEmpty) ...[
            const Text('Guardian',
                style: TextStyle(
                    fontWeight: FontWeight.w700, color: AppColors.textDark)),
            const SizedBox(height: 8),
            ...student.guardians.map(
              (g) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: NeuCard(
                  child: Row(
                    children: [
                      InitialAvatar(name: g.name, color: accent),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(g.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                            Text('${g.relationship} · ${g.phone}',
                                style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12)),
                          ],
                        ),
                      ),
                      if (g.isPrimary)
                        const StatusChip(
                            label: 'Primary', type: ChipType.info),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 18),
          NeuButton(
            label: 'Daily update',
            icon: Iconsax.note,
            onPressed: () => Navigator.push(
              context,
              neuRoute(TeacherDiaryScreen(student: student)),
            ),
          ),
          const SizedBox(height: 12),
          NeuGhostButton(
            label: 'Mark attendance',
            icon: Iconsax.clipboard_text,
            onPressed: () => Navigator.push(
              context,
              neuRoute(TeacherAttendanceMarkingScreen(
                initialClassId: student.classId,
              )),
            ),
          ),
          const SizedBox(height: 12),
          NeuGhostButton(
            label: 'Attendance report',
            icon: Iconsax.chart_2,
            onPressed: () => Navigator.push(
              context,
              neuRoute(StudentAttendanceReportScreen(
                studentName: student.fullName,
                accent: accent,
                fetch: (from, to) =>
                    TeacherApi.instance.getStudentAttendanceReport(
                  studentId: student.id,
                  from: from,
                  to: to,
                ),
              )),
            ),
          ),
        ],
      ),
    );
  }
}
