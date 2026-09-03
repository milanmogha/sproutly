import 'package:iconsax/iconsax.dart';
import 'package:flutter/material.dart';
import '../../../core/network/admin_api.dart' show SchoolClass;
import '../../../core/network/teacher_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';

/// The teacher shell uses `extendBody: true` with a floating [NeuBottomNav], so
/// this screen's content runs underneath the bar. Under `extendBody`, the shell
/// already reports the nav bar's full height (bar + margin + safe-area inset)
/// as this screen's MediaQuery bottom padding — so a floating button only needs
/// a small gap on top of that inset to sit just above the bar, and scrolling
/// lists just need enough padding to clear both the bar and the button.
double _navInset(BuildContext context) => MediaQuery.paddingOf(context).bottom;

/// Bottom offset for a floating add button so it sits ~24px above the nav bar.
double _fabBottom(BuildContext context) => _navInset(context) + 24;

/// Bottom padding for a scrolling list so its last row clears the nav bar and
/// the floating add button above it.
double _listBottomInset(BuildContext context) => _navInset(context) + 90;

class TeacherAcademicsScreen extends StatefulWidget {
  const TeacherAcademicsScreen({super.key});

  @override
  State<TeacherAcademicsScreen> createState() =>
      _TeacherAcademicsScreenState();
}

class _TeacherAcademicsScreenState extends State<TeacherAcademicsScreen> {
  late Future<List<SchoolClass>> _classesFuture;
  SchoolClass? _class;

