import 'package:dio/dio.dart';

import '../models/app_user.dart';
import '../models/student.dart';
import 'api_models.dart';
import 'dio_client.dart';

export 'api_models.dart';

/// All HTTP calls needed by the Admin role screens. The bearer token is
/// attached automatically by DioClient; every endpoint is already scoped to
/// the admin's school on the backend via the JWT schoolId.
class AdminApi {
  AdminApi._();
  static final AdminApi instance = AdminApi._();

  // ── Dashboard ─────────────────────────────────────────────

  /// Everything the admin home shows, in one school-scoped call. The backend
  /// `/dashboard` endpoint stitches together students, staff, pending leaves
  /// and today's attendance so the home screen has a single source of truth.
  Future<AdminDashboardStats> getDashboardStats() async {
    final res =
        await DioClient.instance.dio.get<Map<String, dynamic>>('/dashboard');
    return AdminDashboardStats.fromJson(
      DioClient.unwrap<Map<String, dynamic>>(res),
    );
  }

  // ── Students ──────────────────────────────────────────────

  Future<PaginatedStudents> listStudents({
    int page = 1,
    int limit = 30,
    String? search,
    String? status,
  }) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/students',
      queryParameters: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        'status': ?status,
      },
    );
    return PaginatedStudents.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<Student> createStudent({
    required String firstName,
    required String lastName,
    required DateTime dateOfBirth,
    required String gender,
    String? parentPhone,
    String? parentName,
    // TEMPORARY: the parent's email is their login identity while WhatsApp OTP
    // is disabled — the backend requires it to provision the parent login.
    String? parentEmail,
    String? classId,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/students',
      data: {
        'firstName': firstName,
        'lastName': lastName,
        'dateOfBirth': dateOfBirth.toIso8601String().split('T').first,
        'gender': gender,
        if (parentPhone != null && parentPhone.isNotEmpty)
          'parentPhone': parentPhone,
        if (parentName != null && parentName.isNotEmpty)
          'parentName': parentName,
        if (parentEmail != null && parentEmail.isNotEmpty)
          'parentEmail': parentEmail,
        'classId': ?classId,
      },
    );
    return Student.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Fetch a single student by id (school-scoped server-side). Used by the
  /// profile screen and the change-request notification deep-link.
  Future<Student> getStudent(String id) async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/students/$id');
    return Student.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Admin edits a student record. [body] is a partial student payload
  /// (firstName, lastName, dateOfBirth, gender, status, guardians,
  /// emergencyContacts, medicalInfo, address, …) sent to PATCH /students/:id.
  Future<Student> updateStudent(String id, Map<String, dynamic> body) async {
    final res = await DioClient.instance.dio.patch<Map<String, dynamic>>(
      '/students/$id',
      data: body,
    );
    return Student.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Permanently removes a student from the school (DELETE /students/:id).
  Future<void> deleteStudent(String id) async {
    await DioClient.instance.dio.delete<void>('/students/$id');
  }

  // ── Staff (users in this school) ──────────────────────────

  Future<List<AppUser>> listStaff() async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/users',
      queryParameters: {'limit': 100},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => AppUser.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Transport ─────────────────────────────────────────────

  Future<List<TransportInfo>> listTransport() async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/transport',
      queryParameters: {'limit': 100},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => TransportInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<TransportInfo> createTransport({
    required String title,
    String? notes,
    String? vehicleNumber,
    String? driverName,
    String? driverPhone,
    String? routeName,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/transport',
      data: {
        'title': title,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (vehicleNumber != null && vehicleNumber.isNotEmpty)
          'vehicleNumber': vehicleNumber,
        if (driverName != null && driverName.isNotEmpty)
          'driverName': driverName,
        if (driverPhone != null && driverPhone.isNotEmpty)
          'driverPhone': driverPhone,
        if (routeName != null && routeName.isNotEmpty)
          'routeName': routeName,
      },
    );
    return TransportInfo.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Edits a vehicle/route. Sends all fields (empty string clears one).
  Future<TransportInfo> updateTransport(
    String id, {
    required String title,
    String? notes,
    String? vehicleNumber,
    String? driverName,
    String? driverPhone,
    String? routeName,
  }) async {
    final res = await DioClient.instance.dio.patch<Map<String, dynamic>>(
      '/transport/$id',
      data: {
        'title': title,
        'notes': notes ?? '',
        'vehicleNumber': vehicleNumber ?? '',
        'driverName': driverName ?? '',
        'driverPhone': driverPhone ?? '',
        'routeName': routeName ?? '',
      },
    );
    return TransportInfo.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> deleteTransport(String id) async {
    await DioClient.instance.dio.delete<void>('/transport/$id');
  }

  /// [kind] is `student` or `staff`; returns the updated vehicle.
  Future<TransportInfo> assignTransport(
      String id, String kind, String memberId) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/transport/$id/assign-$kind',
      data: {kind == 'staff' ? 'staffId' : 'studentId': memberId},
    );
    return TransportInfo.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<TransportInfo> unassignTransport(
      String id, String kind, String memberId) async {
    final res = await DioClient.instance.dio.delete<Map<String, dynamic>>(
      '/transport/$id/unassign-$kind/$memberId',
    );
    return TransportInfo.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  // ── Classes ───────────────────────────────────────────────

  Future<List<SchoolClass>> listClasses() async {
    // GET /classes returns a bare array (ClassWithCount[]) inside the envelope.
    final res = await DioClient.instance.dio.get<dynamic>('/classes');
    final raw = DioClient.unwrap<dynamic>(res);
    final list = raw is List ? raw : (raw is Map ? (raw['data'] as List? ?? []) : const []);
    return list
        .map((e) => SchoolClass.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<SchoolClass> createClass({
    required String name,
    String? section,
    required String academicYear,
    int? capacity,
    String? room,
    String? classTeacher,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/classes',
      data: {
        'name': name,
        'section': ?section,
        'academicYear': academicYear,
        'capacity': ?capacity,
        'room': ?room,
        'classTeacher': ?classTeacher,
      },
    );
    return SchoolClass.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Assign the class teacher, or clear it when [teacherId] is null.
  Future<void> assignClassTeacher(String classId, String? teacherId) async {
    await DioClient.instance.dio.patch<dynamic>(
      '/classes/$classId',
      data: {'classTeacher': teacherId},
    );
  }

  Future<List<Student>> listClassStudents(String classId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/classes/$classId/students');
    final raw = DioClient.unwrap<dynamic>(res);
    final list = raw is List ? raw : (raw is Map ? (raw['data'] as List? ?? []) : const []);
    return list
        .map((e) => Student.fromJson(e as Map<String, dynamic>))
        .toList();
  }

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

  Future<void> allocateStudent(String classId, String studentId) async {
    await DioClient.instance.dio.post<dynamic>(
      '/classes/$classId/allocate',
      data: {'studentId': studentId},
    );
  }

  Future<void> deallocateStudent(String classId, String studentId) async {
    await DioClient.instance.dio
        .delete<dynamic>('/classes/$classId/students/$studentId');
  }

  // ── Attendance ────────────────────────────────────────────

  Future<AttendanceClassSummary> getClassAttendanceSummary(
      String classId, String date) async {
    try {
      final res = await DioClient.instance.dio
          .get<Map<String, dynamic>>('/attendance/class/$classId/summary',
              queryParameters: {'date': date});
      return AttendanceClassSummary.fromJson(
          DioClient.unwrap<Map<String, dynamic>>(res));
    } catch (_) {
      return AttendanceClassSummary(present: 0, absent: 0, total: 0);
    }
  }

  Future<List<StaffAttendanceRecord>> getStaffAttendance(String date) async {
    try {
      final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
          '/attendance/staff',
          queryParameters: {'date': date});
      final data = DioClient.unwrap<dynamic>(res);
      final list = data is List ? data : (data['data'] as List? ?? []);
      return list
          .map((e) =>
              StaffAttendanceRecord.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Admin marks the staff roster present/absent for [date]. Each entry is
  /// `{staffId, status}` where status is 'present' or 'absent'.
  Future<void> markStaffAttendance({
    required String date,
    required List<Map<String, String>> entries,
  }) async {
    await DioClient.instance.dio.post<dynamic>(
      '/attendance/staff/mark',
      data: {'date': date, 'entries': entries},
    );
  }

  /// A single teacher's attendance summary + day list over [from]–[to]
  /// (inclusive, YYYY-MM-DD). Powers the weekly/monthly reports.
  Future<StaffAttendanceReport> getStaffAttendanceReport({
    required String staffId,
    required String from,
    required String to,
  }) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/attendance/staff/$staffId/report',
      queryParameters: {'from': from, 'to': to},
    );
    return StaffAttendanceReport.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> addTeacher({
    required String name,
    required String email,
  }) async {
    await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/users',
      data: {
        'name': name,
        'email': email,
        'role': 'teacher',
      },
    );
  }

  /// Edits a staff account's basic details (PATCH /users/:id). Only the
  /// provided fields are sent, so a null leaves that field untouched.
  Future<AppUser> updateStaff(
    String id, {
    String? name,
    String? email,
    String? phone,
  }) async {
    final res = await DioClient.instance.dio.patch<Map<String, dynamic>>(
      '/users/$id',
      data: {
        'name': ?name,
        'email': ?email,
        'phone': ?phone,
      },
    );
    return AppUser.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Permanently removes a staff account (DELETE /users/:id).
  Future<void> deleteStaff(String id) async {
    await DioClient.instance.dio.delete<void>('/users/$id');
  }

  // ── Fees ──────────────────────────────────────────────────

  Future<List<InvoiceModel>> getDues() async {
    final res = await DioClient.instance.dio.get<dynamic>('/fees/dues');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => InvoiceModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<InvoiceModel>> listInvoices({String? status}) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/fees/invoices',
      queryParameters: {'limit': 50, 'status': ?status},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => InvoiceModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> recordPayment({
    required String invoiceId,
    required double amount,
    String method = 'cash',
    String? reference,
    String? note,
  }) async {
    await DioClient.instance.dio.post<dynamic>(
      '/fees/payments',
      data: {
        'invoiceId': invoiceId,
        'amount': amount,
        'method': method,
        'reference': ?reference,
        'note': ?note,
      },
    );
  }

  // ── Fee structures (templates) ────────────────────────────

  Future<List<FeeStructureModel>> listStructures() async {
    final res =
        await DioClient.instance.dio.get<dynamic>('/fees/structures');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => FeeStructureModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<FeeStructureModel> saveStructure({
    String? id,
    required String name,
    required String academicYear,
    required List<({String name, double amount})> components,
    String? frequency,
    int? dueDayOfMonth,
    String? classId,
  }) async {
    final data = <String, dynamic>{
      'name': name,
      'academicYear': academicYear,
      'components': [
        for (final c in components) {'name': c.name, 'amount': c.amount},
      ],
      if (frequency != null) 'frequency': frequency,
      if (dueDayOfMonth != null) 'dueDayOfMonth': dueDayOfMonth,
      if (classId != null && classId.isNotEmpty) 'classId': classId,
    };
    final res = id == null
        ? await DioClient.instance.dio
            .post<Map<String, dynamic>>('/fees/structures', data: data)
        : await DioClient.instance.dio
            .patch<Map<String, dynamic>>('/fees/structures/$id', data: data);
    return FeeStructureModel.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> deleteStructure(String id) async {
    await DioClient.instance.dio.delete<void>('/fees/structures/$id');
  }

  /// Generates the whole session's invoices for every student in a class.
  /// The backend expands the structure's frequency into installments
  /// (monthly → 12, quarterly → 4, term → 2, annual → 1) with due dates from
  /// its due-day, skipping any (student, period) that already has an invoice.
  Future<({int created, int skipped, int installments})> generateInvoices({
    required String feeStructureId,
    required String classId,
    String? academicYear,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/fees/invoices/generate',
      data: {
        'feeStructureId': feeStructureId,
        'classId': classId,
        if (academicYear != null && academicYear.isNotEmpty)
          'academicYear': academicYear,
      },
    );
    final d = DioClient.unwrap<Map<String, dynamic>>(res);
    return (
      created: (d['created'] as num?)?.toInt() ?? 0,
      skipped: (d['skipped'] as num?)?.toInt() ?? 0,
      installments: (d['installments'] as num?)?.toInt() ?? 0,
    );
  }

  Future<FeeCollectionSummary> collectionSummary() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/fees/reports/collection');
    return FeeCollectionSummary.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<FeeOutstandingSummary> outstandingSummary() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/fees/reports/outstanding');
    return FeeOutstandingSummary.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  // ── Admissions ────────────────────────────────────────────

  Future<List<InquiryModel>> listInquiries({String? status}) async {
    final res = await DioClient.instance.dio.get<dynamic>(
      '/admissions/inquiries',
      queryParameters: {'limit': 50, 'status': ?status},
    );
    final raw = DioClient.unwrap<dynamic>(res);
    final list = raw is List ? raw : (raw['data'] as List<dynamic>? ?? []);
    return list
        .map((e) => InquiryModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<InquiryModel> createInquiry({
    required String childName,
    required String parentName,
    required String parentPhone,
    String? gradeInterested,
    String? notes,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/admissions/inquiries',
      data: {
        'childName': childName,
        'parentName': parentName,
        'parentPhone': parentPhone,
        'gradeInterested': ?gradeInterested,
        'notes': ?notes,
      },
    );
    return InquiryModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> updateInquiryStatus(String id, String status) async {
    await DioClient.instance.dio.patch<dynamic>(
      '/admissions/inquiries/$id',
      data: {'status': status},
    );
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

  Future<void> createAlert({
    required String title,
    required String body,
  }) async {
    await DioClient.instance.dio.post<void>(
      '/communication/alerts',
      // The alert DTO calls its text field `message`.
      data: {'title': title, 'message': body},
    );
  }

  // ── PTM (the admin decides) ───────────────────────────────
  //
  // A teacher raises a meeting request; the admin schedules or declines it and
  // the parent is notified. Parents neither raise nor accept meetings.

  /// Calls a PTM for whole classes at once — one meeting per student in each
  /// class, created already scheduled, with every parent notified.
  ///
  /// Returns how many were created and how many students were skipped for
  /// having no linked parent account.
  Future<({int created, int skipped})> createClassPtm({
    required List<String> classIds,
    required String reason,
    required DateTime scheduledAt,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/communication/ptm/classes',
      data: {
        'classIds': classIds,
        'reason': reason,
        'scheduledAt': scheduledAt.toIso8601String(),
      },
    );
    final d = DioClient.unwrap<Map<String, dynamic>>(res);
    return (
      created: (d['created'] as num?)?.toInt() ?? 0,
      skipped: (d['skipped'] as num?)?.toInt() ?? 0,
    );
  }

  /// Every PTM request in the school, newest first.
  Future<List<PtmModel>> listPtmRequests() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/ptm');
    return _parseList(DioClient.unwrap<dynamic>(res), PtmModel.fromJson);
  }

  /// Schedule ('scheduled'), decline, or complete a request. [scheduledAt] is
  /// sent as an ISO-8601 date when confirming a meeting.
  Future<void> respondPtm(
    String id, {
    required String status,
    DateTime? scheduledAt,
    String? responseNote,
  }) async {
    await DioClient.instance.dio.patch<void>(
      '/communication/ptm/$id/respond',
      data: {
        'status': status,
        if (scheduledAt != null)
          'scheduledAt': scheduledAt.toIso8601String(),
        'responseNote': ?responseNote,
      },
    );
  }

  // ── Communication: direct messages (query resolution) ──────
  //
  // The admin is a normal chat participant: every thread is a private 1:1
  // between the admin and one teacher or one parent. Teacher↔parent threads
  // are separate conversations the admin is not part of and cannot see.

  /// Every teacher and parent in the school — who the admin can open a chat
  /// with. Backed by the role-aware `/messages/contacts` endpoint.
  Future<List<ChatContactModel>> chatContacts() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/contacts');
    return _parseList(
      DioClient.unwrap<dynamic>(res),
      ChatContactModel.fromJson,
    );
  }

  /// The admin's conversations (sent *and* received), newest first. Admins
  /// often message first, so grouping the inbox alone would hide those
  /// threads until someone replied.
  Future<List<ChatThreadModel>> chatThreads() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/threads');
    return _parseList(
      DioClient.unwrap<dynamic>(res),
      ChatThreadModel.fromJson,
    );
  }

  /// Full history between the admin and [otherUserId], oldest first.
  Future<List<MessageModel>> conversation(String otherUserId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/conversation/$otherUserId');
    return _parseList(DioClient.unwrap<dynamic>(res), MessageModel.fromJson);
  }

  /// REST fallback for sending — the chat screen normally sends over the
  /// socket, which persists through this same endpoint's service.
  Future<MessageModel> sendMessage({
    required String recipientId,
    required String body,
    String? subject,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/communication/messages',
      data: {
        'recipientId': recipientId,
        'body': body,
        if (subject != null && subject.isNotEmpty) 'subject': subject,
      },
    );
    return MessageModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> markMessageRead(String id) async {
    await DioClient.instance.dio.patch('/communication/messages/$id/read');
  }

  /// Unread total across all of the admin's threads — the Communication badge.
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

  // ── Events ────────────────────────────────────────────────

  Future<List<EventModel>> getEvents({bool upcoming = false}) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/events',
      queryParameters: {'upcoming': upcoming, 'limit': 50},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => EventModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<EventModel> createEvent({
    required String title,
    required String startDate,
    String? description,
    String? venue,
    String audience = 'all',
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/events',
      data: {
        'title': title,
        'startDate': startDate,
        'description': ?description,
        'venue': ?venue,
        'audience': audience,
      },
    );
    return EventModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  // ── Holidays ──────────────────────────────────────────────

  /// School holidays, sorted by date. [upcoming] limits to today onward.
  Future<List<HolidayModel>> listHolidays({bool upcoming = false}) async {
    final res = await DioClient.instance.dio.get<dynamic>(
      '/holidays',
      queryParameters: {if (upcoming) 'upcoming': true},
    );
    final data = DioClient.unwrap<dynamic>(res);
    return (data as List<dynamic>? ?? [])
        .map((e) => HolidayModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<HolidayModel> createHoliday({
    required String title,
    required String date,
    String? description,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/holidays',
      data: {
        'title': title,
        'date': date,
        if (description != null && description.isNotEmpty)
          'description': description,
      },
    );
    return HolidayModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> deleteHoliday(String id) async {
    await DioClient.instance.dio.delete<void>('/holidays/$id');
  }

  // ── School profile (A3) ───────────────────────────────────

  /// The admin's own school (name, contact, address, academic year).
  Future<AdminSchoolProfile> getMySchool() async {
    final res =
        await DioClient.instance.dio.get<Map<String, dynamic>>('/schools/mine');
    return AdminSchoolProfile.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Edits the admin's own school (PATCH /schools/mine). Only non-null fields
  /// are sent; the address is sent as a whole so pass the current values for
  /// parts you aren't changing. contactEmail is omitted when blank (the API
  /// validates it as an email, so it can't be cleared to "").
  Future<void> updateMySchool({
    String? name,
    String? contactEmail,
    String? contactPhone,
    String? line1,
    String? city,
    String? state,
    String? postalCode,
    String? currentAcademicYear,
  }) async {
    final address = <String, dynamic>{
      'line1': line1 ?? '',
      'city': city ?? '',
      'state': state ?? '',
      'postalCode': postalCode ?? '',
    };
    await DioClient.instance.dio.patch<Map<String, dynamic>>(
      '/schools/mine',
      data: {
        if (name != null && name.isNotEmpty) 'name': name,
        if (contactEmail != null && contactEmail.isNotEmpty)
          'contactEmail': contactEmail,
        if (contactPhone != null) 'contactPhone': contactPhone,
        if (currentAcademicYear != null)
          'currentAcademicYear': currentAcademicYear,
        'address': address,
      },
    );
  }

  Future<void> deleteEvent(String id) async {
    await DioClient.instance.dio.delete<void>('/events/$id');
  }

  // ── Leave management ──────────────────────────────────────

  Future<List<LeaveModel>> listLeaves({String? status}) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/leave',
      queryParameters: {'limit': 50, 'status': ?status},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    return (data['data'] as List<dynamic>? ?? [])
        .map((e) => LeaveModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> decideLeave(String id, String status, {String? note}) async {
    await DioClient.instance.dio.patch<dynamic>(
      '/leave/$id',
      data: {'status': status, 'reviewNote': ?note},
    );
  }

  // ── Profile ────────────────────────────────────────────────

  /// Updates the admin's own name / phone / password. Calls PATCH /users/me.
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

  /// Notification opt-ins — shared endpoint across roles (P7 / X7).
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

  // ── Gallery ────────────────────────────────────────────────

  /// Uploads a photo/video to the gallery.
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

  /// Lists gallery/media items for the admin's school.
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

  /// Removes a gallery item. The backend also deletes the stored file, so this
  /// is not recoverable — always confirm with the admin first.
  Future<void> deleteGallery(String id) async {
    await DioClient.instance.dio.delete<dynamic>('/gallery/$id');
  }
}

class SchoolClass {
  const SchoolClass({
    required this.id,
    required this.name,
    required this.section,
    this.capacity = 30,
    this.academicYear,
    this.room,
    this.enrolled = 0,
    this.classTeacherId,
    this.classTeacherName,
  });

  final String id;
  final String name;
  final String section;
  final int capacity;
  final String? academicYear;
  final String? room;
  final int enrolled;
  final String? classTeacherId;
  final String? classTeacherName;

  String get displayName => '$name - $section';
  bool get hasTeacher => classTeacherId != null && classTeacherId!.isNotEmpty;

  SchoolClass copyWith({
    String? classTeacherId,
    String? classTeacherName,
    bool clearTeacher = false,
    int? enrolled,
  }) =>
      SchoolClass(
        id: id,
        name: name,
        section: section,
        capacity: capacity,
        academicYear: academicYear,
        room: room,
        enrolled: enrolled ?? this.enrolled,
        classTeacherId: clearTeacher ? null : (classTeacherId ?? this.classTeacherId),
        classTeacherName:
            clearTeacher ? null : (classTeacherName ?? this.classTeacherName),
      );

  factory SchoolClass.fromJson(Map<String, dynamic> j) {
    // classTeacher is populated to {_id, name}, or a bare id, or null.
    final t = j['classTeacher'];
    final tm = t is Map<String, dynamic> ? t : null;
    return SchoolClass(
      id: j['_id'] as String? ?? j['id'] as String? ?? '',
      name: j['name'] as String? ?? '',
      section: j['section'] as String? ?? 'A',
      capacity: (j['capacity'] as num?)?.toInt() ?? 30,
      academicYear: j['academicYear'] as String?,
      room: j['room'] as String?,
      enrolled: (j['enrolled'] as num?)?.toInt() ?? 0,
      classTeacherId:
          tm != null ? tm['_id'] as String? : (t is String ? t : null),
      classTeacherName: tm != null ? tm['name'] as String? : null,
    );
  }
}

class AttendanceClassSummary {
  const AttendanceClassSummary({
    required this.present,
    required this.absent,
    required this.total,
  });

  final int present;
  final int absent;
  final int total;

  factory AttendanceClassSummary.fromJson(Map<String, dynamic> j) =>
      AttendanceClassSummary(
        present: j['present'] as int? ?? 0,
        absent: j['absent'] as int? ?? 0,
        total: j['total'] as int? ?? 0,
      );
}

class StaffAttendanceRecord {
  const StaffAttendanceRecord({
    required this.staffId,
    required this.name,
    required this.status,
    this.checkInAt,
  });

  final String staffId;
  final String name;
  final String status;
  final String? checkInAt;

  factory StaffAttendanceRecord.fromJson(Map<String, dynamic> j) =>
      StaffAttendanceRecord(
        staffId: j['staffId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        status: j['status'] as String? ?? 'absent',
        checkInAt: j['checkInAt'] as String?,
      );
}

class StaffAttendanceDay {
  const StaffAttendanceDay({required this.date, required this.status});

  final String date; // YYYY-MM-DD
  final String status;

  factory StaffAttendanceDay.fromJson(Map<String, dynamic> j) =>
      StaffAttendanceDay(
        date: j['date'] as String? ?? '',
        status: j['status'] as String? ?? 'absent',
      );
}

class StaffAttendanceReport {
  const StaffAttendanceReport({
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
  final List<StaffAttendanceDay> days;

  factory StaffAttendanceReport.fromJson(Map<String, dynamic> j) {
    int asInt(dynamic v) => (v as num?)?.toInt() ?? 0;
    return StaffAttendanceReport(
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
          .map((e) => StaffAttendanceDay.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class AdminDashboardStats {
  const AdminDashboardStats({
    required this.schoolName,
    required this.studentCount,
    required this.activeStudents,
    required this.staffCount,
    required this.byStatus,
    required this.pendingLeaves,
    required this.attendanceTotal,
    required this.attendanceMarked,
    required this.attendanceNotMarked,
    required this.presentToday,
    required this.absentToday,
  });

  final String? schoolName;
  final int studentCount;
  final int activeStudents;
  final int staffCount;
  final Map<String, int> byStatus;
  final int pendingLeaves;

  // Today's school-wide student attendance.
  final int attendanceTotal;
  final int attendanceMarked;
  final int attendanceNotMarked;
  final int presentToday;
  final int absentToday;

  /// True once every active student has an attendance record for today.
  bool get attendanceComplete =>
      attendanceTotal > 0 && attendanceNotMarked == 0;

  factory AdminDashboardStats.fromJson(Map<String, dynamic> j) {
    final school = j['school'] as Map<String, dynamic>?;
    final students = j['students'] as Map<String, dynamic>? ?? const {};
    final staff = j['staff'] as Map<String, dynamic>? ?? const {};
    final leaves = j['leaves'] as Map<String, dynamic>? ?? const {};
    final attendance = j['attendance'] as Map<String, dynamic>? ?? const {};

    int asInt(dynamic v) => (v as num?)?.toInt() ?? 0;

    final byStatusRaw =
        students['byStatus'] as Map<String, dynamic>? ?? const {};
    final byStatus = <String, int>{
      for (final e in byStatusRaw.entries) e.key: asInt(e.value),
    };

    return AdminDashboardStats(
      schoolName: school?['name'] as String?,
      studentCount: asInt(students['total']),
      activeStudents: asInt(students['active']),
      staffCount: asInt(staff['total']),
      byStatus: byStatus,
      pendingLeaves: asInt(leaves['pending']),
      attendanceTotal: asInt(attendance['total']),
      attendanceMarked: asInt(attendance['marked']),
      attendanceNotMarked: asInt(attendance['notMarked']),
      presentToday: asInt(attendance['present']),
      absentToday: asInt(attendance['absent']),
    );
  }
}

/// The admin's own school profile (GET /schools/mine).
class AdminSchoolProfile {
  const AdminSchoolProfile({
    required this.name,
    this.code,
    this.contactEmail,
    this.contactPhone,
    this.line1,
    this.city,
    this.state,
    this.postalCode,
    this.currentAcademicYear,
  });

  final String name;
  final String? code;
  final String? contactEmail;
  final String? contactPhone;
  final String? line1;
  final String? city;
  final String? state;
  final String? postalCode;
  final String? currentAcademicYear;

  factory AdminSchoolProfile.fromJson(Map<String, dynamic> j) {
    final a = j['address'] as Map<String, dynamic>?;
    return AdminSchoolProfile(
      name: j['name'] as String? ?? '',
      code: j['code'] as String?,
      contactEmail: j['contactEmail'] as String?,
      contactPhone: j['contactPhone'] as String?,
      line1: a?['line1'] as String?,
      city: a?['city'] as String?,
      state: a?['state'] as String?,
      postalCode: a?['postalCode'] as String?,
      currentAcademicYear: j['currentAcademicYear'] as String?,
    );
  }
}
