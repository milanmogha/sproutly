/// A platform account (parent / teacher / admin / super admin) listed in the
/// super-admin user management screens (`GET /users` item).
class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.active,
    this.phone,
    this.schoolId,
    this.lastLoginAt,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['_id'] as String,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      role: _displayRole(json['role'] as String? ?? 'staff'),
      active: json['isActive'] as bool? ?? true,
      phone: json['phone'] as String?,
      schoolId: json['schoolId'] as String?,
      lastLoginAt: DateTime.tryParse(json['lastLoginAt'] as String? ?? ''),
    );
  }

  static String _displayRole(String backendRole) {
    // 'super_admin' -> 'Super Admin', 'teacher' -> 'Teacher'
    return backendRole
        .split('_')
        .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1))
        .join(' ');
  }

  final String id;
  final String name;
  final String email;
  final String role; // display form, e.g. 'Super Admin'
  final bool active;
  final String? phone;

  /// Backend school ObjectId; null for super admins (platform account).
  final String? schoolId;
  final DateTime? lastLoginAt;
}
