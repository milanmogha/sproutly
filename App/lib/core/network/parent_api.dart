import 'package:flutter/foundation.dart';

import '../models/student.dart';
import 'admin_api.dart' show SchoolClass;
import 'api_models.dart';
import 'auth_api.dart';
import 'dio_client.dart';

export 'api_models.dart';

/// HTTP client for the Parent role. JWT carries the parent's userId;
/// every call is scoped to the parent's school on the backend.
class ParentApi {
  ParentApi._();
  static final ParentApi instance = ParentApi._();

  // ── Children ──────────────────────────────────────────────

  /// The child currently selected on the home screen; other parent tabs
  /// (fees, academics, diary) follow this selection.
  final ValueNotifier<Student?> selectedChild = ValueNotifier(null);

  List<Student> _childrenCache = [];

  /// Which parent account `_childrenCache` belongs to. The API singletons
  /// outlive login sessions, so without this a second parent logging in on
  /// the same device would see the previous account's children.
  String? _cacheUserId;

  Future<List<Student>> getMyChildren() async {
    final uid = AuthApi.instance.currentSession?.userId;
    if (uid == null) return [];
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/students',
      queryParameters: {'parentUserId': uid, 'limit': 20},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    _cacheUserId = uid;
    _childrenCache = (data['data'] as List<dynamic>? ?? [])
        .map((e) => Student.fromJson(e as Map<String, dynamic>))
        .toList();
    // Keep the selection valid: it may still point at a child of the
    // previously signed-in account, or at a child that no longer exists.
    final sel = selectedChild.value;
    if (sel == null || !_childrenCache.any((c) => c.id == sel.id)) {
      selectedChild.value =
          _childrenCache.isNotEmpty ? _childrenCache.first : null;
    }
    return _childrenCache;
  }

  /// Forgets the signed-out account's children so the next login — possibly
  /// a different parent on the same device — starts from a clean slate.
  void reset() {
    _childrenCache = [];
    _cacheUserId = null;
    selectedChild.value = null;
  }

  /// Children from the last fetch (fetches if never loaded or if the cache
  /// belongs to a different account than the current session).
  Future<List<Student>> childrenCached() async {
    final uid = AuthApi.instance.currentSession?.userId;
    if (_childrenCache.isNotEmpty && uid == _cacheUserId) {
      return _childrenCache;
    }
    return getMyChildren();
  }

  /// Parent fills in the rest of their child's profile. Succeeds once — the
  /// record then locks server-side. Returns the updated student and refreshes
  /// the local cache / current selection.
  Future<Student> completeProfile(
    String studentId, {
    StudentAddress? address,
    required List<StudentGuardian> guardians,
    required List<EmergencyContact> emergencyContacts,
    required StudentMedicalInfo medicalInfo,
  }) async {
    final res = await DioClient.instance.dio.patch<Map<String, dynamic>>(
      '/students/$studentId/profile',
      data: {
        if (address != null) 'address': address.toJson(),
        'guardians': guardians.map((g) => g.toJson()).toList(),
        'emergencyContacts':
            emergencyContacts.map((c) => c.toJson()).toList(),
        'medicalInfo': medicalInfo.toJson(),
      },
    );
    final updated =
        Student.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
    _replaceChild(updated);
    return updated;
  }

