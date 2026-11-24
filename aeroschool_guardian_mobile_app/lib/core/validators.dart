import '../l10n/app_localizations.dart';
import '../l10n/l10n_ext.dart';

/// Form rules shared by several screens. Each returns a message already in the
/// user's language, or null when the value is valid.
class Validators {
  Validators._();

  static final _letter = RegExp(r'[A-Za-z]');
  static final _digit = RegExp(r'\d');
  static final _bdMobile = RegExp(r'^01[3-9]\d{8}$');

  /// New-password rule used by change-password and reset-password: at least
  /// 8 characters with both letters and numbers (the server enforces the same).
  static String? passwordStrength(String? value, AppLocalizations l10n) {
    final s = value ?? '';
    if (s.length < 8) return l10n.word('Use at least 8 characters.');
    if (!_letter.hasMatch(s) || !_digit.hasMatch(s)) {
      return l10n.word('Use both letters and numbers.');
    }
    return null;
  }

  /// Confirmation field must repeat the new password exactly.
  static String? passwordsMatch(
    String? value,
    String expected,
    AppLocalizations l10n,
  ) => value == expected ? null : l10n.passwordsDoNotMatch;

  /// Bangladeshi mobile number (11 digits, 013–019 prefixes). Empty is allowed
  /// for optional fields; pass [required] to reject it.
  static String? bdMobile(
    String? value,
    AppLocalizations l10n, {
    bool required = false,
  }) {
    final s = (value ?? '').replaceAll(RegExp(r'\D'), '');
    if (s.isEmpty) return required ? l10n.enterValidBdMobile : null;
    return _bdMobile.hasMatch(s) ? null : l10n.enterValidBdMobile;
  }
}
