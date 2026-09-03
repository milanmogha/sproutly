import 'package:flutter/foundation.dart';
import '../models/app_user.dart';
import '../network/dio_client.dart';

/// Platform accounts on the real backend — super-admin screens, mirroring the
/// web console. Constructed for every role but fetches nothing until used.
class HttpUserService {
  final ValueNotifier<List<AppUser>> _users = ValueNotifier(const []);

  /// Total accounts on the platform (backend `total`, not just the page).
  final ValueNotifier<int> total = ValueNotifier(0);

  ValueListenable<List<AppUser>> get usersListenable => _users;

  Future<void> refresh() async {
    final data = await _fetch({'limit': 100});
    total.value = (data['total'] as num?)?.toInt() ?? 0;
    _users.value = _parse(data);
  }

  /// Accounts belonging to one school (school detail page).
  Future<List<AppUser>> forSchool(String schoolId) async =>
      _parse(await _fetch({'limit': 100, 'schoolId': schoolId}));

  /// Creates an account. Staff roles get an emailed set-password invite —
  /// returned here too so it can be shared manually. Parents (phone OTP)
  /// return null.
  Future<String?> createUser({
    required String name,
    required String role, // 'admin' | 'teacher' | 'parent'
    required String schoolId,
    String? email,
    String? phone,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/users',
      data: {
        'name': name,
        'role': role,
        'schoolId': schoolId,
        if (email != null && email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      },
    );
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    await refresh();
    return data['inviteUrl'] as String?;
  }

  Future<void> setActive(String id, bool active) async {
    await DioClient.instance.dio
        .patch<Map<String, dynamic>>('/users/$id', data: {'isActive': active});
    await refresh();
  }

  Future<Map<String, dynamic>> _fetch(Map<String, dynamic> query) async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/users', queryParameters: query);
    return DioClient.unwrap<Map<String, dynamic>>(res);
  }

  List<AppUser> _parse(Map<String, dynamic> data) =>
      (data['data'] as List<dynamic>)
          .map((e) => AppUser.fromJson(e as Map<String, dynamic>))
          .toList();
}
