import '../core/format.dart';
import '../models/school.dart';
import '../models/session_user.dart';
import 'api_client.dart';
import 'api_exception.dart';

/// Authentication against `/auth/*`. Guardians never self-register: accounts
/// are created by the school admin (email + temporary password).
class AuthService {
  AuthService(this._api);

  final ApiClient _api;

  Future<({String token, SessionUser user})> login(
    String email,
    String password,
  ) async {
    final data = J.map(
      await _api.post(
        '/auth/login',
        body: {'identifier': email.trim(), 'password': password},
        auth: false,
      ),
    );
    if (data['requiresOtp'] == true) {
      throw ApiException(
        'Two-step verification is enabled for this account. Please contact the school to use the guardian app.',
      );
    }
    final token = J.str(data['token']);
    if (token.isEmpty) throw ApiException('Sign-in failed. Please try again.');
    final user = SessionUser.fromJson(J.map(data['user']));
    if (!user.isGuardian) {
      throw ApiException(
        'This app is for guardians only. Please use the school web portal for staff accounts.',
        statusCode: 403,
      );
    }
    return (token: token, user: user);
  }

  Future<SessionUser> me() async =>
      SessionUser.fromJson(J.map(await _api.get('/auth/me')));

  /// Changing the password ends every session server-side, so callers sign in again.
  Future<void> changePassword(String current, String next) => _api.post(
    '/auth/change-password',
    body: {'currentPassword': current, 'newPassword': next},
  );

  /// Sends a secure, single-use reset link to the registered email. `client: app` makes the
  /// email include an `aeroschool://reset-password` link that opens the app (web link as fallback).
  Future<String> forgotPassword(String email) async {
    await _api.post(
      '/auth/password/forgot',
      body: {'identifier': email.trim(), 'client': 'app'},
      auth: false,
    );
    return 'If this email is registered, a password reset link has been sent. The link is valid for 30 minutes.';
  }

  /// Completes a reset with the token from the emailed link.
  Future<void> resetPassword(String token, String newPassword) => _api.post(
    '/auth/password/reset',
    body: {'token': token, 'password': newPassword},
    auth: false,
  );

  Future<void> logoutAllDevices() => _api.post('/auth/logout-all');

  /// Public school branding/contact for the login screen.
  Future<SchoolInfo> publicSchool() async => SchoolInfo.fromJson(
    J.map(await _api.get('/public/institute', auth: false)),
  );
}
