import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/network/parent_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/neu.dart';

class ParentAttendanceScreen extends StatefulWidget {
  const ParentAttendanceScreen({super.key, this.studentId});
  final String? studentId;

  @override
  State<ParentAttendanceScreen> createState() => _ParentAttendanceScreenState();
}

class _ParentAttendanceScreenState extends State<ParentAttendanceScreen> {
  late DateTime _month;
  late Future<MonthlyAttendance> _future;

  /// Holidays the admin marked, keyed 'YYYY-MM-DD' → title. The endpoint
  /// returns the whole school year at once, so this is fetched once rather
  /// than per month.
  Map<String, String> _holidays = const {};

  // Opened from the home card the id is passed in; from the bottom navbar it
  // isn't, so fall back to the currently selected child.
  String? get _studentId =>
      widget.studentId ?? ParentApi.instance.selectedChild.value?.id;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month, 1);
    _loadMonth();
    _loadHolidays();
    // The navbar builds this tab before the child is loaded — reload once it is.
    ParentApi.instance.selectedChild.addListener(_reload);
  }

  Future<void> _loadHolidays() async {
    final list = await ParentApi.instance.listHolidays();
    if (!mounted) return;
    setState(() {
      _holidays = {for (final h in list) _keyOf(h.date): h.title};
    });
  }

  static String _keyOf(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  @override
  void dispose() {
    ParentApi.instance.selectedChild.removeListener(_reload);
    super.dispose();
  }

  void _reload() {
    if (mounted) setState(_loadMonth);
  }

  void _loadMonth() {
    final id = _studentId;
    if (id == null) {
      _future = Future.value(
          const MonthlyAttendance(records: [], presentDays: 0, absentDays: 0, totalDays: 0));
      return;
    }
    _future = ParentApi.instance.getMonthlyAttendance(id, _month.year, _month.month);
  }

  void _prevMonth() => setState(() {
        _month = DateTime(_month.year, _month.month - 1, 1);
        _loadMonth();
      });

  void _nextMonth() => setState(() {
        _month = DateTime(_month.year, _month.month + 1, 1);
        _loadMonth();
      });

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.parentPrimary;

    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Attendance',
            style: TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.textDark)),
      ),
      body: FutureBuilder<MonthlyAttendance>(
        future: _future,
        builder: (_, snap) {
          final data = snap.data;
          final loading = snap.connectionState == ConnectionState.waiting;

          // Build per-day status map: 'YYYY-MM-DD' → AttStatus
          final Map<String, AttStatus> statusMap = {};
          if (data != null) {
            for (final d in data.records) {
              statusMap[d.date] = d.isPresent
                  ? AttStatus.present
                  : d.isLate
                      ? AttStatus.late
                      : AttStatus.absent;
            }
          }

          final daysInMonth = DateUtils.getDaysInMonth(_month.year, _month.month);
          final firstWeekday = _month.weekday % 7; // 0 = Sun
          final cells = <Widget>[];
          for (int i = 0; i < firstWeekday; i++) {
            cells.add(const SizedBox());
          }
          for (int d = 1; d <= daysInMonth; d++) {
            final date = DateTime(_month.year, _month.month, d);
            final key =
                '${_month.year}-${_month.month.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
            // A real attendance record always wins — schools can hold classes
            // on Saturdays, and on a holiday a child who was marked present
            // should still read as present. The holiday is the fallback look
            // for days with no record (see _DayCell._statusLabel).
            cells.add(_DayCell(
              date: date,
              status: statusMap[key],
              holiday: _holidays[key],
            ));
          }

          final presentDays = data?.presentDays ?? 0;
          final absentDays = data?.absentDays ?? 0;
          final lateDays = data?.records.where((r) => r.isLate).length ?? 0;
          final percentage = data?.percentage ?? 0.0;

          return ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: [
              if (loading) const LinearProgressIndicator(),
              // Summary tiles
              Row(
                children: [
                  Expanded(
                    child: _SummaryTile(
                        label: 'Present',
                        value: '$presentDays',
                        color: AppColors.success),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _SummaryTile(
                        label: 'Absent',
                        value: '$absentDays',
                        color: AppColors.danger),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _SummaryTile(
                        label: 'Late',
                        value: '$lateDays',
                        color: AppColors.warning),
                  ),
                ],
              )
                  .animate()
                  .fadeIn(duration: 320.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.05),

              const SizedBox(height: 16),

              // Calendar card
              NeuCard(
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.chevron_left_rounded),
                          onPressed: _prevMonth,
                        ),
                        Expanded(
                          child: Text(
                            '${_month.year} • ${_month.month.toString().padLeft(2, '0')}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 16),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.chevron_right_rounded),
                          onPressed: _nextMonth,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _WeekdayLabel('S'),
                        _WeekdayLabel('M'),
                        _WeekdayLabel('T'),
                        _WeekdayLabel('W'),
                        _WeekdayLabel('T'),
                        _WeekdayLabel('F'),
                        _WeekdayLabel('S'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 7,
                      childAspectRatio: 0.82,
                      children: cells,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Monthly % card
              NeuCard(
                child: Row(
                  children: [
                    SizedBox(
                      width: 80,
                      height: 80,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          TweenAnimationBuilder<double>(
                            tween: Tween(begin: 0, end: percentage),
                            duration: const Duration(milliseconds: 900),
                            curve: Curves.easeOutCubic,
                            builder: (_, v, _) => SizedBox(
                              width: 80,
                              height: 80,
                              child: CircularProgressIndicator(
                                value: v,
                                backgroundColor:
                                    accent.withValues(alpha: 0.16),
                                valueColor: AlwaysStoppedAnimation(accent),
                                strokeWidth: 7,
                              ),
                            ),
                          ),
                          Text(
                            '${(percentage * 100).toStringAsFixed(1)}%',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: AppColors.textDark,
                                fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Monthly attendance',
                              style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                  color: AppColors.textDark)),
                          const SizedBox(height: 4),
                          Text(
                            percentage >= 0.9
                                ? 'Excellent attendance this month!'
                                : percentage >= 0.75
                                    ? 'Good — keep it up!'
                                    : 'Needs improvement.',
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              if (_studentId == null)
                const Padding(
                  padding: EdgeInsets.only(top: 16),
                  child: Text(
                    'No student selected. Tap a child on the home screen first.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

enum AttStatus { present, absent, late }

class _SummaryTile extends StatelessWidget {
  const _SummaryTile(
      {required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return NeuBox(
      radius: 16,
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  color: color,
                  fontSize: 22,
                  fontWeight: FontWeight.w700)),
          Text(label,
              style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _WeekdayLabel extends StatelessWidget {
  const _WeekdayLabel(this.l);
  final String l;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 32,
      child: Text(l,
          textAlign: TextAlign.center,
          style: const TextStyle(
              color: AppColors.textMuted,
              fontWeight: FontWeight.w600,
              fontSize: 12)),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({required this.date, required this.status, this.holiday});
  final DateTime date;
  final AttStatus? status;

  /// Title of the school holiday falling on this day, when the admin marked
  /// one — e.g. "Diwali". Rendered as a blue dot.
  final String? holiday;

  bool get _isHoliday => holiday != null && holiday!.isNotEmpty;

  Color? get _dot {
    switch (status) {
      case AttStatus.present:
        return AppColors.success;
      case AttStatus.absent:
        return AppColors.danger;
      case AttStatus.late:
        return AppColors.warning;
      default:
        // No attendance record: a marked holiday is why, so say so in blue.
        return _isHoliday ? AppColors.info : null;
    }
  }

  String get _statusLabel {
    switch (status) {
      case AttStatus.present:
        return 'Present';
      case AttStatus.absent:
        return 'Absent';
      case AttStatus.late:
        return 'Late';
      default:
        if (_isHoliday) return holiday!;
        final weekend = date.weekday == DateTime.saturday ||
            date.weekday == DateTime.sunday;
        return weekend ? 'Weekend / Holiday' : 'Not marked';
    }
  }

  void _showDayDetail(BuildContext context) {
    final accent = AppColors.parentPrimary;
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(Formatters.formatDate(date),
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted)),
            const SizedBox(height: 4),
            Text(_statusLabel,
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: _dot ??
                        (status != null ? accent : AppColors.textMuted))),
            // A child can be marked present on a holiday (a school event, say),
            // in which case the label above shows the attendance — so name the
            // holiday here rather than losing it.
            if (_isHoliday && status != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('School holiday — ${holiday!}',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textMuted)),
              )
            else if (_isHoliday)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('School holiday',
                    style: TextStyle(
                        fontSize: 13, color: AppColors.textMuted)),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => _showDayDetail(context),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('${date.day}',
                  maxLines: 1,
                  style: TextStyle(
                    color: status == null
                        ? AppColors.textMuted
                        : AppColors.textDark,
                    fontWeight: FontWeight.w600,
                  )),
              const SizedBox(height: 2),
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _dot ?? Colors.transparent,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
