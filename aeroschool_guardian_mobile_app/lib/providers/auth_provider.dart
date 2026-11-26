import 'package:flutter/foundation.dart';

import '../models/session_user.dart';
import '../services/api_client.dart';
import '../services/api_exception.dart';
import '../services/auth_service.dart';
import '../services/token_storage.dart';

enum AuthStatus { checking, signedOut, mustChangePassword, signedIn }

/// Session state: login, first-login password change, restore and logout.
class AuthProvider extends ChangeNotifier {
  AuthProvider({required ApiClient api, required this.tokens})
    : _auth = AuthService(api) {
    api.onUnauthorized = _handleUnauthorized;
    api.onPasswordChangeRequired = _handlePasswordChangeRequired;
  }

  final AuthService _auth;
  final TokenStorage tokens;

  AuthStatus _status = AuthStatus.checking;
  SessionUser? _user;
  String? _loginEmail;
  String? _pendingTempPassword; // kept in memory only, for the forced change
  bool _rememberMe = true;
  String? _sessionMessage;

  AuthStatus get status => _status;
  SessionUser? get user => _user;
  bool get knowsTemporaryPassword => _pendingTempPassword != null;

  /// One-time message for the login screen (e.g. "session expired").
  String? takeSessionMessage() {
    final m = _sessionMessage;
    _sessionMessage = null;
    return m;
  }

  AuthService get service => _auth;

  Future<void> restore() async {
    final token = await tokens.readToken();
    if (token == null) {
      _set(AuthStatus.signedOut);
      return;
    }
    try {
      final me = await _auth.me();
      if (!me.isGuardian) {
        await tokens.clearToken();
        _set(AuthStatus.signedOut);
        return;
      }
      _user = me;
      _loginEmail = me.email;
      _set(
        me.mustChangePassword
            ? AuthStatus.mustChangePassword
            : AuthStatus.signedIn,
      );
    } on ApiException catch (e) {
      if (e.isNetwork) {
        // Offline at start-up: keep the stored session and let screens retry.
        _set(AuthStatus.signedIn);
      } else {
        await tokens.clearToken();
        _set(AuthStatus.signedOut);
      }
    }
  }

  Future<void> login(
    String email,
    String password, {
    required bool rememberMe,
  }) async {
    final result = await _auth.login(email, password);
    _rememberMe = rememberMe;
    _loginEmail = email.trim();
    await tokens.saveToken(result.token, persist: rememberMe);
    await tokens.saveRememberedLogin(remember: rememberMe, email: _loginEmail);
    _user = result.user;
    if (result.user.mustChangePassword) {
      _pendingTempPassword = password;
      _set(AuthStatus.mustChangePassword);
    } else {
      _set(AuthStatus.signedIn);
    }
  }

  /// Forced first-login change (or a voluntary change from the profile).
  /// The server ends all sessions, so we sign straight back in with the new password.
  Future<void> changePassword({
    String? currentPassword,
    required String newPassword,
  }) async {
    final current = currentPassword ?? _pendingTempPassword;
    if (current == null || current.isEmpty) {
      throw ApiException('Enter your current password.');
    }
    await _auth.changePassword(current, newPassword);
    _pendingTempPassword = null;
    final email = _loginEmail ?? _user?.email;
    if (email == null || email.isEmpty) {
      await logout(
        message: 'Password changed. Please sign in with your new password.',
      );
      return;
    }
    try {
      final result = await _auth.login(email, newPassword);
      await tokens.saveToken(result.token, persist: _rememberMe);
      _user = result.user;
      _set(AuthStatus.signedIn);
    } on ApiException {
      await logout(
        message: 'Password changed. Please sign in with your new password.',
      );
    }
  }

  Future<String> forgotPassword(String email) => _auth.forgotPassword(email);

  Future<void> resetPassword(String token, String newPassword) =>
      _auth.resetPassword(token, newPassword);

  Future<void> logout({
    String? message,
    bool allDevices = false,
    bool revokeSession = true,
  }) async {
    if (allDevices) {
      try {
        await _auth.logoutAllDevices();
      } catch (_) {}
    } else if (revokeSession) {
      // Otherwise the token would stay valid on the server until it expires.
      await _auth.logoutThisDevice();
    }
    await tokens.clearToken();
    _user = null;
    _pendingTempPassword = null;
    _sessionMessage = message;
    _set(AuthStatus.signedOut);
  }

  void _handleUnauthorized() {
    if (_status == AuthStatus.signedIn ||
        _status == AuthStatus.mustChangePassword) {
      // The server already rejected the token: nothing left to revoke.
      logout(
        message: 'Your session has ended. Please sign in again.',
        revokeSession: false,
      );
    }
  }

  void _handlePasswordChangeRequired() {
    if (_status == AuthStatus.signedIn) _set(AuthStatus.mustChangePassword);
  }

  void _set(AuthStatus s) {
    _status = s;
    notifyListeners();
  }
}
