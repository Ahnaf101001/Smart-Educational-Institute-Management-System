import 'package:flutter/foundation.dart';

/// Build-time configuration.
///
/// Override at build/run time, e.g.
/// `flutter run --dart-define=API_BASE_URL=https://school.example.com/api/v1`.
class AppConfig {
  AppConfig._();

  static const String appName = 'AeroSchool Guardian Mobile App';
  static const String brandName = 'AeroSchool';

  static const String _apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String _webAppUrl = String.fromEnvironment('WEB_APP_URL');

  /// Base URL of the Smart Educational Institute Management System REST API.
  ///
  /// Defaults:
  /// * Web build (served by the Docker/nginx image): same origin `/api/v1`,
  ///   which nginx proxies to the backend.
  /// * Android emulator: the host machine is reachable at 10.0.2.2.
  /// * iOS simulator / desktop: localhost.
  static String get apiBaseUrl {
    if (_apiBaseUrl.isNotEmpty) return _trim(_apiBaseUrl);
    if (kIsWeb) return '${Uri.base.origin}/api/v1';
    if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:4001/api/v1';
    return 'http://localhost:4001/api/v1';
  }

  /// Base URL of the school's web application (used for the online-payment
  /// sandbox page and password-reset links that the backend generates).
  static String get webAppUrl {
    if (_webAppUrl.isNotEmpty) return _trim(_webAppUrl);
    if (kIsWeb) return Uri.base.origin;
    if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:3001';
    return 'http://localhost:3001';
  }

  /// Origin of the API server (for resolving relative file/photo URLs).
  static String get apiOrigin {
    final uri = Uri.parse(apiBaseUrl);
    return uri.hasPort ? '${uri.scheme}://${uri.host}:${uri.port}' : '${uri.scheme}://${uri.host}';
  }

  /// How often the app checks for new notifications while open.
  static const Duration notificationPollInterval = Duration(seconds: 60);

  static const Duration requestTimeout = Duration(seconds: 30);

  static String _trim(String v) => v.endsWith('/') ? v.substring(0, v.length - 1) : v;
}
