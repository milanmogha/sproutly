import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/models/student.dart';
import '../../../core/network/parent_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/neu.dart';

class ParentAcademicsScreen extends StatefulWidget {
  const ParentAcademicsScreen({super.key});

  @override
  State<ParentAcademicsScreen> createState() => _ParentAcademicsScreenState();
}

class _AcademicsData {
  const _AcademicsData({
    required this.homework,
    required this.assessments,
    required this.results,
    required this.syllabus,
    required this.lessonPlans,
  });

  final List<HomeworkModel> homework;
  final List<AssessmentModel> assessments;
  final List<ResultModel> results;
  final List<SyllabusModel> syllabus;
  final List<LessonPlanModel> lessonPlans;
}

class _ParentAcademicsScreenState extends State<ParentAcademicsScreen> {
  Future<_AcademicsData>? _future;
  Student? _child;

  @override
  void initState() {
    super.initState();
    ParentApi.instance.selectedChild.addListener(_onChildChanged);
    _load();
  }

  void _onChildChanged() {
    if (mounted) _load();
  }

  Future<_AcademicsData> _fetch(Student child) async {
    final api = ParentApi.instance;
    final results = await Future.wait([
      child.classId == null
          ? Future.value(<HomeworkModel>[])
          : api.getHomework(child.classId!),
      child.classId == null
          ? Future.value(<AssessmentModel>[])
          : api.getAssessments(child.classId!),
      api.getStudentProgress(child.id),
      child.classId == null
          ? Future.value(<SyllabusModel>[])
          : api.getSyllabus(child.classId!),
      child.classId == null
          ? Future.value(<LessonPlanModel>[])
          : api.getLessonPlans(child.classId!),
    ]);
    return _AcademicsData(
      homework: results[0] as List<HomeworkModel>,
      assessments: results[1] as List<AssessmentModel>,
      results: results[2] as List<ResultModel>,
      syllabus: results[3] as List<SyllabusModel>,
      lessonPlans: results[4] as List<LessonPlanModel>,
    );
  }

  void _load() {
    setState(() {
      _child = ParentApi.instance.selectedChild.value;
      if (_child == null) {
        _future = ParentApi.instance.childrenCached().then((kids) {
          final kid = ParentApi.instance.selectedChild.value;
          if (kid == null) {
            return const _AcademicsData(
                homework: [],
                assessments: [],
                results: [],
                syllabus: [],
                lessonPlans: []);
          }
          _child = kid;
          return _fetch(kid);
        });
      } else {
        _future = _fetch(_child!);
      }
    });
  }

