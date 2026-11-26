import 'package:flutter/foundation.dart';

/// App-wide "school data changed" signal.
///
/// While the app is in the foreground it re-checks the server every
/// AppConfig.liveSyncInterval (and immediately on a push or when the app is
/// reopened). When the family overview or the unread count differs from the
/// last check, [signal] bumps [revision]; every open data screen listens and
/// reloads silently, and the Home screen shows an "Updated" banner. Nothing is
/// cached on the device, so a reload always returns what the website saved.
class LiveSync extends ChangeNotifier {
  LiveSync._();

  static final LiveSync instance = LiveSync._();

  int _revision = 0;
  DateTime? _lastChange;

  int get revision => _revision;
  DateTime? get lastChange => _lastChange;

  void signal() {
    _revision++;
    _lastChange = DateTime.now();
    notifyListeners();
  }
}