  @override
  void initState() {
    super.initState();
    _classesFuture = TeacherApi.instance.listClasses().then((list) {
      if (list.isNotEmpty && _class == null) {
        setState(() => _class = list.first);
      }
      return list;
    });
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: Neu.bg,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          backgroundColor: Neu.bg,
          elevation: 0,
          title: const Text('Academics'),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: AppColors.teacherPrimary,
            labelColor: AppColors.teacherPrimary,
            unselectedLabelColor: AppColors.textMuted,
            tabs: [
              Tab(text: 'Homework'),
              Tab(text: 'Assessments'),
              Tab(text: 'Syllabus'),
              Tab(text: 'Lesson Plans'),
            ],
          ),
        ),
        body: Column(
          children: [
            // Class picker
            SizedBox(
              height: 52,
              child: FutureBuilder<List<SchoolClass>>(
                future: _classesFuture,
                builder: (_, snap) {
                  final classes = snap.data ?? const <SchoolClass>[];
                  if (classes.isEmpty) {
                    return const Center(
                        child: Text('No classes yet',
                            style: TextStyle(color: AppColors.textMuted)));
                  }
                  return ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    itemCount: classes.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (_, i) => Center(
                      child: NeuChip(
                        label: classes[i].name,
                        selected: _class?.id == classes[i].id,
                        onTap: () => setState(() => _class = classes[i]),
                      ),
                    ),
                  );
                },
              ),
            ),
            Expanded(
              child: _class == null
                  ? const Center(child: CircularProgressIndicator())
                  : TabBarView(
                      children: [
                        _HomeworkTab(
                            key: ValueKey('hw-${_class!.id}'),
                            classId: _class!.id),
                        _AssessmentsTab(
                            key: ValueKey('as-${_class!.id}'),
                            classId: _class!.id),
                        _SyllabusTab(
                            key: ValueKey('sy-${_class!.id}'),
                            classId: _class!.id),
                        _LessonPlansTab(
                            key: ValueKey('lp-${_class!.id}'),
                            classId: _class!.id),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Homework ─────────────────────────────────────────────────

class _HomeworkTab extends StatefulWidget {
  const _HomeworkTab({super.key, required this.classId});
  final String classId;

  @override
  State<_HomeworkTab> createState() => _HomeworkTabState();
}

class _HomeworkTabState extends State<_HomeworkTab> {
  late Future<List<HomeworkModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.getHomework(widget.classId);
  }

  void _reload() {
    setState(() {
      _future = TeacherApi.instance.getHomework(widget.classId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        FutureBuilder<List<HomeworkModel>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data ?? const <HomeworkModel>[];
            if (items.isEmpty) {
              return const EmptyState(
                emoji: '✏️',
                title: 'No homework assigned',
                subtitle: 'Tap "New homework" to assign the first one.',
              );
            }
            return RefreshIndicator(
              onRefresh: () async => _reload(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                padding: EdgeInsets.fromLTRB(
                    20, 16, 20, _listBottomInset(context)),
                children: [
                  for (final hw in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: NeuCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(hw.title,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 15)),
                                ),
                                IconButton(
                                  visualDensity: VisualDensity.compact,
                                  icon: const Icon(Iconsax.trash,
                                      size: 18, color: AppColors.danger),
                                  onPressed: () => _delete(hw),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${hw.subject}${hw.dueDate != null ? ' · Due ${Formatters.formatShortDate(hw.dueDate!)}' : ''}',
                              style: const TextStyle(
                                  color: AppColors.textMuted, fontSize: 12),
                            ),
                            if (hw.description != null) ...[
                              const SizedBox(height: 6),
                              Text(hw.description!,
                                  style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 13,
                                      height: 1.4)),
                            ],
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
        Positioned(
          right: 20,
          bottom: _fabBottom(context),
          child: NeuButton(
            label: 'New homework',
            icon: Icons.add,
            fullWidth: false,
            onPressed: _openNewHomework,
          ),
        ),
      ],
    );
  }

  Future<void> _delete(HomeworkModel hw) async {
    try {
      await TeacherApi.instance.deleteHomework(hw.id);
      if (!mounted) return;
      AppToast.show(context, 'Homework removed', type: ToastType.success);
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Could not delete: $e', type: ToastType.error);
    }
  }

  void _openNewHomework() {
    final title = TextEditingController();
    final subject = TextEditingController();
    final desc = TextEditingController();
    DateTime due = DateTime.now().add(const Duration(days: 1));
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
              const Text('New homework',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark)),
              const SizedBox(height: 16),
              TextField(
                controller: title,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: subject,
                decoration: const InputDecoration(
                  labelText: 'Subject',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                tileColor: AppColors.softWhite,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppColors.mutedGray),
                ),
                title: const Text('Due date'),
                subtitle: Text('${due.day}/${due.month}/${due.year}'),
                trailing: const Icon(Icons.calendar_today_rounded, size: 18),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: due,
                    firstDate: DateTime.now(),
                    lastDate: DateTime(2027, 12, 31),
                  );
                  if (picked != null) setSt(() => due = picked);
                },
              ),
              const SizedBox(height: 8),
              TextField(
                controller: desc,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Description (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: 'Assign to class',
                color: AppColors.teacherPrimary,
                fullWidth: true,
                onPressed: () async {
                  if (title.text.trim().isEmpty ||
                      subject.text.trim().isEmpty) {
                    AppToast.show(ctx, 'Title and subject are required',
                        type: ToastType.error);
                    return;
                  }
                  try {
                    await TeacherApi.instance.createHomework(
                      classId: widget.classId,
                      title: title.text.trim(),
                      subject: subject.text.trim(),
                      description: desc.text.trim().isEmpty
                          ? null
                          : desc.text.trim(),
                      dueDate:
                          '${due.year}-${due.month.toString().padLeft(2, '0')}-${due.day.toString().padLeft(2, '0')}',
                    );
                    if (!ctx.mounted) return;
                    Navigator.pop(ctx);
                    if (!mounted) return;
                    AppToast.show(context, 'Homework assigned',
                        type: ToastType.success);
                    _reload();
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
}

// ── Assessments ──────────────────────────────────────────────

class _AssessmentsTab extends StatefulWidget {
  const _AssessmentsTab({super.key, required this.classId});
  final String classId;

  @override
  State<_AssessmentsTab> createState() => _AssessmentsTabState();
}

class _AssessmentsTabState extends State<_AssessmentsTab> {
  late Future<List<AssessmentModel>> _future;

  static const _types = <String>[
    'assignment',
    'quiz',
    'test',
    'exam',
    'project',
    'oral',
    'observation',
  ];

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.getAssessments(widget.classId);
  }

  void _reload() {
    setState(() {
      _future = TeacherApi.instance.getAssessments(widget.classId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        FutureBuilder<List<AssessmentModel>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data ?? const <AssessmentModel>[];
            if (items.isEmpty) {
              return const EmptyState(
                emoji: '📊',
                title: 'No assessments',
                subtitle: 'Tap "New assessment" to add the first one.',
              );
            }
            return RefreshIndicator(
              onRefresh: () async => _reload(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                padding: EdgeInsets.fromLTRB(
                    20, 16, 20, _listBottomInset(context)),
                children: [
                  for (final a in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: NeuCard(
                        child: Row(
                          children: [
                            const NeuIconWell(
                                icon: Iconsax.task, size: 40, iconSize: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(a.title,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 14)),
                                  Text(
                                    [
                                      if (a.type != null)
                                        _pretty(a.type!),
                                      if (a.subject != null) a.subject!,
                                      if (a.date != null)
                                        Formatters.formatShortDate(a.date!),
                                      if (a.maxScore != null)
                                        'Max ${a.maxScore!.toStringAsFixed(0)}',
                                    ].join(' · '),
                                    style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              icon: const Icon(Iconsax.trash,
                                  size: 18, color: AppColors.danger),
                              onPressed: () => _delete(a),
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
        Positioned(
          right: 20,
          bottom: _fabBottom(context),
          child: NeuButton(
            label: 'New assessment',
            icon: Icons.add,
            fullWidth: false,
            onPressed: _openNewAssessment,
          ),
        ),
      ],
    );
  }

  static String _pretty(String v) => v.isEmpty
      ? v
      : '${v[0].toUpperCase()}${v.substring(1)}';

  Future<void> _delete(AssessmentModel a) async {
    try {
      await TeacherApi.instance.deleteAssessment(a.id);
      if (!mounted) return;
      AppToast.show(context, 'Assessment removed', type: ToastType.success);
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Could not delete: $e', type: ToastType.error);
    }
  }

  void _openNewAssessment() {
    final title = TextEditingController();
    final subject = TextEditingController();
    final maxScore = TextEditingController(text: '100');
    final desc = TextEditingController();
    String type = 'assignment';
    DateTime date = DateTime.now();
    showAppBottomSheet<void>(
      context: context,
      child: StatefulBuilder(builder: (ctx, setSt) {
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('New assessment',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark)),
              const SizedBox(height: 16),
              TextField(
                controller: title,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: subject,
                decoration: const InputDecoration(
                  labelText: 'Subject',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(
                  labelText: 'Type',
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final t in _types)
                    DropdownMenuItem(value: t, child: Text(_pretty(t))),
                ],
                onChanged: (v) => setSt(() => type = v ?? type),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: maxScore,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Max score',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                tileColor: AppColors.softWhite,
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
                    firstDate: DateTime(2026, 1, 1),
                    lastDate: DateTime(2027, 12, 31),
                  );
                  if (picked != null) setSt(() => date = picked);
                },
              ),
              const SizedBox(height: 8),
              TextField(
                controller: desc,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Description (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: 'Create assessment',
                color: AppColors.teacherPrimary,
                fullWidth: true,
                onPressed: () async {
                  if (title.text.trim().isEmpty ||
                      subject.text.trim().isEmpty) {
                    AppToast.show(ctx, 'Title and subject are required',
                        type: ToastType.error);
                    return;
                  }
                  final score = int.tryParse(maxScore.text.trim());
                  try {
                    await TeacherApi.instance.createAssessment(
                      classId: widget.classId,
                      title: title.text.trim(),
                      subject: subject.text.trim(),
                      type: type,
                      maxScore: score,
                      description: desc.text.trim().isEmpty
                          ? null
                          : desc.text.trim(),
                      date:
                          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
                    );
                    if (!ctx.mounted) return;
                    Navigator.pop(ctx);
                    if (!mounted) return;
                    AppToast.show(context, 'Assessment created',
                        type: ToastType.success);
                    _reload();
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
}

// ── Syllabus ─────────────────────────────────────────────────

class _SyllabusTab extends StatefulWidget {
  const _SyllabusTab({super.key, required this.classId});
  final String classId;

  @override
  State<_SyllabusTab> createState() => _SyllabusTabState();
}

class _SyllabusTabState extends State<_SyllabusTab> {
  late Future<List<SyllabusModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.getSyllabus(widget.classId);
  }

  void _reload() {
    setState(() {
      _future = TeacherApi.instance.getSyllabus(widget.classId);
    });
  }

  Future<void> _toggleUnit(SyllabusModel s, int unitIndex) async {
    final units = [
      for (int i = 0; i < s.units.length; i++)
        SyllabusUnitModel(
          title: s.units[i].title,
          topics: s.units[i].topics,
          completed:
              i == unitIndex ? !s.units[i].completed : s.units[i].completed,
        ),
    ];
    try {
      await TeacherApi.instance.upsertSyllabus(
        classId: widget.classId,
        subject: s.subject,
        academicYear: s.academicYear,
        units: units,
      );
      _reload();
    } catch (e) {
      if (!mounted) return;
      AppToast.show(context, 'Could not update: $e', type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        FutureBuilder<List<SyllabusModel>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data ?? const <SyllabusModel>[];
            if (items.isEmpty) {
              return const EmptyState(
                emoji: '📚',
                title: 'No syllabus yet',
                subtitle: 'Tap "New syllabus" to add a subject and its units.',
              );
            }
            return RefreshIndicator(
              onRefresh: () async => _reload(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                padding: EdgeInsets.fromLTRB(
                    20, 16, 20, _listBottomInset(context)),
                children: [
                  for (final s in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: NeuCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${s.subject} · ${s.academicYear}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                    color: AppColors.textDark)),
                            const SizedBox(height: 8),
                            for (int i = 0; i < s.units.length; i++)
                              CheckboxListTile(
                                contentPadding: EdgeInsets.zero,
                                dense: true,
                                controlAffinity:
                                    ListTileControlAffinity.leading,
                                value: s.units[i].completed,
                                onChanged: (_) => _toggleUnit(s, i),
                                title: Text(s.units[i].title,
                                    style: const TextStyle(fontSize: 13)),
                                subtitle: s.units[i].topics.isEmpty
                                    ? null
                                    : Text(s.units[i].topics.join(', '),
                                        style: const TextStyle(fontSize: 11)),
                                activeColor: AppColors.teacherPrimary,
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
        Positioned(
          right: 20,
          bottom: _fabBottom(context),
          child: NeuButton(
            label: 'New syllabus',
            icon: Icons.add,
            fullWidth: false,
            onPressed: _openNewSyllabus,
          ),
        ),
      ],
    );
  }

  void _openNewSyllabus() {
    final subject = TextEditingController();
    final now = DateTime.now();
    // Preschool academic years commonly span two calendar years.
    final year = TextEditingController(text: '${now.year}-${now.year + 1}');
    final units =
        <({TextEditingController title, TextEditingController topics})>[
      (title: TextEditingController(), topics: TextEditingController()),
    ];
    showAppBottomSheet<void>(
      context: context,
      child: StatefulBuilder(builder: (ctx, setSt) {
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('New syllabus',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark)),
              const SizedBox(height: 16),
              TextField(
                controller: subject,
                decoration: const InputDecoration(
                  labelText: 'Subject',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: year,
                decoration: const InputDecoration(
                  labelText: 'Academic year',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Units',
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark)),
              const SizedBox(height: 8),
              for (int i = 0; i < units.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          children: [
                            TextField(
                              controller: units[i].title,
                              decoration: InputDecoration(
                                labelText: 'Unit ${i + 1} title',
                                isDense: true,
                                border: const OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: units[i].topics,
                              decoration: const InputDecoration(
                                labelText: 'Topics (comma separated)',
                                isDense: true,
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (units.length > 1)
                        IconButton(
                          icon: const Icon(Iconsax.trash,
                              size: 18, color: AppColors.danger),
                          onPressed: () => setSt(() => units.removeAt(i)),
                        ),
                    ],
                  ),
                ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setSt(() => units.add((
                        title: TextEditingController(),
                        topics: TextEditingController(),
                      ))),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add unit'),
                  style: TextButton.styleFrom(
                      foregroundColor: AppColors.teacherPrimary),
                ),
              ),
              const SizedBox(height: 12),
              PrimaryButton(
                label: 'Save syllabus',
                color: AppColors.teacherPrimary,
                fullWidth: true,
                onPressed: () async {
                  if (subject.text.trim().isEmpty ||
                      year.text.trim().isEmpty) {
                    AppToast.show(ctx, 'Subject and academic year are required',
                        type: ToastType.error);
                    return;
                  }
                  final unitModels = [
                    for (final u in units)
                      if (u.title.text.trim().isNotEmpty)
                        SyllabusUnitModel(
                          title: u.title.text.trim(),
                          topics: u.topics.text
                              .split(',')
                              .map((t) => t.trim())
                              .where((t) => t.isNotEmpty)
                              .toList(),
                        ),
                  ];
                  try {
                    await TeacherApi.instance.upsertSyllabus(
                      classId: widget.classId,
                      subject: subject.text.trim(),
                      academicYear: year.text.trim(),
                      units: unitModels,
                    );
                    if (!ctx.mounted) return;
                    Navigator.pop(ctx);
                    if (!mounted) return;
                    AppToast.show(context, 'Syllabus saved',
                        type: ToastType.success);
                    _reload();
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
}

// ── Lesson plans ─────────────────────────────────────────────

class _LessonPlansTab extends StatefulWidget {
  const _LessonPlansTab({super.key, required this.classId});
  final String classId;

  @override
  State<_LessonPlansTab> createState() => _LessonPlansTabState();
}

class _LessonPlansTabState extends State<_LessonPlansTab> {
  late Future<List<LessonPlanModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.getLessonPlans(widget.classId);
  }

  void _reload() {
    setState(() {
      _future = TeacherApi.instance.getLessonPlans(widget.classId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        FutureBuilder<List<LessonPlanModel>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data ?? const <LessonPlanModel>[];
            if (items.isEmpty) {
              return const EmptyState(
                emoji: '🗒️',
                title: 'No lesson plans',
                subtitle: 'Tap "New lesson" to plan your first lesson.',
              );
            }
            return RefreshIndicator(
              onRefresh: () async => _reload(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                padding: EdgeInsets.fromLTRB(
                    20, 16, 20, _listBottomInset(context)),
                children: [
                  for (final l in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: NeuCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                                '${l.title}${l.date != null ? ' — ${Formatters.formatShortDate(l.date!)}' : ''}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15)),
                            if (l.subject != null) ...[
                              const SizedBox(height: 2),
                              Text(l.subject!,
                                  style: const TextStyle(
                                      color: AppColors.teacherPrimary,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600)),
                            ],
                            if (l.summary.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(l.summary,
                                  style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 13,
                                      height: 1.4)),
                            ],
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
        Positioned(
          right: 20,
          bottom: _fabBottom(context),
          child: NeuButton(
            label: 'New lesson',
            icon: Icons.add,
            fullWidth: false,
            onPressed: _openNewLesson,
          ),
        ),
      ],
    );
  }

  void _openNewLesson() {
    final title = TextEditingController();
    final subject = TextEditingController();
    final body = TextEditingController();
    DateTime date = DateTime.now();
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
              const Text('New lesson plan',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textDark)),
              const SizedBox(height: 12),
              TextField(
                controller: title,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: subject,
                decoration: const InputDecoration(
                  labelText: 'Subject',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                tileColor: AppColors.softWhite,
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
                    firstDate: DateTime(2026, 1, 1),
                    lastDate: DateTime(2027, 12, 31),
                  );
                  if (picked != null) setSt(() => date = picked);
                },
              ),
              const SizedBox(height: 8),
              TextField(
                controller: body,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Activities (one per line)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: 'Save',
                color: AppColors.teacherPrimary,
                fullWidth: true,
                onPressed: () async {
                  if (title.text.trim().isEmpty ||
                      subject.text.trim().isEmpty) {
                    AppToast.show(ctx, 'Title and subject are required',
                        type: ToastType.error);
                    return;
                  }
                  try {
                    await TeacherApi.instance.createLessonPlan(
                      classId: widget.classId,
                      subject: subject.text.trim(),
                      title: title.text.trim(),
                      date:
                          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
                      activities: body.text
                          .split('\n')
                          .map((l) => l.trim())
                          .where((l) => l.isNotEmpty)
                          .toList(),
                    );
                    if (!ctx.mounted) return;
                    Navigator.pop(ctx);
                    if (!mounted) return;
                    AppToast.show(context, 'Lesson plan saved',
                        type: ToastType.success);
                    _reload();
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
}