  @override
  void dispose() {
    ParentApi.instance.selectedChild.removeListener(_onChildChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text(
            _child == null ? 'Academics' : 'Academics • ${_child!.firstName}',
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.textDark)),
      ),
      body: DefaultTabController(
        length: 5,
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: _AcademicsTabBar(),
            ),
            Expanded(
              child: FutureBuilder<_AcademicsData>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return EmptyState(
                      emoji: '⚠️',
                      title: 'Could not load academics',
                      subtitle: '${snap.error}',
                    );
                  }
                  final data = snap.data ??
                      const _AcademicsData(
                          homework: [],
                          assessments: [],
                          results: [],
                          syllabus: [],
                          lessonPlans: []);
                  return TabBarView(
                    children: [
                      _HomeworkTab(homework: data.homework, onRefresh: _load),
                      _AssignmentsTab(
                          assessments: data.assessments, onRefresh: _load),
                      _ResultsTab(results: data.results, onRefresh: _load),
                      _SyllabusTab(syllabus: data.syllabus, onRefresh: _load),
                      _LessonPlansTab(
                          lessonPlans: data.lessonPlans, onRefresh: _load),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Tab selector ─────────────────────────────────────────────

/// Soft-UI segmented selector for the Academics tabs: a carved-in (concave)
/// track holding a raised deep-green pill that slides between tabs. Each tab
/// pairs an icon with its label, and animated edge fades with chevrons hint
/// when more tabs (e.g. Syllabus) sit off-screen.
class _AcademicsTabBar extends StatefulWidget {
  const _AcademicsTabBar();

  @override
  State<_AcademicsTabBar> createState() => _AcademicsTabBarState();
}

class _AcademicsTabBarState extends State<_AcademicsTabBar> {
  static const Color _accent = AppColors.parentPrimary;

  bool _canScrollLeft = false;
  bool _canScrollRight = false;

  bool _onScroll(Notification n) {
    ScrollMetrics? m;
    if (n is ScrollNotification && n.metrics.axis == Axis.horizontal) {
      m = n.metrics;
    } else if (n is ScrollMetricsNotification &&
        n.metrics.axis == Axis.horizontal) {
      m = n.metrics;
    }
    if (m == null || !m.hasContentDimensions) return false;
    final left = m.extentBefore > 4;
    final right = m.extentAfter > 4;
    if (left != _canScrollLeft || right != _canScrollRight) {
      setState(() {
        _canScrollLeft = left;
        _canScrollRight = right;
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    // Convex accent face for the sliding pill — same recipe as NeuButton.
    final pill = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color.lerp(_accent, Colors.white, 0.20)!,
        Color.lerp(_accent, Colors.black, 0.10)!,
      ],
    );
    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        gradient: Neu.concave,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x1A1E3A8A), width: 0.8),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(13),
        child: Stack(
          children: [
            NotificationListener<Notification>(
              onNotification: _onScroll,
              child: TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                dividerColor: Colors.transparent,
                splashFactory: NoSplash.splashFactory,
                overlayColor:
                    const WidgetStatePropertyAll(Colors.transparent),
                onTap: (_) => HapticFeedback.selectionClick(),
                indicatorSize: TabBarIndicatorSize.tab,
                indicator: BoxDecoration(
                  gradient: pill,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    const BoxShadow(
                        offset: Offset(-2, -2),
                        blurRadius: 5,
                        color: Color(0x40FFFFFF)),
                    BoxShadow(
                        offset: const Offset(2, 4),
                        blurRadius: 9,
                        color: _accent.withValues(alpha: 0.33)),
                  ],
                ),
                labelColor: Colors.white,
                unselectedLabelColor: AppColors.textMuted,
                labelStyle: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 13),
                unselectedLabelStyle: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 13),
                labelPadding: const EdgeInsets.symmetric(horizontal: 14),
                tabs: const [
                  _AcademicsTab(
                      icon: Icons.edit_note_rounded, label: 'Homework'),
                  _AcademicsTab(
                      icon: Icons.assignment_rounded, label: 'Assignments'),
                  _AcademicsTab(
                      icon: Icons.bar_chart_rounded, label: 'Results'),
                  _AcademicsTab(
                      icon: Icons.menu_book_rounded, label: 'Syllabus'),
                  _AcademicsTab(
                      icon: Icons.event_note_rounded, label: 'Lesson Plans'),
                ],
              ),
            ),
            _TabEdgeFade(visible: _canScrollLeft, leftEdge: true),
            _TabEdgeFade(visible: _canScrollRight, leftEdge: false),
          ],
        ),
      ),
    );
  }
}

/// Icon + label content for one tab. Colors are inherited from the TabBar's
/// label styles, so the icon and text animate together between states.
class _AcademicsTab extends StatelessWidget implements PreferredSizeWidget {
  const _AcademicsTab({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Size get preferredSize => const Size.fromHeight(42);

  @override
  Widget build(BuildContext context) {
    return Tab(
      height: 42,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 17),
          const SizedBox(width: 6),
          Text(label),
        ],
      ),
    );
  }
}

