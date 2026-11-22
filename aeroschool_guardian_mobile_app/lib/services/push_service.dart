import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import 'guardian_service.dart';

/// Background push notifications (Firebase Cloud Messaging).
///
/// Firebase is configured through build-time values, so no google-services.json /
/// GoogleService-Info.plist has to be committed:
///
/// ```
/// flutter build apk --dart-define=FIREBASE_API_KEY=... --dart-define=FIREBASE_APP_ID=... \
///   --dart-define=FIREBASE_MESSAGING_SENDER_ID=... --dart-define=FIREBASE_PROJECT_ID=...
/// ```
///
/// Without these values push is disabled and the app keeps polling for new
/// notifications while it is open.
class PushService {
  PushService(this._guardian);

  final GuardianService _guardian;

  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const _senderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
  );
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

  static bool get isConfigured =>
      !kIsWeb &&
      _apiKey.isNotEmpty &&
      _appId.isNotEmpty &&
      _senderId.isNotEmpty &&
      _projectId.isNotEmpty;

  bool _ready = false;
  String? _token;
  StreamSubscription<RemoteMessage>? _onMessage;
  StreamSubscription<RemoteMessage>? _onOpened;
  StreamSubscription<String>? _onRefresh;

  /// Called for pushes received while the app is in the foreground.
  void Function(RemoteMessage message)? onForegroundMessage;

  /// Called when the guardian taps a push notification.
  void Function(RemoteMessage message)? onNotificationTap;

  /// Initialises Firebase, asks for permission and registers this device with the
  /// school server for the signed-in guardian. Safe to call more than once.
  Future<void> start() async {
    if (!isConfigured) return;
    try {
      if (!_ready) {
        await Firebase.initializeApp(
          options: FirebaseOptions(
            apiKey: _apiKey,
            appId: _appId,
            messagingSenderId: _senderId,
            projectId: _projectId,
            iosBundleId: _iosBundleId.isEmpty ? null : _iosBundleId,
          ),
        );
        _ready = true;
      }
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      _onMessage ??= FirebaseMessaging.onMessage.listen(
        (m) => onForegroundMessage?.call(m),
      );
      _onOpened ??= FirebaseMessaging.onMessageOpenedApp.listen(
        (m) => onNotificationTap?.call(m),
      );
      final initial = await messaging.getInitialMessage();
      if (initial != null) onNotificationTap?.call(initial);

      // The backend sends with the FCM HTTP v1 `message.token` field, which takes the FCM
      // registration token. firebase_messaging 17 deprecates getToken/onTokenRefresh in favour of
      // Installation-ID based register()/onRegistered; keep the registration token until the
      // backend sender is moved to installation IDs.
      // ignore: deprecated_member_use
      _token = await messaging.getToken();
      if (_token != null) await _register(_token!);
      // ignore: deprecated_member_use
      _onRefresh ??= messaging.onTokenRefresh.listen(_register);
    } catch (e) {
      debugPrint('Push setup failed: $e');
    }
  }

  Future<void> _register(String token) async {
    _token = token;
    try {
      await _guardian.registerDevice(
        token: token,
        platform: defaultTargetPlatform == TargetPlatform.iOS
            ? 'ios'
            : 'android',
        appVersion: AppConfig.appVersion,
      );
    } catch (e) {
      debugPrint('Push token registration failed: $e');
    }
  }

  /// Removes this device from the guardian's account (call before logging out).
  Future<void> stop() async {
    final token = _token;
    if (!_ready || token == null) return;
    try {
      await _guardian.unregisterDevice(token);
    } catch (_) {}
  }
}
