import 'package:aeroschool_guardian_mobile_app/core/validators.dart';
import 'package:aeroschool_guardian_mobile_app/l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  final en = lookupAppLocalizations(const Locale('en'));
  final bn = lookupAppLocalizations(const Locale('bn'));

  test('password strength needs 8+ characters with letters and digits', () {
    expect(Validators.passwordStrength('abc1', en), isNotNull);
    expect(Validators.passwordStrength('abcdefgh', en), isNotNull);
    expect(Validators.passwordStrength('12345678', en), isNotNull);
    expect(Validators.passwordStrength('Secret2026', en), isNull);
    // The same rule answers in Bangla when the app is in Bangla.
    expect(Validators.passwordStrength('abc', bn), isNot(contains('Use')));
  });

  test('confirmation must match the new password', () {
    expect(Validators.passwordsMatch('Secret2026', 'Secret2026', en), isNull);
    expect(
      Validators.passwordsMatch('Secret2027', 'Secret2026', en),
      en.passwordsDoNotMatch,
    );
  });

  test('Bangladeshi mobile numbers', () {
    expect(Validators.bdMobile('', en), isNull);
    expect(Validators.bdMobile('', en, required: true), isNotNull);
    expect(Validators.bdMobile('01711000301', en), isNull);
    expect(
      Validators.bdMobile('+880 1711-000301'.replaceFirst('+880 ', '0'), en),
      isNull,
    );
    expect(Validators.bdMobile('01211000301', en), isNotNull);
    expect(Validators.bdMobile('0171100030', en), isNotNull);
  });
}