  /// Parent asks the school admin to change an already-completed (locked)
  /// profile. The admins receive an in-app notification with the reason.
  Future<void> requestProfileChange(String studentId, String message) async {
    await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/students/$studentId/change-request',
      data: {'message': message},
    );
  }

  /// Swaps an updated student into the cache and the current selection.
  void _replaceChild(Student updated) {
    _childrenCache = [
      for (final c in _childrenCache) if (c.id == updated.id) updated else c,
    ];
    if (!_childrenCache.any((c) => c.id == updated.id)) {
      _childrenCache = [..._childrenCache, updated];
    }
    if (selectedChild.value?.id == updated.id) {
      selectedChild.value = updated;
    }
  }

  // ── Attendance ────────────────────────────────────────────

  Future<MonthlyAttendance> getMonthlyAttendance(
      String studentId, int year, int month) async {
    try {
      final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
          '/attendance/student/$studentId/monthly',
          queryParameters: {'year': year, 'month': month});
      return MonthlyAttendance.fromJson(
          DioClient.unwrap<Map<String, dynamic>>(res));
    } catch (_) {
      return const MonthlyAttendance(records: [], presentDays: 0, absentDays: 0, totalDays: 0);
    }
  }

  Future<List<AttendanceDay>> getAttendanceRange(
      String studentId, String from, String to) async {
    try {
      final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
          '/attendance/student/$studentId',
          queryParameters: {'from': from, 'to': to});
      final raw = DioClient.unwrap<dynamic>(res);
      final list = raw is List ? raw : (raw['records'] as List? ?? []);
      return list
          .map((e) => AttendanceDay.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  // ── Fees ──────────────────────────────────────────────────

  Future<List<InvoiceModel>> getStudentInvoices(String studentId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/fees/students/$studentId/invoices');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => InvoiceModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<InvoiceModel>> getStudentDues(String studentId) async {
    final res = await DioClient.instance.dio.get<dynamic>(
      '/fees/dues',
      queryParameters: {'studentId': studentId},
    );
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => InvoiceModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Online payment (Razorpay) ─────────────────────────────
  //
  // Each school collects into its OWN Razorpay account, so the key id comes
  // back with the order rather than being baked into the app.

  /// Opens a Razorpay order for an invoice's outstanding balance.
  Future<CheckoutOrder> startCheckout(String invoiceId) async {
    final res = await DioClient.instance.dio
        .post<Map<String, dynamic>>('/fees/invoices/$invoiceId/checkout');
    return CheckoutOrder.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Hands the checkout result back for signature verification. The school's
  /// webhook confirms the payment too — this just settles it straight away so
  /// the parent sees "Paid" without waiting.
  Future<void> verifyPayment({
    required String orderId,
    required String paymentId,
    required String signature,
  }) async {
    await DioClient.instance.dio.post<dynamic>(
      '/fees/payments/verify',
      data: {
        'razorpayOrderId': orderId,
        'razorpayPaymentId': paymentId,
        'razorpaySignature': signature,
      },
    );
  }

  // ── Academic ──────────────────────────────────────────────

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

  Future<List<ResultModel>> getStudentProgress(String studentId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/academic/students/$studentId/progress');
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
    final list = raw is List ? raw : (raw['data'] as List<dynamic>? ?? []);
    return list
        .map((e) => SyllabusModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

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

  Future<List<RemarkModel>> getStudentRemarks(String studentId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/academic/students/$studentId/remarks');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => RemarkModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<MilestoneModel>> getStudentMilestones(String studentId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/academic/students/$studentId/milestones');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => MilestoneModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Daycare diary ─────────────────────────────────────────

  Future<DiaryModel> getDiary(String studentId, {String? date}) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/daycare/diary/$studentId',
      queryParameters: {'date': ?date},
    );
    return DiaryModel.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
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

  Future<List<AlertModel>> getAlerts() async {
    final res =
        await DioClient.instance.dio.get<dynamic>('/communication/alerts');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => AlertModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // A parent neither requests a PTM nor accepts one — hence no requestPtm and
  // no respondPtm here. The teacher raises the meeting, the admin schedules or
  // declines it, and the parent is notified of the outcome; [myPtmRequests] is
  // the read-only view of that. The backend enforces this too (both routes
  // exclude PARENT), so it isn't merely a UI rule.

  /// The meetings involving this parent's children, newest first. Read-only.
  Future<List<PtmModel>> myPtmRequests() async {
    final res =
        await DioClient.instance.dio.get<dynamic>('/communication/ptm/mine');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => PtmModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Communication: direct messages ────────────────────────

  /// Sends a direct message. The backend stores `relatedStudent` so the
  /// recipient (usually the class teacher) can see which child the message
  /// is about, but the conversation itself is keyed by `recipientId`.
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

  /// All messages addressed TO this parent, newest first.
  Future<List<MessageModel>> inboxMessages() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/inbox');
    return _parseMessageList(DioClient.unwrap<dynamic>(res));
  }

  /// All messages FROM this parent, newest first.
  Future<List<MessageModel>> sentMessages() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/sent');
    return _parseMessageList(DioClient.unwrap<dynamic>(res));
  }

  /// All messages between the signed-in parent and [otherUserId], oldest
  /// first — suitable for rendering a chat thread.
  Future<List<MessageModel>> conversation(String otherUserId) async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/conversation/$otherUserId');
    return _parseMessageList(DioClient.unwrap<dynamic>(res));
  }

  /// Every conversation this parent is part of (sent *and* received), newest
  /// first — a thread the parent opened and got no reply to still shows up,
  /// which grouping the inbox alone would hide.
  Future<List<ChatThreadModel>> chatThreads() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/threads');
    return _parseList(
      DioClient.unwrap<dynamic>(res),
      ChatThreadModel.fromJson,
    );
  }

  /// The school office (admins/principals) — who a parent takes a query to
  /// when it isn't for the class teacher.
  Future<List<ChatContactModel>> chatContacts() async {
    final res = await DioClient.instance.dio
        .get<dynamic>('/communication/messages/contacts');
    return _parseList(
      DioClient.unwrap<dynamic>(res),
      ChatContactModel.fromJson,
    );
  }

  /// Marks a single received message as read. The backend only allows the
  /// recipient to do this; calls on sent messages will 404.
  Future<void> markMessageRead(String id) async {
    await DioClient.instance.dio
        .patch('/communication/messages/$id/read');
  }

  /// Number of unread messages for the bell / inbox badge.
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

  /// School holidays the admin has marked, sorted by date. Shown on the
  /// attendance calendar so a blank day reads as "school was closed" rather
  /// than "attendance wasn't taken". Best-effort: an empty list on failure
  /// leaves the calendar working.
  Future<List<HolidayModel>> listHolidays() async {
    try {
      final res = await DioClient.instance.dio.get<dynamic>('/holidays');
      return _parseList(
        DioClient.unwrap<dynamic>(res),
        HolidayModel.fromJson,
      );
    } catch (_) {
      return const [];
    }
  }

  /// Looks up a single class — used to resolve the class teacher for the
  /// selected child's class so the parent has someone to chat with.
  Future<SchoolClass?> getClass(String classId) async {
    if (classId.isEmpty) return null;
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/classes/$classId');
    return SchoolClass.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
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
    String? studentId,
    required String type,
    required String fromDate,
    required String toDate,
    String? reason,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/leave',
      data: {
        'studentId': ?studentId,
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

  Future<void> cancelLeave(String id) async {
    await DioClient.instance.dio.patch<dynamic>('/leave/$id/cancel');
  }

  // ── Gallery ────────────────────────────────────────────────

  /// Lists gallery/media items for the parent's school.
  Future<List<GalleryItem>> listGallery({int page = 1, int limit = 20}) async {
    final res = await DioClient.instance.dio.get<Map<String, dynamic>>(
      '/gallery',
      queryParameters: {'page': page, 'limit': limit},
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    final list = (data['data'] as List<dynamic>? ?? [])
        .map((e) => GalleryItem.fromJson(e as Map<String, dynamic>))
        .toList();
    return list;
  }

  // ── Transport ──────────────────────────────────────────────

  /// Returns transport/vehicle info for the parent's school.
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

  Future<void> registerForEvent(String eventId, {String? studentId}) async {
    await DioClient.instance.dio.post<dynamic>(
      '/events/$eventId/register',
      data: {'studentId': ?studentId},
    );
  }

  // ── School ────────────────────────────────────────────────

  /// The parent's own school contact card (name, phone, email, address).
  Future<SchoolContact?> getSchoolContact() async {
    try {
      final res =
          await DioClient.instance.dio.get<Map<String, dynamic>>('/schools/mine');
      return SchoolContact.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
    } catch (_) {
      return null;
    }
  }

  // ── Profile ────────────────────────────────────────────────

  /// Updates the parent's own name / phone. Calls PATCH /users/me.
  Future<void> updateMyProfile({String? name, String? phone}) async {
    await DioClient.instance.dio.patch<dynamic>(
      '/users/me',
      data: <String, dynamic>{
        if (name != null) 'name': name,
        if (phone != null) 'phone': phone,
      },
    );
  }

  /// Reminder opt-ins (fee / attendance / homework / event) — P7.
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

  // ── Session ───────────────────────────────────────────────

  AuthSession? get session => AuthApi.instance.currentSession;
}

class SchoolContact {
  const SchoolContact({
    required this.name,
    this.code,
    this.email,
    this.phone,
    this.address,
    this.onlinePaymentsEnabled = false,
  });

  final String name;
  final String? code;
  final String? email;
  final String? phone;
  final String? address;

  /// Whether this school has its Razorpay account switched on. False means
  /// fees are paid at the office, so "Pay now" shouldn't be offered at all.
  final bool onlinePaymentsEnabled;

  factory SchoolContact.fromJson(Map<String, dynamic> j) {
    final a = j['address'] as Map<String, dynamic>?;
    final addr = a == null
        ? null
        : [a['line1'], a['line2'], a['city'], a['state'], a['postalCode']]
            .where((p) => p != null && (p as String).isNotEmpty)
            .join(', ');
    return SchoolContact(
      name: j['name'] as String? ?? 'School',
      code: j['code'] as String?,
      email: j['contactEmail'] as String?,
      phone: j['contactPhone'] as String?,
      address: (addr == null || addr.isEmpty) ? null : addr,
      onlinePaymentsEnabled: j['onlinePaymentsEnabled'] as bool? ?? false,
    );
  }
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
    required this.subject,
    required this.academicYear,
    this.units = const [],
  });

  final String subject;
  final String academicYear;
  final List<SyllabusUnitModel> units;

  factory SyllabusModel.fromJson(Map<String, dynamic> j) => SyllabusModel(
        subject: j['subject'] as String? ?? 'Subject',
        academicYear: j['academicYear'] as String? ?? '',
        units: (j['units'] as List<dynamic>? ?? [])
            .map((e) => SyllabusUnitModel.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class AttendanceDay {
  const AttendanceDay({required this.date, required this.status});
  final String date;
  final String status;

  bool get isPresent => status == 'present';
  bool get isAbsent => status == 'absent';
  bool get isLate => status == 'late';

  factory AttendanceDay.fromJson(Map<String, dynamic> j) => AttendanceDay(
        date: j['date'] as String? ?? '',
        status: j['status'] as String? ?? 'absent',
      );
}

class MonthlyAttendance {
  const MonthlyAttendance({
    required this.records,
    required this.presentDays,
    required this.absentDays,
    required this.totalDays,
  });

  final List<AttendanceDay> records;
  final int presentDays;
  final int absentDays;
  final int totalDays;

  double get percentage =>
      totalDays == 0 ? 0 : presentDays / totalDays;

  /// Backend shape: `{year, month, summary: {present, absent, late, …},
  /// presentRate, days: [{date: 'YYYY-MM-DD', status}]}`.
  factory MonthlyAttendance.fromJson(Map<String, dynamic> j) {
    final list = (j['days'] as List<dynamic>? ?? j['records'] as List<dynamic>? ?? [])
        .map((e) => AttendanceDay.fromJson(e as Map<String, dynamic>))
        .toList();
    final summary = j['summary'] as Map<String, dynamic>? ?? const {};
    return MonthlyAttendance(
      records: list,
      presentDays: summary['present'] as int? ??
          list.where((d) => d.isPresent).length,
      absentDays: summary['absent'] as int? ??
          list.where((d) => d.isAbsent).length,
      totalDays: list.length,
    );
  }
}

/// A Razorpay order opened for one invoice, plus the school's public key id.
class CheckoutOrder {
  const CheckoutOrder({
    required this.orderId,
    required this.amount,
    required this.amountPaise,
    required this.currency,
    required this.keyId,
    required this.invoiceNumber,
  });

  final String orderId;

  /// Rupees, for display.
  final double amount;

  /// Paise — what Razorpay checkout actually charges.
  final int amountPaise;
  final String currency;

  /// The school's own key id; differs from school to school.
  final String keyId;
  final String invoiceNumber;

  factory CheckoutOrder.fromJson(Map<String, dynamic> j) => CheckoutOrder(
        orderId: j['orderId'] as String? ?? '',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        amountPaise: (j['amountPaise'] as num?)?.toInt() ?? 0,
        currency: j['currency'] as String? ?? 'INR',
        keyId: j['keyId'] as String? ?? '',
        invoiceNumber: j['invoiceNumber'] as String? ?? '',
      );
}