/// Soft gradient + chevron overlaid on one edge of the track while more tabs
/// remain off-screen in that direction. Fades away at the ends.
class _TabEdgeFade extends StatelessWidget {
  const _TabEdgeFade({required this.visible, required this.leftEdge});
  final bool visible;
  final bool leftEdge;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      bottom: 0,
      left: leftEdge ? 0 : null,
      right: leftEdge ? null : 0,
      child: IgnorePointer(
        child: AnimatedOpacity(
          opacity: visible ? 1 : 0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          child: Container(
            width: 34,
            alignment:
                leftEdge ? Alignment.centerLeft : Alignment.centerRight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin:
                    leftEdge ? Alignment.centerRight : Alignment.centerLeft,
                end: leftEdge ? Alignment.centerLeft : Alignment.centerRight,
                colors: const [Color(0x00E4ECE8), Color(0xF2E4ECE8)],
              ),
            ),
            child: Icon(
              leftEdge
                  ? Icons.chevron_left_rounded
                  : Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Assignments (assessments) ────────────────────────────────

class _AssignmentsTab extends StatelessWidget {
  const _AssignmentsTab({required this.assessments, required this.onRefresh});
  final List<AssessmentModel> assessments;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: assessments.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              children: const [
                SizedBox(height: 60),
                EmptyState(
                  emoji: '📝',
                  title: 'No assignments',
                  subtitle: 'Assignments set by the teacher will appear here.',
                ),
              ],
            )
          : ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              children: [
                for (final a in assessments)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: NeuCard(
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.parentTint,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            alignment: Alignment.center,
                            child: Text(_typeEmoji(a.type),
                                style: const TextStyle(fontSize: 20)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(a.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14)),
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    if (a.type != null) _typeLabel(a.type!),
                                    if (a.subject != null) a.subject!,
                                    if (a.date != null)
                                      Formatters.formatShortDate(a.date!),
                                  ].join(' · '),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          if (a.maxScore != null) ...[
                            const SizedBox(width: 8),
                            StatusChip(
                              label: 'Max ${a.maxScore!.toStringAsFixed(0)}',
                              type: ChipType.info,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  static String _typeLabel(String t) =>
      t.isEmpty ? t : '${t[0].toUpperCase()}${t.substring(1)}';

  static String _typeEmoji(String? t) {
    switch (t) {
      case 'quiz':
        return '❓';
      case 'test':
        return '🧠';
      case 'exam':
        return '📄';
      case 'project':
        return '🛠️';
      case 'oral':
        return '🗣️';
      case 'observation':
        return '👀';
      default:
        return '📝';
    }
  }
}

// ── Syllabus / curriculum ────────────────────────────────────

class _SyllabusTab extends StatelessWidget {
  const _SyllabusTab({required this.syllabus, required this.onRefresh});
  final List<SyllabusModel> syllabus;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: syllabus.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              children: const [
                SizedBox(height: 60),
                EmptyState(
                  emoji: '📗',
                  title: 'No syllabus yet',
                  subtitle:
                      'The class syllabus will appear here once the school adds it.',
                ),
              ],
            )
          : ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              padding: const EdgeInsets.all(20),
              children: [
                for (final s in syllabus) _SyllabusCard(syllabus: s),
              ],
            ),
    );
  }
}

class _SyllabusCard extends StatelessWidget {
  const _SyllabusCard({required this.syllabus});
  final SyllabusModel syllabus;

