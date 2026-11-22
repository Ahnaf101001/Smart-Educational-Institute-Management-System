import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// App language (English / বাংলা). Defaults to the phone's language when it is
/// Bangla, otherwise English; the guardian's choice is remembered on the device.
class LocaleProvider extends ChangeNotifier {
  static const _key = 'aeroschool.locale';
  static const supported = [Locale('en'), Locale('bn')];

  Locale? _locale;

  /// Null means "follow the device" (resolved by MaterialApp against [supported]).
  Locale? get locale => _locale;

  bool get isBangla =>
      (_locale ?? PlatformDispatcher.instance.locale).languageCode == 'bn';

  /// Called after the guardian changes language (used to sync the account preference).
  void Function(String languageCode)? onChanged;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final code = prefs.getString(_key);
      if (code == 'en' || code == 'bn') {
        _locale = Locale(code!);
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> setLanguage(String code) async {
    if (code != 'en' && code != 'bn') return;
    _locale = Locale(code);
    notifyListeners();
    onChanged?.call(code);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, code);
    } catch (_) {}
  }
}
