/// Shared wire models for the real backend, used by ParentApi, TeacherApi
/// and AdminApi. Field names mirror the NestJS schemas.
library;

import 'api_config.dart';

String _id(Map<String, dynamic> j) =>
    j['_id'] as String? ?? j['id'] as String? ?? '';

DateTime? _date(dynamic v) => v is String ? DateTime.tryParse(v) : null;

// ── Fees ─────────────────────────────────────────────────────

class InvoiceLine {
  const InvoiceLine({required this.name, required this.amount});
  final String name;
  final double amount;

  factory InvoiceLine.fromJson(Map<String, dynamic> j) => InvoiceLine(
    name: j['name'] as String? ?? '',
    amount: (j['amount'] as num? ?? 0).toDouble(),
  );
}

class InvoiceModel {
  const InvoiceModel({
    required this.id,
    required this.invoiceNumber,
    required this.period,
    required this.totalAmount,
    required this.amountPaid,
    required this.status,
    this.dueDate,
    this.lineItems = const [],
    this.studentId,
    this.studentName,
    this.admissionNumber,
    this.className,
  });

  final String id;
  final String invoiceNumber;
  final String period;
  final double totalAmount;
  final double amountPaid;
  final String status; // scheduled | pending | partial | paid | overdue
  final DateTime? dueDate;
  final List<InvoiceLine> lineItems;

  /// Who the invoice is for. Only populated on the admin endpoints — the
  /// parent app already knows which child it asked about.
  final String? studentId;
  final String? studentName;
  final String? admissionNumber;
  final String? className;

  double get balance => (totalAmount - amountPaid).clamp(0, double.infinity);
  bool get isPaid => status == 'paid';

  /// A future installment of a session billed in advance: the row exists so
  /// the school can see the plan, but nobody owes it yet. Parents never
  /// receive these — the backend filters them out.
  bool get isScheduled => status == 'scheduled';

  /// True once the due date has passed with money still owed, regardless of
  /// whether a nightly job has flipped the stored status to 'overdue' yet.
  /// A scheduled installment is never overdue — it hasn't been billed.
  bool get isOverdue =>
      !isScheduled &&
      balance > 0 &&
      dueDate != null &&
      dueDate!.isBefore(DateTime.now());

  factory InvoiceModel.fromJson(Map<String, dynamic> j) {
    final student = j['student'];
    final cls = j['classId'];
    return InvoiceModel(
      id: _id(j),
      invoiceNumber: j['invoiceNumber'] as String? ?? '',
      period: j['period'] as String? ?? '',
      totalAmount: (j['totalAmount'] as num? ?? 0).toDouble(),
      amountPaid: (j['amountPaid'] as num? ?? 0).toDouble(),
      status: j['status'] as String? ?? 'pending',
      dueDate: _date(j['dueDate']),
      lineItems: (j['lineItems'] as List<dynamic>? ?? [])
          .map((e) => InvoiceLine.fromJson(e as Map<String, dynamic>))
          .toList(),
      studentId: student is String
          ? student
          : (student is Map<String, dynamic> ? _id(student) : null),
      studentName:
          student is Map<String, dynamic> ? _studentName(student) : null,
      admissionNumber: student is Map<String, dynamic>
          ? student['admissionNumber'] as String?
          : null,
      className: cls is Map<String, dynamic> ? _className(cls) : null,
    );
  }

  static String? _studentName(Map<String, dynamic> s) {
    final name = [s['firstName'], s['lastName']]
        .whereType<String>()
        .where((p) => p.isNotEmpty)
        .join(' ');
    return name.isEmpty ? null : name;
  }
}

String? _className(Map<String, dynamic> cls) {
  final name = cls['name'] as String?;
  if (name == null || name.isEmpty) return null;
  final section = cls['section'] as String?;
  return section == null || section.isEmpty ? name : '$name - $section';
}