  @override
  Widget build(BuildContext context) {
    final done = syllabus.units.where((u) => u.completed).length;
    final total = syllabus.units.length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: NeuCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(syllabus.subject,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                          color: AppColors.textDark)),
                ),
                if (syllabus.academicYear.isNotEmpty)
                  Text(syllabus.academicYear,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 12)),
              ],
            ),
            if (total > 0) ...[
              const SizedBox(height: 4),
              Text('$done of $total units completed',
                  style: const TextStyle(
                      color: AppColors.parentPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              for (final u in syllabus.units) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      u.completed
                          ? Icons.check_circle_rounded
                          : Icons.radio_button_unchecked_rounded,
                      size: 18,
                      color: u.completed
                          ? AppColors.success
                          : AppColors.mutedGray,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(u.title,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textDark,
                                  fontSize: 14)),
                          if (u.topics.isNotEmpty)
                            Text(u.topics.join(' · '),
                                style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                    height: 1.4)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
            ] else
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text('No units added yet.',
                    style:
                        TextStyle(color: AppColors.textMuted, fontSize: 13)),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Homework ─────────────────────────────────────────────────

class _HomeworkTab extends StatelessWidget {
  const _HomeworkTab({required this.homework, required this.onRefresh});
  final List<HomeworkModel> homework;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: homework.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              children: const [
                SizedBox(height: 60),
                EmptyState(
                  emoji: '🎨',
                  title: 'No homework',
                  subtitle: 'Assignments from the teacher will appear here.',
                ),
              ],
            )
          : ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              children: [
                for (final hw in homework)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: NeuCard(
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.parentTint,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            alignment: Alignment.center,
                            child: Text(_subjectEmoji(hw.subject),
                                style: const TextStyle(fontSize: 20)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(hw.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14)),
                                const SizedBox(height: 2),
                                Text(
                                  hw.description ?? hw.subject,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          StatusChip(
                            label: hw.dueDate == null
                                ? 'No due'
                                : 'Due ${Formatters.formatShortDate(hw.dueDate!)}',
                            type: hw.dueDate != null &&
                                    hw.dueDate!.isBefore(DateTime.now())
                                ? ChipType.danger
                                : ChipType.warning,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  static String _subjectEmoji(String subject) {
    final s = subject.toLowerCase();
    if (s.contains('math') || s.contains('number')) return '🔢';
    if (s.contains('art') || s.contains('draw')) return '🎨';
    if (s.contains('music') || s.contains('rhyme')) return '🎵';
    if (s.contains('lang') || s.contains('english') || s.contains('read')) {
      return '📚';
    }
    if (s.contains('science') || s.contains('nature')) return '🌱';
    return '✏️';
  }
}

// ── Results ──────────────────────────────────────────────────

class _ResultsTab extends StatelessWidget {
  const _ResultsTab({required this.results, required this.onRefresh});
  final List<ResultModel> results;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: results.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              children: const [
                SizedBox(height: 60),
                EmptyState(
                  emoji: '📊',
                  title: 'No results yet',
                  subtitle: 'Assessment results will appear here.',
                ),
              ],
            )
          : ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              children: [
                NeuCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Assessment results',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16)),
                      const SizedBox(height: 14),
                      for (final r in results)
                        _ScoreRow(result: r),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _ScoreRow extends StatelessWidget {
  const _ScoreRow({required this.result});
  final ResultModel result;

  @override
  Widget build(BuildContext context) {
    final fraction = result.fraction;
    final label = result.assessmentTitle ?? result.subject ?? 'Assessment';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
              Text(
                result.maxScore == null
                    ? '${result.score}'
                    : '${result.score}/${result.maxScore!.toStringAsFixed(0)}',
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.parentPrimary),
              ),
              if (result.grade != null) ...[
                const SizedBox(width: 8),
                StatusChip(label: result.grade!, type: ChipType.info),
              ],
            ],
          ),
          if (fraction != null) ...[
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: fraction.clamp(0.0, 1.0)),
                duration: const Duration(milliseconds: 800),
                builder: (_, v, _) => LinearProgressIndicator(
                  value: v,
                  minHeight: 8,
                  backgroundColor:
                      AppColors.parentPrimary.withValues(alpha: 0.12),
                  valueColor:
                      const AlwaysStoppedAnimation(AppColors.parentPrimary),
                ),
              ),
            ),
          ],
          if (result.remarks != null) ...[
            const SizedBox(height: 4),
            Text(result.remarks!,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}

// ── Lesson plans ─────────────────────────────────────────────

class _LessonPlansTab extends StatelessWidget {
  const _LessonPlansTab({required this.lessonPlans, required this.onRefresh});
  final List<LessonPlanModel> lessonPlans;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: lessonPlans.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              children: const [
                SizedBox(height: 60),
                EmptyState(
                  emoji: '🗒️',
                  title: 'No lesson plans',
                  subtitle: "The teacher's lesson plans will appear here.",
                ),
              ],
            )
          : ListView(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              children: [
                for (final l in lessonPlans)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: NeuCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(l.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 15,
                                        color: AppColors.textDark)),
                              ),
                              if (l.date != null)
                                Text(Formatters.formatShortDate(l.date!),
                                    style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 12)),
                            ],
                          ),
                          if (l.subject != null) ...[
                            const SizedBox(height: 2),
                            Text(l.subject!,
                                style: const TextStyle(
                                    color: AppColors.parentPrimary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600)),
                          ],
                          if (l.objectives.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            _LessonSection(
                                label: 'Objectives', items: l.objectives),
                          ],
                          if (l.activities.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            _LessonSection(
                                label: 'Activities', items: l.activities),
                          ],
                          if (l.resources != null &&
                              l.resources!.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text('Resources: ${l.resources!}',
                                style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                    height: 1.4)),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}

/// A labelled, bulleted list used for a lesson plan's objectives / activities.
class _LessonSection extends StatelessWidget {
  const _LessonSection({required this.label, required this.items});
  final String label;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: AppColors.textDark)),
        const SizedBox(height: 2),
        for (final it in items)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('•  $it',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 12, height: 1.4)),
          ),
      ],
    );
  }
}
