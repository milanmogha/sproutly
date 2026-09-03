/// Backend base URL.
///
/// Override at run time with:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.5:3000/api
///
/// TEMPORARY: defaulted to the local backend until the Sproutly backend is
/// deployed. Web (Chrome on the host) reaches it at `localhost`; on the Android
/// emulator override with `http://10.0.2.2:3000/api` (its alias for localhost).
/// TODO: restore `https://api.sproutly.duforge.tech/api` once the backend is live.
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.aavaschool.duforge.tech/api',

    // Production: 'https://api.sproutly.duforge.tech/api'
  );

  /// Server root (without the `/api` suffix), used for static file URLs
  /// like uploaded gallery images served at `/uploads/...`.
  static String get serverRoot {
    if (baseUrl.endsWith('/api')) {
      return baseUrl.substring(0, baseUrl.length - 4);
    }
    return baseUrl;
  }
}
