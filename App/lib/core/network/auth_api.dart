import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import '../theme/app_theme.dart';
import 'dio_client.dart';
import 'token_storage.dart';

/// The signed-in identity, decoded client-side from the access token's
/// payload (same unverified-decode trust model the web console uses — there
/// is no /auth/me endpoint).
class AuthSession {
  const AuthSession({
    required this.userId,
    required this.email,
    required this.role,
    required this.schoolId,
  });

  final String userId;
  final String email;

  /// Backend role string, e.g. 'super_admin', 'admin', 'teacher'.
  final String role;

  /// null only for super_admin.
  final String? schoolId;

  /// The interface this account signs into, or null for a role the app has no
  /// shell for.
  UserRole? get uiRole => switch (role) {
        'parent' => UserRole.parent,
        'teacher' => UserRole.teacher,
        'admin' => UserRole.admin,
        'super_admin' => UserRole.superAdmin,
        _ => null,
      };
}

class AuthApi {
  AuthApi._();
  static final AuthApi instance = AuthApi._();

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    return _persistAndDecode(res);
  }

  /// Parents: request a one-time code, delivered to their email.
  ///
  /// TEMPORARY: email stands in for WhatsApp while that provider is down.
  /// Succeeds identically whether or not the email is registered, so the
  /// screen can't be used to discover which parents have accounts. A 503 means
  /// the code genuinely could not be sent and the parent should retry.
  Future<void> requestOtp({required String email}) async {
    await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/auth/otp/request',
      data: {'email': email},
    );
  }

  /// Parents: verify the one-time code and start a session.
  Future<AuthSession> verifyOtp({
    required String email,
    required String code,
  }) async {
    final res = await DioClient.instance.dio.post<Map<String, dynamic>>(
      '/auth/otp/verify',
      data: {'email': email, 'code': code},
    );
    return _persistAndDecode(res);
  }

  Future<AuthSession> _persistAndDecode(Response<Map<String, dynamic>> res) async {
    final data = DioClient.unwrap<Map<String, dynamic>>(res);
    final access = data['accessToken'] as String;
    await TokenStorage.instance.save(
      accessToken: access,
      refreshToken: data['refreshToken'] as String,
    );
    // A brand-new session: re-arm the one-shot "session ended" notice so the
    // next expiry is announced again.
    DioClient.instance.resetSessionExpiry();
    return _decodeSession(access);
  }

  /// Returns the decoded session from the currently stored access token, or
  /// null if no token is present (e.g. never logged in / already logged out).
  AuthSession? get currentSession {
    final token = TokenStorage.instance.accessToken;
    if (token == null) return null;
    try {
      return _decodeSession(token);
    } catch (_) {
      return null;
    }
  }

  /// Resumes the session persisted on this device, so a signed-in user never
  /// sees the login screen again until they log out. Call once at startup,
  /// after [TokenStorage.load].
  ///
  /// Never waits on the network: the role comes from the stored access token,
  /// and a lapsed one is renewed in the background. Launching must not hang on
  /// a slow or unreachable API.
  ///
  /// Returns null only when there is genuinely no session: never signed in, or
  /// signed out.
  Future<AuthSession?> restoreSession() async {
    final refresh = TokenStorage.instance.refreshToken;
    final access = TokenStorage.instance.accessToken;
    if (refresh == null || access == null) return null;

    if (_isExpired(access)) {
      // Renew now so the first screen's requests carry a live token — but let
      // the UI come up either way. A request that beats the refresh just 401s
      // and the interceptor retries it, and a rejected refresh token trips
      // onSessionExpired, which returns the app to the hub.
      unawaited(
        DioClient.instance.refreshTokens().catchError((Object error) {
          if (error is SessionExpiredException) {
            TokenStorage.instance.clear();
            DioClient.instance.onSessionExpired?.call();
          }
          // Anything else is a network problem: the session is still valid and
          // the interceptor will refresh once the connection is back.
        }),
      );
    }
    return currentSession;
  }

  /// True once the token's `exp` has passed. The 30s skew keeps us from
  /// attaching a token that dies in flight.
  bool _isExpired(String jwt) {
    try {
      final payload = _decodePayload(jwt);
      final exp = payload['exp'] as int?;
      if (exp == null) return false;
      final expiry = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
      return expiry.isBefore(DateTime.now().add(const Duration(seconds: 30)));
    } catch (_) {
      return true;
    }
  }

  Future<void> logout() async {
    try {
      // Name this device so the backend ends only its session — the user's
      // other signed-in devices stay logged in.
      await DioClient.instance.dio.post<void>(
        '/auth/logout',
        data: {'refreshToken': TokenStorage.instance.refreshToken},
      );
    } on DioException {
      // Clear locally regardless — the session is over either way.
    } finally {
      await TokenStorage.instance.clear();
    }
  }

  Map<String, dynamic> _decodePayload(String jwt) {
    final parts = jwt.split('.');
    return json.decode(
      utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
    ) as Map<String, dynamic>;
  }

  AuthSession _decodeSession(String jwt) {
    final payload = _decodePayload(jwt);
    return AuthSession(
      userId: payload['sub'] as String,
      // Parents authenticate by phone and may carry an empty email claim.
      email: (payload['email'] as String?) ?? '',
      role: payload['role'] as String,
      schoolId: payload['schoolId'] as String?,
    );
  }
}