/// A fee-structure template (GET /fees/structures item). Components reuse
/// InvoiceLine (name + amount); totalAmount is auto-calculated by the backend.
class FeeStructureModel {
  const FeeStructureModel({
    required this.id,
    required this.name,
    required this.academicYear,
    required this.frequency,
    required this.components,
    required this.totalAmount,
    this.dueDayOfMonth,
    this.classId,
    this.className,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String academicYear;
  final String frequency; // monthly | quarterly | term | annual
  final List<InvoiceLine> components;
  final double totalAmount;
  final int? dueDayOfMonth;
  final String? classId;

  /// Only set when the backend populates classId; null for school-wide
  /// structures or when only the raw id came back.
  final String? className;
  final bool isActive;

  static const _frequencyLabels = {
    'monthly': 'Monthly',
    'quarterly': 'Quarterly',
    'term': 'Term',
    'annual': 'Annual',
  };

  /// How many invoices one session produces for this frequency.
  int get installmentsPerSession => switch (frequency) {
        'monthly' => 12,
        'quarterly' => 4,
        'term' => 2,
        _ => 1,
      };

  String get frequencyLabel => _frequencyLabels[frequency] ?? frequency;

  factory FeeStructureModel.fromJson(Map<String, dynamic> j) {
    final cls = j['classId'];
    return FeeStructureModel(
      id: _id(j),
      name: j['name'] as String? ?? '',
      academicYear: j['academicYear'] as String? ?? '',
      frequency: j['frequency'] as String? ?? 'term',
      components: (j['components'] as List<dynamic>? ?? [])
          .map((e) => InvoiceLine.fromJson(e as Map<String, dynamic>))
          .toList(),
      totalAmount: (j['totalAmount'] as num? ?? 0).toDouble(),
      dueDayOfMonth: (j['dueDayOfMonth'] as num?)?.toInt(),
      classId: cls is String
          ? cls
          : (cls is Map<String, dynamic> ? _id(cls) : null),
      className: cls is Map<String, dynamic> ? _className(cls) : null,
      isActive: j['isActive'] as bool? ?? true,
    );
  }
}

// ── Academic ─────────────────────────────────────────────────

class HomeworkModel {
  const HomeworkModel({
    required this.id,
    required this.title,
    required this.subject,
    this.description,
    this.assignedDate,
    this.dueDate,
  });

  final String id;
  final String title;
  final String subject;
  final String? description;
  final DateTime? assignedDate;
  final DateTime? dueDate;

  factory HomeworkModel.fromJson(Map<String, dynamic> j) => HomeworkModel(
    id: _id(j),
    title: j['title'] as String? ?? '',
    subject: j['subject'] as String? ?? '',
    description: j['description'] as String?,
    assignedDate: _date(j['assignedDate']),
    dueDate: _date(j['dueDate']),
  );
}

class RemarkModel {
  const RemarkModel({
    required this.remark,
    required this.category,
    this.date,
    this.term,
  });

  final String remark;
  final String
  category; // academic | behavior | general | appreciation | concern
  final DateTime? date;
  final String? term;

  factory RemarkModel.fromJson(Map<String, dynamic> j) => RemarkModel(
    remark: j['remark'] as String? ?? '',
    category: j['category'] as String? ?? 'general',
    date: _date(j['date']),
    term: j['term'] as String?,
  );
}

class MilestoneModel {
  const MilestoneModel({
    required this.id,
    required this.title,
    required this.category,
    required this.status,
    this.achievedDate,
    this.notes,
  });

  final String id;
  final String title;
  final String category;
  final String status; // not_started | emerging | achieved
  final DateTime? achievedDate;
  final String? notes;

  bool get achieved => status == 'achieved';

  factory MilestoneModel.fromJson(Map<String, dynamic> j) => MilestoneModel(
    id: _id(j),
    title: j['title'] as String? ?? '',
    category: j['category'] as String? ?? 'cognitive',
    status: j['status'] as String? ?? 'not_started',
    achievedDate: _date(j['achievedDate']),
    notes: j['notes'] as String?,
  );
}

class ResultModel {
  const ResultModel({
    required this.id,
    required this.score,
    this.grade,
    this.remarks,
    this.assessmentTitle,
    this.subject,
    this.maxScore,
  });

  final String id;
  final double score;
  final String? grade;
  final String? remarks;
  final String? assessmentTitle;
  final String? subject;
  final double? maxScore;

  double? get fraction =>
      maxScore == null || maxScore == 0 ? null : score / maxScore!;

  factory ResultModel.fromJson(Map<String, dynamic> j) {
    final assessment = j['assessment'];
    final a = assessment is Map<String, dynamic> ? assessment : null;
    return ResultModel(
      id: _id(j),
      score: (j['score'] as num? ?? 0).toDouble(),
      grade: j['grade'] as String?,
      remarks: j['remarks'] as String?,
      assessmentTitle: a?['title'] as String?,
      subject: a?['subject'] as String?,
      maxScore: (a?['maxScore'] as num?)?.toDouble(),
    );
  }
}

class LessonPlanModel {
  const LessonPlanModel({
    required this.id,
    required this.title,
    this.subject,
    this.objectives = const [],
    this.activities = const [],
    this.resources,
    this.date,
  });

  final String id;
  final String title;
  final String? subject;
  final List<String> objectives;
  final List<String> activities;
  final String? resources;
  final DateTime? date;

  String get summary => [
    if (objectives.isNotEmpty) 'Objectives: ${objectives.join(', ')}',
    if (activities.isNotEmpty) 'Activities: ${activities.join(', ')}',
    if (resources != null) 'Resources: $resources',
  ].join('\n');

  factory LessonPlanModel.fromJson(Map<String, dynamic> j) => LessonPlanModel(
    id: _id(j),
    title: j['title'] as String? ?? '',
    subject: j['subject'] as String?,
    objectives: (j['objectives'] as List<dynamic>? ?? [])
        .map((e) => e.toString())
        .toList(),
    activities: (j['activities'] as List<dynamic>? ?? [])
        .map((e) => e.toString())
        .toList(),
    resources: j['resources'] as String?,
    date: _date(j['date']),
  );
}

class SyllabusUnitModel {
  const SyllabusUnitModel({
    required this.title,
    this.topics = const [],
    this.completed = false,
  });

  final String title;
  final List<String> topics;
  final bool completed;

  Map<String, dynamic> toJson() => {
    'title': title,
    'topics': topics,
    'completed': completed,
  };

  factory SyllabusUnitModel.fromJson(Map<String, dynamic> j) =>
      SyllabusUnitModel(
        title: j['title'] as String? ?? '',
        topics: (j['topics'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList(),
        completed: j['completed'] as bool? ?? false,
      );
}

class SyllabusModel {
  const SyllabusModel({
    required this.id,
    required this.subject,
    required this.academicYear,
    this.units = const [],
  });

  final String id;
  final String subject;
  final String academicYear;
  final List<SyllabusUnitModel> units;

  factory SyllabusModel.fromJson(Map<String, dynamic> j) => SyllabusModel(
    id: _id(j),
    subject: j['subject'] as String? ?? '',
    academicYear: j['academicYear'] as String? ?? '',
    units: (j['units'] as List<dynamic>? ?? [])
        .map((e) => SyllabusUnitModel.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class AssessmentModel {
  const AssessmentModel({
    required this.id,
    required this.title,
    this.subject,
    this.type,
    this.maxScore,
    this.date,
  });

  final String id;
  final String title;
  final String? subject;
  final String? type;
  final double? maxScore;
  final DateTime? date;

  factory AssessmentModel.fromJson(Map<String, dynamic> j) => AssessmentModel(
    id: _id(j),
    title: j['title'] as String? ?? '',
    subject: j['subject'] as String?,
    type: j['type'] as String?,
    maxScore: (j['maxScore'] as num?)?.toDouble(),
    date: _date(j['date']),
  );
}

// ── Daycare (digital diary) ──────────────────────────────────

/// One generic diary entry rendered as a timeline row.
class DiaryEntry {
  const DiaryEntry({
    required this.kind,
    required this.title,
    this.subtitle,
    this.when,
  });

  final String kind; // meal | nap | activity | health | observation
  final String title;
  final String? subtitle;
  final DateTime? when;
}

class DiaryModel {
  const DiaryModel({required this.date, required this.entries});

  final String date;
  final List<DiaryEntry> entries;

  factory DiaryModel.fromJson(Map<String, dynamic> j) {
    final entries = <DiaryEntry>[];

    for (final m in (j['meals'] as List<dynamic>? ?? [])) {
      final map = m as Map<String, dynamic>;
      entries.add(
        DiaryEntry(
          kind: 'meal',
          title:
              '${_pretty(map['mealType'] as String? ?? 'meal')} — ${map['menu'] ?? ''}',
          subtitle: map['amountEaten'] != null
              ? 'Ate: ${_pretty(map['amountEaten'] as String)}'
              : map['notes'] as String?,
          when: _date(map['createdAt']),
        ),
      );
    }
    for (final n in (j['naps'] as List<dynamic>? ?? [])) {
      final map = n as Map<String, dynamic>;
      entries.add(
        DiaryEntry(
          kind: 'nap',
          title: 'Nap — ${_pretty(map['quality'] as String? ?? 'sound')}',
          subtitle: map['notes'] as String?,
          when: _date(map['createdAt']),
        ),
      );
    }
    for (final a in (j['activities'] as List<dynamic>? ?? [])) {
      final map = a as Map<String, dynamic>;
      entries.add(
        DiaryEntry(
          kind: 'activity',
          title: map['title'] as String? ?? 'Activity',
          subtitle: map['description'] as String? ?? map['notes'] as String?,
          when: _date(map['createdAt']),
        ),
      );
    }
    for (final h in (j['health'] as List<dynamic>? ?? [])) {
      final map = h as Map<String, dynamic>;
      entries.add(
        DiaryEntry(
          kind: 'health',
          title: 'Health — ${_pretty(map['type'] as String? ?? 'general')}',
          subtitle: map['description'] as String?,
          when: _date(map['createdAt']),
        ),
      );
    }
    for (final o in (j['observations'] as List<dynamic>? ?? [])) {
      final map = o as Map<String, dynamic>;
      entries.add(
        DiaryEntry(
          kind: 'observation',
          title: 'Mood — ${_pretty(map['mood'] as String? ?? '')}',
          subtitle: map['observation'] as String?,
          when: _date(map['createdAt']),
        ),
      );
    }

    entries.sort((a, b) {
      final at = a.when?.millisecondsSinceEpoch ?? 0;
      final bt = b.when?.millisecondsSinceEpoch ?? 0;
      return at.compareTo(bt);
    });

    return DiaryModel(date: j['date'] as String? ?? '', entries: entries);
  }

  static String _pretty(String v) => v.isEmpty
      ? v
      : v
            .split('_')
            .map(
              (w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}',
            )
            .join(' ');
}

// ── Communication ────────────────────────────────────────────

class CircularModel {
  const CircularModel({
    required this.id,
    required this.title,
    required this.body,
    required this.audience,
    required this.pinned,
    this.publishedAt,
  });

  final String id;
  final String title;
  final String body;
  final String audience;
  final bool pinned;
  final DateTime? publishedAt;

  factory CircularModel.fromJson(Map<String, dynamic> j) => CircularModel(
    id: _id(j),
    title: j['title'] as String? ?? '',
    body: j['body'] as String? ?? '',
    audience: j['audience'] as String? ?? 'all',
    pinned: j['pinned'] as bool? ?? false,
    publishedAt: _date(j['publishedAt']),
  );
}

class PtmModel {
  const PtmModel({
    required this.id,
    required this.studentId,
    required this.reason,
    required this.status,
    this.studentName,
    this.preferredSlots = const [],
    this.scheduledAt,
    this.responseNote,
    this.requestedById,
    this.requestedByName,
    this.requestedByRole,
  });

  final String id;
  final String studentId;

  /// Populated on the admin's list — who the meeting is about.
  final String? studentName;
  final String reason;
  final String
  status; // requested | scheduled | declined | completed | cancelled
  final List<String> preferredSlots;
  final DateTime? scheduledAt;
  final String? responseNote;

  /// Populated on the admin's list — the teacher who raised the meeting.
  final String? requestedByName;
  final String? requestedByRole;

  /// Who created the request (parent OR teacher) — lets each side tell
  /// incoming requests (respond) from their own outgoing ones (wait).
  final String? requestedById;

  /// True when [me] did not create this request (it was sent to me).
  bool incomingFor(String? me) =>
      requestedById != null && me != null && requestedById != me;

  /// Whether this meeting can be marked done yet.
  ///
  /// Only a scheduled meeting that has actually taken place: the booked day
  /// must have arrived. Judged by day, not minute — a 3pm meeting can be closed
  /// off later that afternoon, but tomorrow's cannot be closed today. The
  /// backend applies the same rule, so this only keeps the button honest.
  bool get canBeCompleted {
    if (status != 'scheduled' || scheduledAt == null) return false;
    final day = DateTime(
      scheduledAt!.year,
      scheduledAt!.month,
      scheduledAt!.day,
    );
    return !DateTime.now().isBefore(day);
  }

  factory PtmModel.fromJson(Map<String, dynamic> j) {
    final student = j['student'];
    final requester = j['requestedBy'];

    // The admin list populates student + requester; the other lists don't, and
    // then these come back as bare ids.
    String? nameOfStudent(dynamic v) {
      if (v is! Map<String, dynamic>) return null;
      final n = [
        v['firstName'],
        v['lastName'],
      ].whereType<String>().join(' ').trim();
      return n.isEmpty ? null : n;
    }

    return PtmModel(
      id: _id(j),
      studentId: student is String
          ? student
          : _id(student as Map<String, dynamic>? ?? const {}),
      studentName: nameOfStudent(student),
      reason: j['reason'] as String? ?? '',
      status: j['status'] as String? ?? 'requested',
      preferredSlots: (j['preferredSlots'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
      scheduledAt: _date(j['scheduledAt']),
      responseNote: j['responseNote'] as String?,
      requestedById: requester is String
          ? requester
          : requester is Map<String, dynamic>
              ? _id(requester)
              : null,
      requestedByName: requester is Map<String, dynamic>
          ? requester['name'] as String?
          : null,
      requestedByRole: requester is Map<String, dynamic>
          ? requester['role'] as String?
          : null,
    );
  }
}

class AlertModel {
  const AlertModel({
    required this.id,
    required this.title,
    required this.body,
    this.createdAt,
  });

  final String id;
  final String title;
  final String body;
  final DateTime? createdAt;

  factory AlertModel.fromJson(Map<String, dynamic> j) => AlertModel(
    id: _id(j),
    title: j['title'] as String? ?? '',
    body: j['body'] as String? ?? j['message'] as String? ?? '',
    createdAt: _date(j['createdAt']),
  );
}

/// A direct message between two users (typically parent <-> teacher).
/// `senderId` / `recipientId` are the only routing fields — the backend's
/// unit of conversation is the other user's id.
class MessageModel {
  const MessageModel({
    required this.id,
    required this.senderId,
    required this.recipientId,
    required this.body,
    this.senderName,
    this.senderRole,
    this.recipientName,
    this.recipientRole,
    this.subject,
    this.relatedStudent,
    this.relatedStudentName,
    this.read = false,
    this.readAt,
    this.createdAt,
  });

  final String id;
  final String senderId;
  final String recipientId;
  final String? senderName;
  final String? senderRole;
  final String? recipientName;
  final String? recipientRole;
  final String? subject;
  final String body;

  /// The student the message is about, when populated.
  final String? relatedStudent;
  final String? relatedStudentName;
  final bool read;
  final DateTime? readAt;
  final DateTime? createdAt;

  factory MessageModel.fromJson(Map<String, dynamic> j) {
    String idOf(dynamic v) {
      if (v is String) return v;
      if (v is Map<String, dynamic>) return v['_id'] as String? ?? '';
      return '';
    }

    String? nameOf(dynamic v) {
      if (v is Map<String, dynamic>) return v['name'] as String?;
      return null;
    }

    String? roleOf(dynamic v) {
      if (v is Map<String, dynamic>) return v['role'] as String?;
      return null;
    }

    final related = j['relatedStudent'];
    String? relatedStudent;
    String? relatedStudentName;
    if (related is String) {
      relatedStudent = related;
    } else if (related is Map<String, dynamic>) {
      relatedStudent = related['_id'] as String?;
      relatedStudentName = [
        related['firstName'],
        related['lastName'],
      ].whereType<String>().join(' ').trim();
      if (relatedStudentName.isEmpty) relatedStudentName = null;
    }

    return MessageModel(
      id: _id(j),
      senderId: idOf(j['sender']),
      senderName: nameOf(j['sender']),
      senderRole: roleOf(j['sender']),
      recipientId: idOf(j['recipient']),
      recipientName: nameOf(j['recipient']),
      recipientRole: roleOf(j['recipient']),
      subject: j['subject'] as String?,
      body: j['body'] as String? ?? '',
      relatedStudent: relatedStudent,
      relatedStudentName: relatedStudentName,
      read: j['read'] as bool? ?? false,
      readAt: _date(j['readAt']),
      createdAt: _date(j['createdAt']),
    );
  }
}

/// Someone the signed-in user may open a chat with
/// (GET /communication/messages/contacts).
class ChatContactModel {
  const ChatContactModel({
    required this.userId,
    required this.name,
    required this.role,
    this.email,
  });

  final String userId;
  final String name;
  final String role; // admin | principal | teacher | parent
  final String? email;

  /// "Teacher" / "Parent" / "School office" — what to show under the name.
  String get roleLabel => switch (role) {
    'admin' || 'principal' => 'School office',
    'teacher' => 'Teacher',
    'parent' => 'Parent',
    _ => role,
  };

  factory ChatContactModel.fromJson(Map<String, dynamic> j) => ChatContactModel(
    userId: j['userId'] as String? ?? '',
    name: j['name'] as String? ?? 'Unknown',
    role: j['role'] as String? ?? '',
    email: j['email'] as String?,
  );
}

/// One conversation collapsed to its latest message
/// (GET /communication/messages/threads).
class ChatThreadModel {
  const ChatThreadModel({
    required this.userId,
    required this.name,
    required this.role,
    required this.lastMessage,
    required this.unread,
    this.lastAt,
  });

  final String userId;
  final String name;
  final String role;
  final String lastMessage;
  final int unread;
  final DateTime? lastAt;

  String get roleLabel => ChatContactModel(
    userId: userId,
    name: name,
    role: role,
  ).roleLabel;

  factory ChatThreadModel.fromJson(Map<String, dynamic> j) => ChatThreadModel(
    userId: j['userId'] as String? ?? '',
    name: j['name'] as String? ?? 'Unknown',
    role: j['role'] as String? ?? '',
    lastMessage: j['lastMessage'] as String? ?? '',
    unread: (j['unread'] as num?)?.toInt() ?? 0,
    lastAt: _date(j['lastAt']),
  );
}

// ── Leave ────────────────────────────────────────────────────

class LeaveModel {
  const LeaveModel({
    required this.id,
    required this.type,
    required this.status,
    this.fromDate,
    this.toDate,
    this.reason,
    this.applicantRole,
    this.applicantName,
    this.applicantEmail,
    this.studentId,
    this.studentName,
    this.reviewNote,
  });

  final String id;
  final String type; // sick | casual | vacation | other
  final String status; // pending | approved | rejected | cancelled
  final DateTime? fromDate;
  final DateTime? toDate;
  final String? reason;
  final String? applicantRole;

  /// Applicant identity, populated from the backend `applicantId` reference.
  final String? applicantName;
  final String? applicantEmail;
  final String? studentId;

  /// Student the leave is for (parent-applied leaves), when populated.
  final String? studentName;
  final String? reviewNote;

  factory LeaveModel.fromJson(Map<String, dynamic> j) {
    // `applicantId` is populated to {_id, name, email, role} by the backend.
    final applicant = j['applicantId'];
    final applicantMap = applicant is Map<String, dynamic>
        ? applicant
        : const <String, dynamic>{};
    // `studentId` may be a bare id or populated to {_id, firstName, lastName}.
    final student = j['studentId'];
    String? studentId;
    String? studentName;
    if (student is Map<String, dynamic>) {
      studentId = student['_id'] as String?;
      final name = [
        student['firstName'],
        student['lastName'],
      ].whereType<String>().join(' ').trim();
      studentName = name.isEmpty ? null : name;
    } else if (student is String) {
      studentId = student;
    }
    return LeaveModel(
      id: _id(j),
      type: j['type'] as String? ?? 'other',
      status: j['status'] as String? ?? 'pending',
      fromDate: _date(j['fromDate']),
      toDate: _date(j['toDate']),
      reason: j['reason'] as String?,
      applicantRole:
          j['applicantRole'] as String? ?? applicantMap['role'] as String?,
      applicantName: applicantMap['name'] as String?,
      applicantEmail: applicantMap['email'] as String?,
      studentId: studentId,
      studentName: studentName,
      reviewNote: j['reviewNote'] as String?,
    );
  }
}

class StudentAttendanceDay {
  const StudentAttendanceDay({required this.date, required this.status});
  final String date; // YYYY-MM-DD
  final String status;

  factory StudentAttendanceDay.fromJson(Map<String, dynamic> j) =>
      StudentAttendanceDay(
        date: j['date'] as String? ?? '',
        status: j['status'] as String? ?? 'absent',
      );
}

/// A student's attendance over a date range — weekly / monthly report.
class StudentAttendanceReport {
  const StudentAttendanceReport({
    required this.from,
    required this.to,
    required this.present,
    required this.absent,
    required this.late,
    required this.onLeave,
    required this.halfDay,
    required this.marked,
    required this.workingDays,
    required this.presentRate,
    required this.days,
  });

  final String from;
  final String to;
  final int present;
  final int absent;
  final int late;
  final int onLeave;
  final int halfDay;
  final int marked;
  final int workingDays;
  final int presentRate;
  final List<StudentAttendanceDay> days;

  factory StudentAttendanceReport.fromJson(Map<String, dynamic> j) {
    int asInt(dynamic v) => (v as num?)?.toInt() ?? 0;
    return StudentAttendanceReport(
      from: j['from'] as String? ?? '',
      to: j['to'] as String? ?? '',
      present: asInt(j['present']),
      absent: asInt(j['absent']),
      late: asInt(j['late']),
      onLeave: asInt(j['onLeave']),
      halfDay: asInt(j['halfDay']),
      marked: asInt(j['marked']),
      workingDays: asInt(j['workingDays']),
      presentRate: asInt(j['presentRate']),
      days: (j['days'] as List<dynamic>? ?? [])
          .map((e) => StudentAttendanceDay.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

// ── Admissions ───────────────────────────────────────────────

class InquiryModel {
  const InquiryModel({
    required this.id,
    required this.childName,
    required this.parentName,
    required this.parentPhone,
    required this.status,
    this.gradeInterested,
    this.notes,
    this.createdAt,
  });

  final String id;
  final String childName;
  final String parentName;
  final String parentPhone;
  final String status; // new | contacted | visited | converted | closed
  final String? gradeInterested;
  final String? notes;
  final DateTime? createdAt;

  factory InquiryModel.fromJson(Map<String, dynamic> j) => InquiryModel(
    id: _id(j),
    childName: j['childName'] as String? ?? '',
    parentName: j['parentName'] as String? ?? '',
    parentPhone: j['parentPhone'] as String? ?? '',
    status: j['status'] as String? ?? 'new',
    gradeInterested: j['gradeInterested'] as String?,
    notes: j['notes'] as String?,
    createdAt: _date(j['createdAt']),
  );
}

// ── Fees reports ─────────────────────────────────────────────

class FeeCollectionSummary {
  const FeeCollectionSummary({
    required this.totalCollected,
    required this.paymentCount,
  });

  final double totalCollected;
  final int paymentCount;

  factory FeeCollectionSummary.fromJson(Map<String, dynamic> j) =>
      FeeCollectionSummary(
        totalCollected: (j['totalCollected'] as num? ?? 0).toDouble(),
        paymentCount: j['paymentCount'] as int? ?? 0,
      );
}

class FeeOutstandingSummary {
  const FeeOutstandingSummary({
    required this.outstandingInvoices,
    required this.totalOutstanding,
  });

  final int outstandingInvoices;
  final double totalOutstanding;

  factory FeeOutstandingSummary.fromJson(Map<String, dynamic> j) =>
      FeeOutstandingSummary(
        outstandingInvoices: j['outstandingInvoices'] as int? ?? 0,
        totalOutstanding: (j['totalOutstanding'] as num? ?? 0).toDouble(),
      );
}

// ── Gallery ───────────────────────────────────────────────────

class GalleryItem {
  const GalleryItem({
    required this.id,
    this.title,
    this.notes,
    this.metadata = const {},
    this.createdAt,
  });

  final String id;
  final String? title;
  final String? notes;
  final Map<String, dynamic> metadata;
  final DateTime? createdAt;

  String? get url => metadata['url'] as String?;
  String? get thumbnailUrl => metadata['thumbnailUrl'] as String?;
  String? get mediaType => metadata['type'] as String? ?? 'image';

  /// Resolves a stored URL to a full network URL. Handles both legacy
  /// absolute URLs (`http://...`) and relative paths (`/uploads/...`).
  static String? _resolve(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    if (!raw.startsWith('http')) return '${ApiConfig.serverRoot}$raw';
    // Legacy records stored absolute localhost URLs, unreachable from a
    // device/emulator — rewrite the host to the configured server.
    return raw.replaceFirst(
      RegExp(r'https?://(localhost|127\.0\.0\.1)(:\d+)?'),
      ApiConfig.serverRoot,
    );
  }

  String? get resolvedUrl => _resolve(url);
  String? get resolvedThumbnailUrl => _resolve(thumbnailUrl);

  factory GalleryItem.fromJson(Map<String, dynamic> j) => GalleryItem(
    id: _id(j),
    title: j['title'] as String?,
    notes: j['notes'] as String?,
    metadata: j['metadata'] is Map<String, dynamic>
        ? j['metadata'] as Map<String, dynamic>
        : const {},
    createdAt: _date(j['createdAt']),
  );
}

// ── Transport ─────────────────────────────────────────────────

class TransportInfo {
  const TransportInfo({
    required this.id,
    this.title,
    this.notes,
    this.vehicleNumber,
    this.driverName,
    this.driverPhone,
    this.routeName,
    this.metadata = const {},
    this.assignedStudents = const [],
    this.assignedStaff = const [],
  });

  final String id;
  final String? title;
  final String? notes;
  final String? vehicleNumber;
  final String? driverName;
  final String? driverPhone;
  final String? routeName;
  final Map<String, dynamic> metadata;

  /// Student / staff (teacher) ids riding this vehicle.
  final List<String> assignedStudents;
  final List<String> assignedStaff;

  /// Reads a value from its dedicated field, falling back to
  /// [metadata] for backward compatibility with older records.
  static String? _read(dynamic j, String key) {
    final direct = j[key] as String?;
    if (direct != null && direct.isNotEmpty) return direct;
    final meta = j['metadata'];
    if (meta is Map<String, dynamic>) {
      final fallback = meta[key] as String?;
      if (fallback != null && fallback.isNotEmpty) return fallback;
    }
    return direct; // null or empty
  }

  /// Ids may arrive raw or as populated documents.
  static List<String> _memberIds(dynamic v) => (v as List<dynamic>? ?? [])
      .map((e) => e is Map<String, dynamic> ? _id(e) : '$e')
      .toList();

  factory TransportInfo.fromJson(Map<String, dynamic> j) => TransportInfo(
    id: _id(j),
    title: j['title'] as String?,
    notes: j['notes'] as String?,
    vehicleNumber: _read(j, 'vehicleNumber'),
    driverName: _read(j, 'driverName'),
    driverPhone: _read(j, 'driverPhone'),
    routeName: _read(j, 'routeName'),
    metadata: j['metadata'] is Map<String, dynamic>
        ? j['metadata'] as Map<String, dynamic>
        : const {},
    assignedStudents: _memberIds(j['assignedStudents']),
    assignedStaff: _memberIds(j['assignedStaff']),
  );
}

// ── Events ───────────────────────────────────────────────────

class EventModel {
  const EventModel({
    required this.id,
    required this.title,
    this.description,
    this.startDate,
    this.endDate,
    this.venue,
    this.audience = 'all',
  });

  final String id;
  final String title;
  final String? description;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? venue;
  final String audience;

  factory EventModel.fromJson(Map<String, dynamic> j) => EventModel(
    id: _id(j),
    title: j['title'] as String? ?? '',
    description: j['description'] as String?,
    startDate: _date(j['startDate']),
    endDate: _date(j['endDate']),
    venue: j['venue'] as String?,
    audience: j['audience'] as String? ?? 'all',
  );
}

class HolidayModel {
  const HolidayModel({
    required this.id,
    required this.title,
    required this.date,
    this.description,
  });

  final String id;
  final String title;
  final DateTime date;
  final String? description;

  factory HolidayModel.fromJson(Map<String, dynamic> j) => HolidayModel(
    id: _id(j),
    title: j['title'] as String? ?? '',
    date: _date(j['date']) ?? DateTime.now(),
    description: j['description'] as String?,
  );
}
