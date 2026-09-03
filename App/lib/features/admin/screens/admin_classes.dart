import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/models/app_user.dart';
import '../../../core/models/student.dart';
import '../../../core/network/admin_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neu.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/avatar.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/cards.dart';

// ── Classes list ───────────────────────────────────────────

class AdminClassesScreen extends StatefulWidget {
  const AdminClassesScreen({super.key});

  @override
  State<AdminClassesScreen> createState() => _AdminClassesScreenState();
}

class _AdminClassesScreenState extends State<AdminClassesScreen> {
  late Future<List<SchoolClass>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.listClasses();
  }

  void _reload() {
    setState(() {
      _future = AdminApi.instance.listClasses();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Classes'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'addclass',
        backgroundColor: AppColors.adminPrimary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add class', style: TextStyle(color: Colors.white)),
        onPressed: () => showAppBottomSheet(
          context: context,
          child: _CreateClassSheet(onCreated: _reload),
        ),
      ),
      body: FutureBuilder<List<SchoolClass>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _CenterMessage(
              icon: Iconsax.warning_2,
              color: AppColors.danger,
              message: 'Could not load classes.',
              onRetry: _reload,
            );
          }
          final classes = snap.data ?? [];
          if (classes.isEmpty) {
            return const _CenterMessage(
              icon: Iconsax.book_1,
              message: 'No classes yet.\nTap “Add class” to create one.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
              itemCount: classes.length,
              itemBuilder: (_, i) {
                final c = classes[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    onTap: () async {
                      await Navigator.of(context).push(
                        neuRoute(AdminClassDetailScreen(schoolClass: c),
                        ),
                      );
                      // Teacher / roster may have changed while inside.
                      _reload();
                    },
                    child: Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: AppColors.adminPrimary.withValues(alpha: 0.1),
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
                              Text(
                                [
                                  c.hasTeacher
                                      ? (c.classTeacherName ?? 'Teacher assigned')
                                      : 'No teacher assigned',
                                  if (c.academicYear != null) c.academicYear!,
                                ].join(' · '),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    color: c.hasTeacher
                                        ? AppColors.textMuted
                                        : AppColors.warning,
                                    fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('${c.enrolled}/${c.capacity}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark)),
                            const Text('students',
                                style: TextStyle(
                                    color: AppColors.textMuted, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(width: 6),
                        const Icon(Iconsax.arrow_right_3,
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

// ── Create class ───────────────────────────────────────────

class _CreateClassSheet extends StatefulWidget {
  const _CreateClassSheet({required this.onCreated});
  final VoidCallback onCreated;

  @override
  State<_CreateClassSheet> createState() => _CreateClassSheetState();
}

class _CreateClassSheetState extends State<_CreateClassSheet> {
  final _nameCtl = TextEditingController();
  final _sectionCtl = TextEditingController(text: 'A');
  final _yearCtl = TextEditingController(text: _defaultYear());
  final _capacityCtl = TextEditingController(text: '30');
  final _roomCtl = TextEditingController();
  bool _saving = false;
  String? _error;

  static String _defaultYear() {
    // Indian academic year runs April→March.
    final now = DateTime.now();
    final y = now.month >= 4 ? now.year : now.year - 1;
    return '$y-${y + 1}';
  }

  @override
  void dispose() {
    _nameCtl.dispose();
    _sectionCtl.dispose();
    _yearCtl.dispose();
    _capacityCtl.dispose();
    _roomCtl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Class name is required.');
      return;
    }
    final year = _yearCtl.text.trim();
    if (!RegExp(r'^\d{4}-\d{4}$').hasMatch(year)) {
      setState(() => _error = 'Academic year must look like 2025-2026.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await AdminApi.instance.createClass(
        name: name,
        section:
            _sectionCtl.text.trim().isEmpty ? null : _sectionCtl.text.trim(),
        academicYear: year,
        capacity: int.tryParse(_capacityCtl.text.trim()),
        room: _roomCtl.text.trim().isEmpty ? null : _roomCtl.text.trim(),
      );
      if (!mounted) return;
      Navigator.pop(context);
      AppToast.show(context, 'Class created', type: ToastType.success);
      widget.onCreated();
    } on DioException catch (e) {
      final msg = switch (e.response?.statusCode) {
        409 => 'A class with this name, section and year already exists.',
        400 => (e.response?.data as Map?)?['message']?.toString() ??
            'Invalid data.',
        null => 'Cannot reach the server.',
        _ => 'Error ${e.response?.statusCode}. Try again.',
      };
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = msg;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Something went wrong. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Add class',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark)),
            const SizedBox(height: 4),
            const Text('Assign a teacher and students after creating it.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
            const SizedBox(height: 16),
            TextField(
              controller: _nameCtl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                  labelText: 'Class name (e.g. Nursery)',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                SizedBox(
                  width: 110,
                  child: TextField(
                    controller: _sectionCtl,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                        labelText: 'Section', border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _capacityCtl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly
                    ],
                    decoration: const InputDecoration(
                        labelText: 'Capacity', border: OutlineInputBorder()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _yearCtl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Academic year',
                  hintText: '2025-2026',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _roomCtl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                  labelText: 'Room (optional)', border: OutlineInputBorder()),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!,
                  style:
                      const TextStyle(color: AppColors.danger, fontSize: 13)),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              label: _saving ? 'Creating…' : 'Create class',
              color: AppColors.adminPrimary,
              fullWidth: true,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Class detail (teacher + students) ─────────────────────

class AdminClassDetailScreen extends StatefulWidget {
  const AdminClassDetailScreen({super.key, required this.schoolClass});
  final SchoolClass schoolClass;

  @override
  State<AdminClassDetailScreen> createState() =>
      _AdminClassDetailScreenState();
}

class _AdminClassDetailScreenState extends State<AdminClassDetailScreen> {
  late SchoolClass _cls;
  late Future<List<Student>> _future;

  @override
  void initState() {
    super.initState();
    _cls = widget.schoolClass;
    _future = AdminApi.instance.listClassStudents(_cls.id);
  }

  void _reload() {
    setState(() {
      _future = AdminApi.instance.listClassStudents(_cls.id);
    });
  }

  Future<void> _pickTeacher() async {
    final pick = await showAppBottomSheet<_TeacherPick>(
      context: context,
      child: _TeacherPickerSheet(currentTeacherId: _cls.classTeacherId),
    );
    if (pick == null) return;
    try {
      await AdminApi.instance
          .assignClassTeacher(_cls.id, pick.remove ? null : pick.teacher!.id);
      if (!mounted) return;
      setState(() {
        _cls = pick.remove
            ? _cls.copyWith(clearTeacher: true)
            : _cls.copyWith(
                classTeacherId: pick.teacher!.id,
                classTeacherName: pick.teacher!.name);
      });
      AppToast.show(context,
          pick.remove ? 'Class teacher removed' : 'Class teacher assigned',
          type: ToastType.success);
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  Future<void> _addStudents() async {
    await showAppBottomSheet<void>(
      context: context,
      child: _AddStudentsSheet(schoolClass: _cls),
    );
    _reload();
  }

  Future<void> _remove(Student s) async {
    try {
      await AdminApi.instance.deallocateStudent(_cls.id, s.id);
      if (!mounted) return;
      AppToast.show(context, '${s.fullName} removed from class',
          type: ToastType.info);
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Failed: $e', type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text(_cls.displayName),
      ),
      body: FutureBuilder<List<Student>>(
        future: _future,
        builder: (context, snap) {
          final loading = snap.connectionState == ConnectionState.waiting;
          final students = snap.data ?? [];
          final full = students.length >= _cls.capacity;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
              children: [
                // Class summary
                AppCard(
                  background: AppColors.adminPrimary.withValues(alpha: 0.08),
                  child: Row(
                    children: [
                      const Icon(Iconsax.book_1,
                          color: AppColors.adminPrimary, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_cls.displayName,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16,
                                    color: AppColors.textDark)),
                            const SizedBox(height: 2),
                            Text(
                              [
                                if (_cls.academicYear != null)
                                  _cls.academicYear!,
                                if (_cls.room != null) 'Room ${_cls.room}',
                                '${students.length}/${_cls.capacity} students',
                              ].join(' · '),
                              style: const TextStyle(
                                  color: AppColors.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Class teacher
                const Text('Class teacher',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: AppColors.textDark)),
                const SizedBox(height: 8),
                AppCard(
                  child: Row(
                    children: [
                      _cls.hasTeacher
                          ? InitialAvatar(
                              name: _cls.classTeacherName ?? 'Teacher',
                              color: AppColors.adminPrimary)
                          : Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: AppColors.mutedGray,
                                borderRadius: BorderRadius.circular(22),
                              ),
                              child: const Icon(Iconsax.teacher,
                                  color: AppColors.textMuted),
                            ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _cls.hasTeacher
                              ? (_cls.classTeacherName ?? 'Assigned')
                              : 'No teacher assigned',
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: _cls.hasTeacher
                                  ? AppColors.textDark
                                  : AppColors.textMuted),
                        ),
                      ),
                      SecondaryButton(
                        label: _cls.hasTeacher ? 'Change' : 'Assign',
                        color: AppColors.adminPrimary,
                        onPressed: _pickTeacher,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Students
                Row(
                  children: [
                    Expanded(
                      child: Text('Students (${students.length})',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: AppColors.textDark)),
                    ),
                    SecondaryButton(
                      label: 'Add',
                      icon: Iconsax.user_add,
                      color: AppColors.adminPrimary,
                      onPressed: full ? null : _addStudents,
                    ),
                  ],
                ),
                if (full)
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text('Class is at full capacity.',
                        style:
                            TextStyle(color: AppColors.warning, fontSize: 12)),
                  ),
                const SizedBox(height: 8),
                if (loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (students.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Text('No students in this class yet.',
                        style: TextStyle(color: AppColors.textMuted)),
                  )
                else
                  for (final s in students)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: AppCard(
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
                            TintedIconButton(
                              icon: Icons.close_rounded,
                              color: AppColors.danger,
                              onTap: () => _remove(s),
                            ),
                          ],
                        ),
                      ),
                    ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Teacher picker ─────────────────────────────────────────

class _TeacherPick {
  const _TeacherPick({this.teacher, this.remove = false});
  final AppUser? teacher;
  final bool remove;
}

class _TeacherPickerSheet extends StatefulWidget {
  const _TeacherPickerSheet({this.currentTeacherId});
  final String? currentTeacherId;

  @override
  State<_TeacherPickerSheet> createState() => _TeacherPickerSheetState();
}

class _TeacherPickerSheetState extends State<_TeacherPickerSheet> {
  late Future<List<AppUser>> _future;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance
        .listStaff()
        .then((u) => u.where((x) => x.role == 'Teacher').toList());
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Assign class teacher',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 12),
          if (widget.currentTeacherId != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.person_remove_rounded,
                  color: AppColors.danger),
              title: const Text('Remove current teacher',
                  style: TextStyle(color: AppColors.danger)),
              onTap: () =>
                  Navigator.pop(context, const _TeacherPick(remove: true)),
            ),
          FutureBuilder<List<AppUser>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              final teachers = snap.data ?? [];
              if (teachers.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text(
                      'No teacher accounts yet. Add teachers from Staff Management first.',
                      style: TextStyle(color: AppColors.textMuted)),
                );
              }
              return ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 360),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: teachers.length,
                  itemBuilder: (_, i) {
                    final t = teachers[i];
                    final current = t.id == widget.currentTeacherId;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: InitialAvatar(
                          name: t.name, color: AppColors.adminPrimary),
                      title: Text(t.name),
                      subtitle: Text(t.email,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      trailing: current
                          ? const Icon(Icons.check_circle_rounded,
                              color: AppColors.success)
                          : null,
                      onTap: () =>
                          Navigator.pop(context, _TeacherPick(teacher: t)),
                    );
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Add students picker ────────────────────────────────────

class _AddStudentsSheet extends StatefulWidget {
  const _AddStudentsSheet({required this.schoolClass});
  final SchoolClass schoolClass;

  @override
  State<_AddStudentsSheet> createState() => _AddStudentsSheetState();
}

class _AddStudentsSheetState extends State<_AddStudentsSheet> {
  late Future<List<Student>> _future;
  final Set<String> _added = {};

  @override
  void initState() {
    super.initState();
    _future = _loadUnassigned();
  }

  Future<List<Student>> _loadUnassigned() async {
    final page = await AdminApi.instance.listStudents(limit: 100);
    // A student can belong to only one class; offer those not yet allocated.
    return page.data
        .where((s) => s.classId == null || s.classId!.isEmpty)
        .toList();
  }

  Future<void> _allocate(Student s) async {
    try {
      await AdminApi.instance.allocateStudent(widget.schoolClass.id, s.id);
      if (!mounted) return;
      setState(() => _added.add(s.id));
      AppToast.show(context, '${s.fullName} added', type: ToastType.success);
    } on DioException catch (e) {
      final msg = e.response?.statusCode == 400
          ? ((e.response?.data as Map?)?['message']?.toString() ??
              'Class is full.')
          : 'Could not add student.';
      if (!mounted) return;
      AppToast.show(context, msg, type: ToastType.error);
    } catch (_) {
      if (!mounted) return;
      AppToast.show(context, 'Could not add student.',
          type: ToastType.error);
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
          Text('Add students to ${widget.schoolClass.displayName}',
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark)),
          const SizedBox(height: 4),
          const Text('Only students not yet in a class are shown.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
          const SizedBox(height: 12),
          FutureBuilder<List<Student>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              final all = snap.data ?? [];
              final available =
                  all.where((s) => !_added.contains(s.id)).toList();
              if (all.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text('Every student is already in a class.',
                      style: TextStyle(color: AppColors.textMuted)),
                );
              }
              if (available.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text('All added. Pull the class to refresh.',
                      style: TextStyle(color: AppColors.success)),
                );
              }
              return ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 380),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: available.length,
                  itemBuilder: (_, i) {
                    final s = available[i];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: AnimalAvatar(seed: s.fullName, gender: s.gender, size: 38),
                      title: Text(s.fullName),
                      subtitle: Text(s.admissionNumber),
                      trailing: IconButton(
                        icon: const Icon(Icons.add_circle,
                            color: AppColors.adminPrimary),
                        onPressed: () => _allocate(s),
                      ),
                    );
                  },
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          PrimaryButton(
            label: 'Done',
            color: AppColors.adminPrimary,
            fullWidth: true,
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }
}

// ── Shared ─────────────────────────────────────────────────

class _CenterMessage extends StatelessWidget {
  const _CenterMessage({
    required this.icon,
    required this.message,
    this.color = AppColors.textMuted,
    this.onRetry,
  });
  final IconData icon;
  final String message;
  final Color color;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 44),
            const SizedBox(height: 14),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 14)),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              SecondaryButton(
                  label: 'Try again',
                  color: AppColors.adminPrimary,
                  onPressed: onRetry!),
            ],
          ],
        ),
      ),
    );
  }
}
