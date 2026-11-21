/// Error raised for any failed API call, carrying the HTTP status and the
/// backend's application error code (e.g. `PASSWORD_CHANGE_REQUIRED`).
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  static const String passwordChangeRequired = 'PASSWORD_CHANGE_REQUIRED';
  static const String accountInactive = 'ACCOUNT_INACTIVE';

  bool get isUnauthorized => statusCode == 401;
  bool get mustChangePassword => code == passwordChangeRequired;
  bool get isAccountInactive => code == accountInactive;
  bool get isNetwork => statusCode == null;

  @override
  String toString() => message;
}
