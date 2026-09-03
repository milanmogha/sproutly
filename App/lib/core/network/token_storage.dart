import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT pair in secure storage with an in-memory cache so
/// interceptors can read synchronously after startup.
class TokenStorage {
  TokenStorage._();
  static final TokenStorage instance = TokenStorage._();

  static const _kAccess = 'auth.accessToken';
  static const _kRefresh = 'auth.refreshToken';

  final _storage = const FlutterSecureStorage();

  String? _access;
  String? _refresh;

  String? get accessToken => _access;
  String? get refreshToken => _refresh;

  Future<void> load() async {
    _access = await _storage.read(key: _kAccess);
    _refresh = await _storage.read(key: _kRefresh);
  }

  Future<void> save({
    required String accessToken,
    required String refreshToken,
  }) async {
    _access = accessToken;
    _refresh = refreshToken;
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
  }

  Future<void> clear() async {
    _access = null;
    _refresh = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}
