import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/models/student.dart';
import '../../../core/network/admin_api.dart' show SchoolClass;
import '../../../core/network/teacher_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/neu.dart';

class TeacherAttendanceMarkingScreen extends StatefulWidget {
  const TeacherAttendanceMarkingScreen({
    super.key,
    this.initialClassId,
  });

  final String? initialClassId;

  @override
  State<TeacherAttendanceMarkingScreen> createState() =>
      _TeacherAttendanceMarkingScreenState();
}

class _TeacherAttendanceMarkingScreenState
    extends State<TeacherAttendanceMarkingScreen> {
  late Future<List<SchoolClass>> _classesFuture;
  String? _selectedClassId;
  List<Student> _students = [];
  final Map<String, String> _statuses = {}; // studentId → 'present'|'absent'|'late'
  bool _loadingStudents = false;
  bool _submitting = false;
  final String _today = DateTime.now().toIso8601String().split('T').first;

  @override
  void initState() {
    super.initState();
    _classesFuture = TeacherApi.instance.listMyClasses();
    if (widget.initialClassId != null) {
      _selectedClassId = widget.initialClassId;
      _loadStudents(widget.initialClassId!);
    }
  }

  Future<void> _loadStudents(String classId) async {
    setState(() {
      _loadingStudents = true;
      _students = [];
      _statuses.clear();
    });
    try {
      // Check if attendance already marked today
      final [students, existing] = await Future.wait([
        TeacherApi.instance.getClassStudents(classId),
        TeacherApi.instance.getClassSheet(classId, _today),
      ]);
      if (!mounted) return;
      final existingMap = {
        // Empty status = not yet marked; only pre-fill real marks.
        for (final r in (existing as List<ClassAttendanceRecord>))
          if (r.status.isNotEmpty) r.studentId: r.status
      };
      setState(() {
        _students = students as List<Student>;
        _statuses.addAll(existingMap);
        _loadingStudents = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingStudents = false);
    }
  }

  int get _marked => _statuses.length;
  int get _total => _students.length;

  Future<void> _submit() async {
    if (_marked == 0 || _selectedClassId == null) return;
    setState(() => _submitting = true);
    try {
      await TeacherApi.instance.markAttendance(
        classId: _selectedClassId!,
        date: _today,
        records: _statuses.entries
            .map((e) => AttendanceMark(studentId: e.key, status: e.value))
            .toList(),
      );
      if (!mounted) return;
      AppToast.show(context, 'Attendance submitted', type: ToastType.success);
      setState(() => _submitting = false);
    } on DioException catch (e) {
      if (!mounted) return;
      AppToast.show(
          context,
          'Error ${e.response?.statusCode ?? 'unknown'}. Try again.',
          type: ToastType.error);
      setState(() => _submitting = false);
    } catch (_) {
      if (!mounted) return;
      AppToast.show(context, 'Something went wrong.', type: ToastType.error);
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.teacherPrimary;
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: _selectedClassId == null,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Mark Attendance'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(60),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(Formatters.formatDate(DateTime.now()),
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 12)),
                    const Spacer(),
                    NeuBox(
                      inset: true,
                      radius: 999,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 5),
                      child: Text('Today',
                          style: TextStyle(
                              color: accent,
                              fontWeight: FontWeight.w700,
                              fontSize: 12)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_total > 0)
                  Row(
                    children: [
                      Expanded(
                        child: NeuProgressBar(
                          value: _total == 0 ? 0 : _marked / _total,
                          height: 10,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text('$_marked / $_total',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark)),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Class picker
          FutureBuilder<List<SchoolClass>>(
            future: _classesFuture,
            builder: (_, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const LinearProgressIndicator();
              }
              final classes = snap.data ?? [];
              if (classes.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('No classes found.',
                      style: TextStyle(color: AppColors.textMuted)),
                );
              }
              return Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: SizedBox(
                  height: 44,
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
          const SizedBox(height: 8),
          // Student list
          Expanded(
            child: _selectedClassId == null
                ? const Center(
                    child: Text('Select a class above.',
                        style: TextStyle(color: AppColors.textMuted)),
                  )
                : _loadingStudents
                    ? const Center(child: CircularProgressIndicator())
                    : _students.isEmpty
                        ? const Center(
                            child: Text('No students in this class.',
                                style:
                                    TextStyle(color: AppColors.textMuted)),
                          )
                        : ListView.builder(
                            physics: const BouncingScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
                            itemCount: _students.length,
                            itemBuilder: (_, i) {
                              final s = _students[i];
                              final cur = _statuses[s.id];
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: NeuCard(
                                  padding: const EdgeInsets.fromLTRB(
                                      12, 10, 12, 10),
                                  child: Row(
                                    children: [
                                      AnimalAvatar(seed: s.fullName, gender: s.gender),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(s.fullName,
                                                style: const TextStyle(
                                                    fontWeight: FontWeight.w700,
                                                    color: AppColors.textDark)),
                                            if (s.admissionNumber.isNotEmpty)
                                              Text(s.admissionNumber,
                                                  style: const TextStyle(
                                                      color:
                                                          AppColors.textMuted,
                                                      fontSize: 11)),
                                          ],
                                        ),
                                      ),
                                      NeuMarkPill(
                                        label: 'P',
                                        selected: cur == 'present',
                                        color: AppColors.success,
                                        onTap: () => setState(
                                            () => _statuses[s.id] = 'present'),
                                      ),
                                      const SizedBox(width: 8),
                                      NeuMarkPill(
                                        label: 'A',
                                        selected: cur == 'absent',
                                        color: AppColors.danger,
                                        onTap: () => setState(
                                            () => _statuses[s.id] = 'absent'),
                                      ),
                                      const SizedBox(width: 8),
                                      NeuMarkPill(
                                        label: 'L',
                                        selected: cur == 'late',
                                        color: AppColors.warning,
                                        onTap: () => _markLate(s.id),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                                  .animate(
                                      delay: Duration(milliseconds: 30 * i))
                                  .fadeIn(duration: 280.ms)
                                  .slideY(begin: 0.05);
                            },
                          ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: NeuButton(
            label: _submitting
                ? 'Submitting…'
                : _marked == 0
                    ? 'Mark attendance first'
                    : 'Submit ($_marked/$_total)',
            icon: Iconsax.tick_circle,
            onPressed: (_marked > 0 && !_submitting) ? _submit : null,
          ),
        ),
      ),
    );
  }

  Future<void> _markLate(String id) async {
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      builder: (_, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme:
              const ColorScheme.light(primary: AppColors.teacherPrimary),
        ),
        child: child!,
      ),
    );
    if (t != null) setState(() => _statuses[id] = 'late');
  }
}
