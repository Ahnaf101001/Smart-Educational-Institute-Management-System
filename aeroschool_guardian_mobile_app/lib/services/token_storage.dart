import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Stores the session token in the platform keystore (Android Keystore / iOS
/// Keychain; encrypted browser storage on web). The token is only persisted
/// when the guardian ticks "Remember me"; otherwise it lives in memory.
class TokenStorage {
  TokenStorage({FlutterSecureStorage? secure}) : _secure = secure ?? const FlutterSecureStorage();

  final FlutterSecureStorage _secure;
  static const _tokenKey = 'aeroschool.session_token';
  static const _emailKey = 'aeroschool.remembered_email';
  static const _rememberKey = 'aeroschool.remember_me';

  String? _memoryToken;

  Future<String?> readToken() async {
    if (_memoryToken != null) return _memoryToken;
    try {
      _memoryToken = await _secure.read(key: _tokenKey);
    } catch (_) {
      _memoryToken = null;
    }
    return _memoryToken;
  }

  Future<void> saveToken(String token, {required bool persist}) async {
    _memoryToken = token;
    try {
      if (persist) {
        await _secure.write(key: _tokenKey, value: token);
      } else {
        await _secure.delete(key: _tokenKey);
      }
    } catch (_) {
      // Keystore unavailable (e.g. private browsing): keep the in-memory session.
    }
  }

  Future<void> clearToken() async {
    _memoryToken = null;
    try {
      await _secure.delete(key: _tokenKey);
    } catch (_) {}
  }

  Future<void> saveRememberedLogin({required bool remember, String? email}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_rememberKey, remember);
    if (remember && email != null) {
      await prefs.setString(_emailKey, email);
    } else {
      await prefs.remove(_emailKey);
    }
  }

  Future<({bool remember, String? email})> readRememberedLogin() async {
    final prefs = await SharedPreferences.getInstance();
    return (remember: prefs.getBool(_rememberKey) ?? true, email: prefs.getString(_emailKey));
  }
}
