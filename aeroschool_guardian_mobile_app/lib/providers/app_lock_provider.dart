import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Optional app lock (GA-23 / NF-44 / GA-01v1): a 4-digit PIN asked when the app
/// starts and when it comes back after [timeout] in the background. The PIN
/// never leaves the phone: a salted hash is kept in the platform keystore. It is
/// removed on sign-out, so a shared phone never keeps someone else's lock.
class AppLockProvider extends ChangeNotifier with WidgetsBindingObserver {
  AppLockProvider({
    FlutterSecureStorage? storage,
    this.timeout = const Duration(seconds: 30),
  }) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  final Duration timeout;
  static const _key = 'aeroschool.app_lock';
  static const maxAttempts = 5;

  String? _hash;
  String? _salt;
  bool _locked = false;
  int _failed = 0;
  DateTime? _pausedAt;
  bool _observing = false;

  bool get enabled => _hash != null;
  bool get locked => enabled && _locked;
  int get failedAttempts => _failed;
  bool get tooManyAttempts => _failed >= maxAttempts;

  static bool isValidPin(String pin) => RegExp(r'^\d{4}$').hasMatch(pin);

  /// Salted, iterated SHA-256 of the PIN (stored inside the keystore, never sent anywhere).
  static String hashPin(String pin, String salt) {
    List<int> digest = utf8.encode('$salt:$pin');
    for (var round = 0; round < 10000; round++) {
      digest = sha256.convert([...digest, ...utf8.encode(salt)]).bytes;
    }
    return base64Url.encode(digest);
  }

  Future<void> load() async {
    if (!_observing) {
      WidgetsBinding.instance.addObserver(this);
      _observing = true;
    }
    try {
      final raw = await _storage.read(key: _key);
      if (raw != null && raw.contains('|')) {
        final parts = raw.split('|');
        _salt = parts[0];
        _hash = parts[1];
        _locked = true;
      }
    } catch (_) {
      _hash = null;
    }
    notifyListeners();
  }

  Future<void> setPin(String pin) async {
    if (!isValidPin(pin)) throw ArgumentError('PIN must be 4 digits');
    final rnd = Random.secure();
    _salt = base64Url.encode(List.generate(16, (_) => rnd.nextInt(256)));
    _hash = hashPin(pin, _salt!);
    _locked = false;
    _failed = 0;
    try {
      await _storage.write(key: _key, value: '$_salt|$_hash');
    } catch (_) {}
    notifyListeners();
  }

  bool verify(String pin) => enabled && hashPin(pin, _salt ?? '') == _hash;

  /// Returns true when the PIN matched and the app is unlocked.
  bool unlock(String pin) {
    if (!locked) return true;
    if (verify(pin)) {
      _locked = false;
      _failed = 0;
      notifyListeners();
      return true;
    }
    _failed++;
    notifyListeners();
    return false;
  }

  Future<void> disable() async {
    _hash = null;
    _salt = null;
    _locked = false;
    _failed = 0;
    try {
      await _storage.delete(key: _key);
    } catch (_) {}
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!enabled) return;
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _pausedAt ??= DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      final away = _pausedAt == null
          ? Duration.zero
          : DateTime.now().difference(_pausedAt!);
      _pausedAt = null;
      if (away >= timeout && !_locked) {
        _locked = true;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    if (_observing) WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
