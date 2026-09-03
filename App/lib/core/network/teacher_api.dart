import 'package:dio/dio.dart';

import '../models/app_user.dart';
import '../models/student.dart';
import 'admin_api.dart' show SchoolClass, AttendanceClassSummary;
import 'api_models.dart';
import 'auth_api.dart';
import 'dio_client.dart';

export 'api_models.dart';

/// HTTP client for the Teacher role. The bearer token is attached automatically
/// by DioClient; the JWT schoolId scopes every call server-side.
class TeacherApi {
  TeacherApi._();
  static final TeacherApi instance = TeacherApi._();

  // ── Classes ───────────────────────────────────────────────

  Future<List<SchoolClass>> listClasses() async {
    // GET /classes returns a bare array inside the response envelope.
    final res = await DioClient.instance.dio.get<dynamic>('/classes');
    final raw = DioClient.unwrap<dynamic>(res);
    final list =
        raw is List ? raw : (raw is Map ? (raw['data'] as List? ?? []) : const []);
    return list
        .map((e) => SchoolClass.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Classes where the signed-in teacher is the class teacher.
  Future<List<SchoolClass>> listMyClasses() async {
    final classes = await listClasses();
    final me = AuthApi.instance.currentSession?.userId;
    if (me == null) return const [];
    return classes.where((c) => c.classTeacherId == me).toList();
  }

  Future<List<Student>> getClassStudents(String classId) async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/classes/$classId/students');
    final raw = DioClient.unwrap<dynamic>(res);
    final list = raw is List ? raw : (raw['data'] as List? ?? []);
    return list
        .map((e) => Student.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Attendance ────────────────────────────────────────────

  Future<StudentAttendanceReport> getStudentAttendanceReport({
    required String studentId,
    required String from,
    required String to,
  }) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/attendance/student/$studentId/report',
      queryParameters: {'from': from, 'to': to},
    );
    return StudentAttendanceReport.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<AttendanceClassSummary> getClassSummary(
      String classId, String date) async {
    try {
      final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
          '/attendance/class/$classId/summary',
          queryParameters: {'date': date});
      return AttendanceClassSummary.fromJson(
          DioClient.unwrap<Map<String, dynamic>>(res));
    } catch (_) {
      return const AttendanceClassSummary(present: 0, absent: 0, total: 0);
    }
  }

  Future<List<ClassAttendanceRecord>> getClassSheet(
      String classId, String date) async {
    try {
      final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
          '/attendance/class/$classId',
          queryParameters: {'date': date});
      final raw = DioClient.unwrap<dynamic>(res);
      final list = raw is List ? raw : (raw['records'] as List? ?? []);
      return list
          .map((e) =>
              ClassAttendanceRecord.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> markAttendance({
    required String classId,
    required String date,
    required List<AttendanceMark> records,
  }) async {
    await DioClient.instance.dio.post<void>(
      '/attendance/mark',
      data: {
        'classId': classId,
        'date': date,
        'entries': records
            .map((r) => {'studentId': r.studentId, 'status': r.status})
            .toList(),
      },
    );
  }

  // ── Academic: homework ────────────────────────────────────

  Future<List<HomeworkModel>> getHomework(String classId) async {
    final res = await DioClient.instance.dio.get<dynamic>(
      '/academic/homework',
      queryParameters: {'classId': classId},
    );
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => HomeworkModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<HomeworkModel> createHomework({
    required String classId,
    required String title,
    required String subject,
    String? description,
    required String dueDate,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/academic/homework',
      data: {
        'classId': classId,
        'title': title,
        'subject': subject,
        'description': ?description,
        'dueDate': dueDate,
      },
    );
    return HomeworkModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> deleteHomework(String id) async {
    await DioClient.instance.dio.delete<void>('/academic/homework/$id');
  }

  // ── Academic: lesson plans, remarks, milestones ──────────

  Future<List<LessonPlanModel>> getLessonPlans(String classId) async {
    final res = await DioClient.instance.dio.get<dynamic>(
      '/academic/lesson-plans',
      queryParameters: {'classId': classId},
    );
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => LessonPlanModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<LessonPlanModel> createLessonPlan({
    required String classId,
    required String subject,
    required String title,
    required String date,
    List<String> objectives = const [],
    List<String> activities = const [],
    String? resources,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/academic/lesson-plans',
      data: {
        'classId': classId,
        'subject': subject,
        'title': title,
        'date': date,
        'objectives': objectives,
        'activities': activities,
        'resources': ?resources,
      },
    );
    return LessonPlanModel.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<List<AssessmentModel>> getAssessments(String classId) async {
    final res = await DioClient.instance.dio.get<dynamic>(
      '/academic/assessments',
      queryParameters: {'classId': classId},
    );
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => AssessmentModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AssessmentModel> createAssessment({
    required String classId,
    required String title,
    required String subject,
    required String date,
    String? type,
    int? maxScore,
    String? description,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/academic/assessments',
      data: {
        'classId': classId,
        'title': title,
        'subject': subject,
        'date': date,
        'type': ?type,
        'maxScore': ?maxScore,
        'description': ?description,
      },
    );
    return AssessmentModel.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> deleteAssessment(String id) async {
    await DioClient.instance.dio.delete<void>('/academic/assessments/$id');
  }

  /// Entered results for one assessment — GET /academic/assessments/:id/results.
  Future<List<ResultModel>> getAssessmentResults(String assessmentId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/academic/assessments/$assessmentId/results');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => ResultModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<SyllabusModel>> getSyllabus(String classId) async {
    final res = await DioClient.instance.dio.get<dynamic>(
      '/academic/syllabus',
      queryParameters: {'classId': classId},
    );
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => SyllabusModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> upsertSyllabus({
    required String classId,
    required String subject,
    required String academicYear,
    required List<SyllabusUnitModel> units,
  }) async {
    await DioClient.instance.dio.post<void>(
      '/academic/syllabus',
      data: {
        'classId': classId,
        'subject': subject,
        'academicYear': academicYear,
        'units': units.map((u) => u.toJson()).toList(),
      },
    );
  }

  Future<void> addRemark({
    required String studentId,
    required String remark,
    String category = 'general',
  }) async {
    await DioClient.instance.dio.post<void>(
      '/academic/remarks',
      data: {
        'studentId': studentId,
        'remark': remark,
        'category': category,
      },
    );
  }

  Future<void> addMilestone({
    required String studentId,
    required String title,
    String category = 'cognitive',
    String status = 'achieved',
  }) async {
    await DioClient.instance.dio.post<void>(
      '/academic/milestones',
      data: {
        'studentId': studentId,
        'title': title,
        'category': category,
        'status': status,
      },
    );
  }

  // ── Daycare (daily preschool updates) ─────────────────────

  Future<void> postMeal({
    required String studentId,
    required String mealType,
    required String menu,
    String? amountEaten,
    String? notes,
  }) async {
    await DioClient.instance.dio.post<void>('/daycare/meals', data: {
      'studentId': studentId,
      'mealType': mealType,
      'menu': menu,
      'amountEaten': ?amountEaten,
      'notes': ?notes,
    });
  }

  Future<void> postNap({
    required String studentId,
    String? quality,
    String? notes,
  }) async {
    await DioClient.instance.dio.post<void>('/daycare/naps', data: {
      'studentId': studentId,
      'quality': ?quality,
      'notes': ?notes,
    });
  }

  Future<void> postActivity({
    required String studentId,
    required String title,
    String? category,
    String? description,
  }) async {
    await DioClient.instance.dio.post<void>('/daycare/activities', data: {
      'studentId': studentId,
      'title': title,
      'category': ?category,
      'description': ?description,
    });
  }

  Future<void> postObservation({
    required String studentId,
    required String mood,
    required String observation,
  }) async {
    await DioClient.instance.dio.post<void>('/daycare/observations', data: {
      'studentId': studentId,
      'mood': mood,
      'observation': observation,
    });
  }

  Future<void> postHealth({
    required String studentId,
    required String type,
    required String description,
  }) async {
    await DioClient.instance.dio.post<void>('/daycare/health', data: {
      'studentId': studentId,
      'type': type,
      'description': description,
    });
  }

  // ── Communication ─────────────────────────────────────────

  Future<List<CircularModel>> getCirculars() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/circulars');
    final raw = DioClient.unwrap<dynamic>(res);
    final list = raw is List ? raw : (raw['data'] as List<dynamic>? ?? []);
    return list
        .map((e) => CircularModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> createCircular({
    required String title,
    required String body,
    String audience = 'all',
  }) async {
    await DioClient.instance.dio.post<void>(
      '/communication/circulars',
      data: {'title': title, 'body': body, 'audience': audience},
    );
  }

  Future<List<PtmModel>> assignedPtm() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/ptm/assigned');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => PtmModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Teacher-initiated PTM request. [parentId] (the student's linked parent
  /// account) makes the request show up in that parent's PTM list.
  Future<PtmModel> requestPtm({
    required String studentId,
    required String reason,
    List<String> preferredSlots = const [],
    String? parentId,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/communication/ptm',
      data: {
        'studentId': studentId,
        'reason': reason,
        'preferredSlots': preferredSlots,
        'parentId': ?parentId,
      },
    );
    return PtmModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Requests a PTM for whole classes at once — one request per student in
  /// each class. Only classes this teacher teaches are accepted.
  ///
  /// No date: the school office schedules or declines these, and the parents
  /// are notified only once it does. Returns how many requests were raised and
  /// how many students were skipped for having no linked parent account.
  Future<({int created, int skipped})> requestPtmForClasses({
    required List<String> classIds,
    required String reason,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/communication/ptm/classes',
      data: {'classIds': classIds, 'reason': reason},
    );
    final d = DioClient.unwrap<Map<String, dynamic>>(res);
    return (
      created: (d['created'] as num?)?.toInt() ?? 0,
      skipped: (d['skipped'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> respondPtm(
    String id, {
    required String status,
    String? scheduledAt,
    String? responseNote,
  }) async {
    await DioClient.instance.dio.patch<void>(
      '/communication/ptm/$id/respond',
      data: {
        'status': status,
        'scheduledAt': ?scheduledAt,
        'responseNote': ?responseNote,
      },
    );
  }

  // ── Communication: direct messages ────────────────────────

  /// Sends a direct message. The conversation is keyed by `recipientId`;
  /// `relatedStudent` is metadata for the recipient.
  Future<MessageModel> sendMessage({
    required String recipientId,
    required String body,
    String? subject,
    String? relatedStudent,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/communication/messages',
      data: {
        'recipientId': recipientId,
        'body': body,
        if (subject != null && subject.isNotEmpty) 'subject': subject,
        'relatedStudent': ?relatedStudent,
      },
    );
    return MessageModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// All messages addressed TO this teacher, newest first.
  Future<List<MessageModel>> inboxMessages() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/inbox');
    return _parseMessageList(DioClient.unwrap<dynamic>(res));
  }

  /// All messages FROM this teacher, newest first.
  Future<List<MessageModel>> sentMessages() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/sent');
    return _parseMessageList(DioClient.unwrap<dynamic>(res));
  }

  /// All messages between the signed-in teacher and [otherUserId], oldest
  /// first — suitable for rendering a chat thread.
  Future<List<MessageModel>> conversation(String otherUserId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/conversation/$otherUserId');
    return _parseMessageList(DioClient.unwrap<dynamic>(res));
  }

  /// Every conversation this teacher is part of (sent *and* received),
  /// newest first — unlike [inboxMessages], a thread the teacher opened and
  /// got no reply to still shows up.
  Future<List<ChatThreadModel>> chatThreads() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/threads');
    return _parseList(
      DioClient.unwrap<dynamic>(res),
      ChatThreadModel.fromJson,
    );
  }

  /// The school office (admins/principals) — who a teacher escalates a query
  /// to. Parents are picked from the teacher's class rosters instead.
  Future<List<ChatContactModel>> chatContacts() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/contacts');
    return _parseList(
      DioClient.unwrap<dynamic>(res),
      ChatContactModel.fromJson,
    );
  }

  /// Marks a single received message as read.
  Future<void> markMessageRead(String id) async {
    await DioClient.instance.dio
        .patch('/communication/messages/$id/read');
  }

  /// Number of unread messages for the inbox badge.
  Future<int> unreadMessageCount() async {
    try {
      final res = await DioClient.instance.dio
          .get<Map<String, dynamic>>('/communication/messages/unread-count');
      final data = DioClient.unwrap<Map<String, dynamic>>(res);
      return (data['unread'] as num?)?.toInt() ?? 0;
    } catch (_) {
      return 0;
    }
  }

  /// Looks up a single user — used to resolve a parent name from
  /// `student.parentUserId` when composing a new message.
  Future<AppUser?> getUser(String userId) async {
    if (userId.isEmpty) return null;
    try {
      final res = await DioClient.instance.dio
          .get<Map<String, dynamic>>('/users/$userId');
      return AppUser.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
    } catch (_) {
      return null;
    }
  }

  List<MessageModel> _parseMessageList(dynamic raw) =>
      _parseList(raw, MessageModel.fromJson);

  /// Unwraps either a bare list or a `{ data: [...] }` envelope, then maps
  /// each entry through [fromJson].
  List<T> _parseList<T>(
    dynamic raw,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    final List<dynamic> list =
        raw is List ? raw : (raw['data'] ?? const <dynamic>[]);
    return list.map((e) => fromJson(e as Map<String, dynamic>)).toList();
  }

  // ── Leave ─────────────────────────────────────────────────

  Future<LeaveModel> applyLeave({
    required String type,
    required String fromDate,
    required String toDate,
    String? reason,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/leave',
      data: {
        'type': type,
        'fromDate': fromDate,
        'toDate': toDate,
        'reason': ?reason,
      },
    );
    return LeaveModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<List<LeaveModel>> myLeaves() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/leave', queryParameters: {'limit': 50});
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => LeaveModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Student leave requests for the classes this teacher is in charge of.
  Future<List<LeaveModel>> classLeaves({String? status}) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/leave/class',
      queryParameters: {'status': ?status},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => LeaveModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Approve or reject a student leave (only for the teacher's own class).
  Future<void> decideLeave(String id, String status, {String? note}) async {
    await DioClient.instance.dio.patch<dynamic>(
      '/leave/$id',
      data: {'status': status, 'reviewNote': ?note},
    );
  }

  // ── Gallery ────────────────────────────────────────────────

  /// Uploads a photo/video to the gallery. [filePath] is the local file
  /// path from image_picker; [title] and [notes] are optional metadata.
  Future<GalleryItem> uploadGallery({
    required String filePath,
    String? title,
    String? notes,
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
      if (title != null && title.isNotEmpty) 'title': title,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/gallery/upload',
      data: formData,
    );
    return GalleryItem.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Lists gallery/media items for the teacher's school.
  Future<List<GalleryItem>> listGallery({int page = 1, int limit = 20}) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/gallery',
      queryParameters: {'page': page, 'limit': limit},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => GalleryItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Events ────────────────────────────────────────────────

  Future<List<EventModel>> getEvents({bool upcoming = true}) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/events',
      queryParameters: {'upcoming': upcoming, 'limit': 50},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => EventModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Transport ──────────────────────────────────────────────

  /// Returns transport/vehicle info for the teacher's school.
  Future<TransportInfo?> getMyTransport() async {
    try {
      final res = await DioClient.instance.dio
          .get<Map<String, dynamic>>('/transport/mine');
      final data = DioClient.unwrap<Map<String, dynamic>>(res);
      final list = data['data'] as List<dynamic>? ?? [];
      if (list.isEmpty) return null;
      return TransportInfo.fromJson(list.first as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  // ── Profile ────────────────────────────────────────────────

  /// Updates the teacher's own name / phone / password. Calls PATCH /users/me.
  Future<void> updateMyProfile({
    String? name,
    String? phone,
    String? password,
  }) async {
    await DioClient.instance.dio.patch<dynamic>(
      '/users/me',
      data: <String, dynamic>{
        if (name != null) 'name': name,
        if (phone != null) 'phone': phone,
        if (password != null) 'password': password,
      },
    );
  }

  /// Notification opt-ins — shared endpoint with the parent app (P7 / X7).
  Future<Map<String, bool>> getNotificationPrefs() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/users/me/notification-prefs');
    return DioClient.unwrap<Map<String, dynamic>>(res)
        .map((k, v) => MapEntry(k, v == true));
  }

  Future<void> updateNotificationPrefs(Map<String, bool> prefs) async {
    await DioClient.instance.dio.patch<Map<String, dynamic>>(
      '/users/me/notification-prefs',
      data: prefs,
    );
  }

  // ── Session helper ────────────────────────────────────────

  AuthSession? get session => AuthApi.instance.currentSession;
}

class ClassAttendanceRecord {
  const ClassAttendanceRecord({
    required this.studentId,
    required this.studentName,
    required this.status,
  });

  final String studentId;
  final String studentName;
  final String status;

  /// Backend rows are `{student: {_id, fullName, admissionNumber}, status}`
  /// where status is null for students not yet marked that day.
  factory ClassAttendanceRecord.fromJson(Map<String, dynamic> j) {
    final student = j['student'];
    final s = student is Map<String, dynamic> ? student : null;
    return ClassAttendanceRecord(
      studentId: s?['_id'] as String? ?? j['studentId'] as String? ?? '',
      studentName:
          s?['fullName'] as String? ?? j['studentName'] as String? ?? '',
      status: j['status'] as String? ?? '',
    );
  }
}

class AttendanceMark {
  const AttendanceMark({required this.studentId, required this.status});
  final String studentId;
  final String status;
}
