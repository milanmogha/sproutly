/// A school on the platform, as returned by the backend (`GET /schools`).
class School {
  const School({
    required this.id,
    required this.name,
    required this.code,
    required this.status,
    required this.modules,
    required this.isActive,
    this.city,
    this.contactEmail,
    this.contactPhone,
    this.address,
    this.createdAt,
    this.adminInviteUrl,
  });

  factory School.fromJson(Map<String, dynamic> json) {
    final addr = json['address'] as Map<String, dynamic>?;
    final addressText = [
      addr?['line1'],
      addr?['line2'],
      addr?['city'],
      addr?['state'],
      addr?['country'],
    ].whereType<String>().where((p) => p.isNotEmpty).join(', ');
    return School(
      id: json['_id'] as String,
      name: json['name'] as String,
      code: json['code'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      modules: ((json['enabledModules'] as List<dynamic>?) ?? const [])
          .cast<String>()
          .toSet(),
      isActive: json['isActive'] as bool? ?? true,
      city: addr?['city'] as String?,
      contactEmail: json['contactEmail'] as String?,
      contactPhone: json['contactPhone'] as String?,
      address: addressText.isEmpty ? null : addressText,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      adminInviteUrl: json['adminInviteUrl'] as String?,
    );
  }

  final String id;
  final String name;
  final String code;
  // No trial: a trial is a short subscription invoice, not a school state.
  final String status; // 'active' | 'suspended' | 'inactive'
  final Set<String> modules; // e.g. {'Attendance', 'Fees', 'Transport'}
  final bool isActive;
  final String? city;
  final String? contactEmail;
  final String? contactPhone;
  final String? address; // joined display address
  final DateTime? createdAt;

  /// Present right after creation when the admin was invited.
  final String? adminInviteUrl;
}

/// Platform-wide school counts (`GET /schools/stats`).
class SchoolStats {
  const SchoolStats({required this.total, required this.byStatus});

  factory SchoolStats.fromJson(Map<String, dynamic> json) => SchoolStats(
        total: (json['total'] as num?)?.toInt() ?? 0,
        byStatus: ((json['byStatus'] as Map<String, dynamic>?) ?? const {})
            .map((k, v) => MapEntry(k, (v as num).toInt())),
      );

  final int total;
  final Map<String, int> byStatus;
}

/// One school's headline numbers (`GET /schools/:id/overview`).
class SchoolOverview {
  const SchoolOverview({
    required this.school,
    required this.students,
    required this.usersByRole,
  });

  factory SchoolOverview.fromJson(Map<String, dynamic> json) => SchoolOverview(
        school: School.fromJson(json['school'] as Map<String, dynamic>),
        students: (json['students'] as num?)?.toInt() ?? 0,
        usersByRole:
            ((json['usersByRole'] as Map<String, dynamic>?) ?? const {})
                .map((k, v) => MapEntry(k, (v as num).toInt())),
      );

  final School school;
  final int students;
  final Map<String, int> usersByRole;
}

/// A school's Razorpay setup as the API reports it (`GET
/// /schools/:id/payment-gateway`).
///
/// The secrets never leave the server — only whether they are stored — so this
/// object is safe to hold and display. [keyId] is public by design: the parent
/// app needs it to open checkout.
class PaymentGatewayStatus {
  const PaymentGatewayStatus({
    required this.provider,
    required this.keyId,
    required this.hasKeySecret,
    required this.hasWebhookSecret,
    required this.enabled,
    required this.updatedAt,
  });

  final String provider;
  final String? keyId;
  final bool hasKeySecret;
  final bool hasWebhookSecret;
  final bool enabled;
  final DateTime? updatedAt;

  /// Keys are on file, whether or not payments are currently switched on.
  bool get isConfigured => (keyId?.isNotEmpty ?? false) && hasKeySecret;

  factory PaymentGatewayStatus.fromJson(Map<String, dynamic> j) =>
      PaymentGatewayStatus(
        provider: j['provider'] as String? ?? 'razorpay',
        keyId: j['keyId'] as String?,
        hasKeySecret: j['hasKeySecret'] as bool? ?? false,
        hasWebhookSecret: j['hasWebhookSecret'] as bool? ?? false,
        enabled: j['enabled'] as bool? ?? false,
        updatedAt: j['updatedAt'] == null
            ? null
            : DateTime.tryParse(j['updatedAt'] as String),
      );
}
