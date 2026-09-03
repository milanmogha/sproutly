import 'package:dio/dio.dart';
import 'api_config.dart';
import 'token_storage.dart';

/// Shared Dio instance: attaches the bearer token, and on a 401 performs a
/// single-flight refresh then retries the original request once (mirrors the
/// web console's axios interceptor).
class DioClient {
  DioClient._() {
    dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = TokenStorage.instance.accessToken;
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isAuthCall =
              error.requestOptions.path.contains('/auth/');
          final alreadyRetried =
              error.requestOptions.extra['retried'] == true;
          if (error.response?.statusCode == 401 &&
              !isAuthCall &&
              !alreadyRetried) {
            try {
              await refreshTokens();
              final opts = error.requestOptions;
              opts.extra['retried'] = true;
              opts.headers['Authorization'] =
                  'Bearer ${TokenStorage.instance.accessToken}';
              final response = await dio.fetch<dynamic>(opts);
              return handler.resolve(response);
            } on SessionExpiredException {
              await TokenStorage.instance.clear();
              // A single expiry can surface as many simultaneous 401s (every
              // in-flight request awaits the same failed refresh). Fire the
              // "session ended" notice once — resetSessionExpiry() re-arms it
              // when the next session begins.
              if (!_sessionExpiredNotified) {
                _sessionExpiredNotified = true;
                onSessionExpired?.call();
              }
            } catch (_) {
              // Couldn't reach the server. The session is still valid — leave
              // the tokens in place and let the caller surface the network
              // error, so a dead connection never logs anyone out.
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  static final DioClient instance = DioClient._();

  late final Dio dio;

  /// Called when the backend rejects the refresh token: the session is over and
  /// the app should return to the login hub. Set once at startup.
  void Function()? onSessionExpired;

  /// Latches once [onSessionExpired] has fired so a burst of concurrent 401s
  /// only shows the "session ended" message a single time. Cleared by
  /// [resetSessionExpiry] whenever a fresh session is established.
  bool _sessionExpiredNotified = false;

  /// Re-arms the one-shot session-expiry notice. Call after a successful login
  /// or token refresh, so the *next* expiry is announced again.
  void resetSessionExpiry() => _sessionExpiredNotified = false;

  Future<void>? _refreshing;

  /// Trades the stored refresh token for a fresh pair. Concurrent callers share
  /// one in-flight request, so a burst of 401s can't rotate the token twice.
  ///
  /// Throws [SessionExpiredException] when the backend rejects the token (the
  /// user is genuinely signed out), and a [DioException] when the server simply
  /// couldn't be reached (the session survives).
  Future<void> refreshTokens() {
    return _refreshing ??= _doRefresh().whenComplete(() {
      _refreshing = null;
    });
  }

  Future<void> _doRefresh() async {
    final refreshToken = TokenStorage.instance.refreshToken;
    if (refreshToken == null) {
      throw const SessionExpiredException();
    }
    final Response<Map<String, dynamic>> res;
    try {
      // A bare Dio: the interceptor above must not re-enter on this call. It
      // still needs the timeouts — an unbounded refresh would hang whatever is
      // waiting on it.
      res = await Dio(
        BaseOptions(
          baseUrl: ApiConfig.baseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 15),
        ),
      ).post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 401 || status == 403) {
        throw const SessionExpiredException();
      }
      rethrow; // Network/server problem — the session is still good.
    }
    final data = res.data?['data'] as Map<String, dynamic>?;
    if (data == null) throw const SessionExpiredException();
    await TokenStorage.instance.save(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    // The session is alive again — allow a future expiry to be announced.
    resetSessionExpiry();
  }

  /// Unwraps the backend's `{success, statusCode, data}` envelope.
  static T unwrap<T>(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'] as T;
    }
    return body as T;
  }
}

/// The refresh token was revoked or expired — the user must sign in again.
class SessionExpiredException implements Exception {
  const SessionExpiredException();

  @override
  String toString() => 'SessionExpiredException: refresh token rejected';
}
