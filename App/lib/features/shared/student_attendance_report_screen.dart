import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/network/api_models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/atoms.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/neu.dart';

typedef StudentReportFetcher = Future<StudentAttendanceReport> Function(
    String from, String to);
typedef HolidayFetcher = Future<List<HolidayModel>> Function();

/// A student's monthly attendance — shared by the teacher and admin apps.
/// Mirrors the parent app's attendance screen: summary tiles, a month
/// calendar with per-day status dots (green present, red absent, orange
/// late, blue holiday) and a monthly percentage card.
///
/// The caller supplies a [fetch] bound to their own API client and an
/// [accent] for their role's colour. Pass [fetchHolidays] to overlay school
/// holidays on the calendar.
class StudentAttendanceReportScreen extends StatefulWidget {
  const StudentAttendanceReportScreen({
    super.key,
    required this.studentName,
    required this.accent,
    required this.fetch,
    this.fetchHolidays,
  });

  final String studentName;
  final Color accent;
  final StudentReportFetcher fetch;
  final HolidayFetcher? fetchHolidays;

  @override
  State<StudentAttendanceReportScreen> createState() =>
      _StudentAttendanceReportScreenState();
}

class _StudentAttendanceReportScreenState
    extends State<StudentAttendanceReportScreen> {
  late DateTime _month;
  late Future<StudentAttendanceReport> _future;

  /// 'YYYY-MM-DD' → holiday title. The endpoint returns the whole school year
  /// at once, so this is fetched once rather than per month.
  Map<String, String> _holidays = const {};

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month, 1);
    _future = _load();
    _loadHolidays();
  }

  Future<void> _loadHolidays() async {
    final fetchHolidays = widget.fetchHolidays;
    if (fetchHolidays == null) return;
    final list = await fetchHolidays();
    if (!mounted) return;
    setState(() {
      _holidays = {for (final h in list) _keyOf(h.date): h.title};
    });
  }

  static String _keyOf(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  Future<StudentAttendanceReport> _load() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    String fmt(DateTime d) => d.toIso8601String().split('T').first;
    // Whole selected month, capped at today so the report never spans the
    // future (which would dilute workingDays / presentRate).
    final lastDay = DateTime(_month.year, _month.month + 1, 0);
    final to = lastDay.isAfter(today) ? today : lastDay;
    return widget.fetch(fmt(_month), fmt(to));
  }

  bool get _atCurrentMonth {
    final now = DateTime.now();
    return _month.year == now.year && _month.month == now.month;
  }

  void _prevMonth() => setState(() {
        _month = DateTime(_month.year, _month.month - 1, 1);
        _future = _load();
      });

  void _nextMonth() {
    if (_atCurrentMonth) return;
    setState(() {
      _month = DateTime(_month.year, _month.month + 1, 1);
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Text('${widget.studentName} · Attendance',
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.textDark)),
      ),
      body: FutureBuilder<StudentAttendanceReport>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Could not load the report.',
                        style: TextStyle(color: AppColors.textMuted)),
                    const SizedBox(height: 12),
                    SecondaryButton(
                      label: 'Try again',
                      color: widget.accent,
                      onPressed: () => setState(() {
                        _future = _load();
                      }),
                    ),
                  ],
                ),
              ),
            );
          }

          final rep = snap.data;
          final loading = snap.connectionState == ConnectionState.waiting;
          final percentage = (rep?.presentRate ?? 0) / 100;

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
                        value: '${rep?.present ?? 0}',
                        color: AppColors.success),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _SummaryTile(
                        label: 'Absent',
                        value: '${rep?.absent ?? 0}',
                        color: AppColors.danger),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _SummaryTile(
                        label: 'Late',
                        value: '${rep?.late ?? 0}',
                        color: AppColors.warning),
                  ),
                ],
              )
                  .animate()
                  .fadeIn(duration: 320.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.05),

              const SizedBox(height: 16),

              _calendarCard(rep),

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
                                    widget.accent.withValues(alpha: 0.16),
                                valueColor:
                                    AlwaysStoppedAnimation(widget.accent),
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
            ],
          );
        },
      ),
    );
  }

  /// Month calendar with per-day status dots — same look and colours as the
  /// parent app's attendance calendar.
  Widget _calendarCard(StudentAttendanceReport? rep) {
    final statusMap = {
      for (final d in rep?.days ?? const <StudentAttendanceDay>[])
        d.date: d.status,
    };
    final daysInMonth = DateUtils.getDaysInMonth(_month.year, _month.month);
    final firstWeekday = _month.weekday % 7; // 0 = Sun
    final cells = <Widget>[];
    for (int i = 0; i < firstWeekday; i++) {
      cells.add(const SizedBox());
    }
    for (int d = 1; d <= daysInMonth; d++) {
      final date = DateTime(_month.year, _month.month, d);
      final key = _keyOf(date);
      // A real attendance record always wins — on a holiday a student who was
      // marked present should still read as present. The holiday is the
      // fallback look for days with no record.
      cells.add(_DayCell(
        date: date,
        status: statusMap[key],
        holiday: _holidays[key],
        accent: widget.accent,
      ));
    }

    return NeuCard(
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
                onPressed: _atCurrentMonth ? null : _nextMonth,
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
    );
  }
}

String _statusLabel(String s) => switch (s) {
      'present' => 'Present',
      'absent' => 'Absent',
      'late' => 'Late',
      'half_day' => 'Half day',
      'on_leave' => 'On leave',
      'holiday' => 'Holiday',
      _ => s,
    };

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
                  color: color, fontSize: 22, fontWeight: FontWeight.w700)),
          Text(label,
              style: TextStyle(
                  color: color, fontSize: 12, fontWeight: FontWeight.w600)),
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

/// One calendar day: date number over a status dot. Same colour coding as the
/// parent app — green present, red absent, orange late, blue holiday.
class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.status,
    required this.accent,
    this.holiday,
  });

  final DateTime date;

  /// Raw report status ('present' | 'absent' | 'late' | 'half_day' |
  /// 'on_leave' | 'holiday'), or null when the day has no record.
  final String? status;
  final Color accent;

  /// Title of the school holiday falling on this day, when the admin marked
  /// one — e.g. "Diwali". Rendered as a blue dot.
  final String? holiday;

  bool get _isHoliday => holiday != null && holiday!.isNotEmpty;

  Color? get _dot {
    switch (status) {
      case 'present':
        return AppColors.success;
      case 'absent':
        return AppColors.danger;
      case 'late':
      case 'half_day':
        return AppColors.warning;
      case 'on_leave':
      case 'holiday':
        return AppColors.info;
      default:
        // No attendance record: a marked holiday is why, so say so in blue.
        return _isHoliday ? AppColors.info : null;
    }
  }

  String get _detailLabel {
    if (status != null) return _statusLabel(status!);
    if (_isHoliday) return holiday!;
    final weekend =
        date.weekday == DateTime.saturday || date.weekday == DateTime.sunday;
    return weekend ? 'Weekend / Holiday' : 'Not marked';
  }

  void _showDayDetail(BuildContext context) {
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
            Text(_detailLabel,
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: _dot ??
                        (status != null ? accent : AppColors.textMuted))),
            // A student can be marked present on a holiday (a school event,
            // say), in which case the label above shows the attendance — so
            // name the holiday here rather than losing it.
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
