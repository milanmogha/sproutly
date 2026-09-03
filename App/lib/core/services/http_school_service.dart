import 'package:flutter/foundation.dart';
import '../models/school.dart';
import '../network/dio_client.dart';

/// Schools on the real backend — super-admin-only endpoints, mirroring the
/// web console. Constructed for every role but fetches nothing until used.
class HttpSchoolService {
  final ValueNotifier<List<School>> _schools = ValueNotifier(const []);

  ValueListenable<List<School>> get schoolsListenable => _schools;

  /// Reloads the roster (backend sorts newest-first, like the web console).
  Future<void> refresh() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/schools', queryParameters: {'limit': 100});
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    _schools.value = (data['data'] as List<dynamic>)
        .map((e) => School.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<SchoolStats> stats() async {
    final res =
        await DioClient.instance.dio.get<Map<String, dynamic>>('/schools/stats');
    return SchoolStats.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<SchoolOverview> overview(String id) async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/schools/$id/overview');
    return SchoolOverview.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Creates a school along with its admin account (the school IS its admin).
  /// No password: the admin is emailed a set-password link to activate; the
  /// returned [School.adminInviteUrl] carries that link for manual sharing.
  Future<School> createSchool({
    required String name,
    required String adminName,
    required String adminEmail,
    String? adminPhone,
    String? code,
    String? city,
    String? contactEmail,
    String? contactPhone,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/schools',
      data: {
        'name': name,
        if (code != null && code.isNotEmpty) 'code': code,
        if (city != null && city.isNotEmpty) 'address': {'city': city},
        if (contactEmail != null && contactEmail.isNotEmpty)
          'contactEmail': contactEmail,
        if (contactPhone != null && contactPhone.isNotEmpty)
          'contactPhone': contactPhone,
        'admin': {
          'name': adminName,
          'email': adminEmail,
          if (adminPhone != null && adminPhone.isNotEmpty) 'phone': adminPhone,
        },
      },
    );
    final created =
        School.fromJson(DioClient.unwrap<Map<String, dynamic>>(res));
    await refresh();
    return created;
  }

  // ── Payment gateway (super admin only) ────────────────────
  //
  // Each school collects fees into its OWN Razorpay account, so the school
  // hands its keys to the super admin, who enters them here. The school's own
  // admin can neither read nor change them.

  /// Setup status for a school. Secrets are never returned by the API — only
  /// whether they exist — so this can be shown safely.
  Future<PaymentGatewayStatus> paymentGateway(String schoolId) async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/schools/$schoolId/payment-gateway');
    return PaymentGatewayStatus.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  /// Saves credentials. Secrets are write-only: pass null to keep whatever is
  /// already stored, so the super admin can flip [enabled] or fix a key id
  /// without asking the school for its secrets again.
  Future<PaymentGatewayStatus> savePaymentGateway(
    String schoolId, {
    required String keyId,
    String? keySecret,
    String? webhookSecret,
    bool? enabled,
  }) async {
    final res = await DioClient.instance.dio.put<Map<String, dynamic>>(
      '/schools/$schoolId/payment-gateway',
      data: {
        'keyId': keyId,
        if (keySecret != null && keySecret.isNotEmpty) 'keySecret': keySecret,
        if (webhookSecret != null && webhookSecret.isNotEmpty)
          'webhookSecret': webhookSecret,
        if (enabled != null) 'enabled': enabled,
      },
    );
    return PaymentGatewayStatus.fromJson(
        DioClient.unwrap<Map<String, dynamic>>(res));
  }

  Future<void> clearPaymentGateway(String schoolId) async {
    await DioClient.instance.dio
        .delete<dynamic>('/schools/$schoolId/payment-gateway');
  }

  Future<void> toggleModule(String schoolId, String module) async {
    final school = _schools.value.where((s) => s.id == schoolId).firstOrNull;
    if (school == null) return;
    final modules = Set<String>.of(school.modules);
    if (!modules.remove(module)) modules.add(module);
    await DioClient.instance.dio.patch<Map<String, dynamic>>(
      '/schools/$schoolId',
      data: {'enabledModules': modules.toList()},
    );
    await refresh();
  }
}
