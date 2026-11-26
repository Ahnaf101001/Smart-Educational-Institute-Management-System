import 'dart:async';

import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../core/live_sync.dart';
import '../models/family.dart';
import '../services/api_exception.dart';
import '../services/guardian_service.dart';

/// Guardian notifications. Every notification carries the child's name so a
/// guardian with several children knows who it is about; the list can be
/// filtered child-wise. While the app is open the unread count is polled and
/// new items raise an in-app alert through [onNewNotifications].
class NotificationProvider extends ChangeNotifier {
  NotificationProvider(this.service);

  final GuardianService service;

  List<AppNotification> _items = const [];
  int _unread = 0;
  bool _loading = false;
  String? _error;
  Timer? _timer;
  bool _baseline = false;

  /// Called on every poll tick so other data (the family overview) is
  /// re-checked on the same schedule.
  VoidCallback? onTick;

  /// Called with the number of newly arrived notifications.
  void Function(int newCount)? onNewNotifications;

  List<AppNotification> get items => _items;
  int get unread => _unread;
  bool get loading => _loading;
  String? get error => _error;

  void startPolling() {
    _timer?.cancel();
    refreshCount();
    _timer = Timer.periodic(AppConfig.notificationPollInterval, (_) {
      refreshCount();
      onTick?.call();
    });
  }

  void stopPolling() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> refreshCount() async {
    try {
      final n = await service.unreadCount();
      // Compare with the last known count, whether or not the Alerts list was
      // ever opened (previously new items were only announced after it was).
      if (_baseline && n > _unread) {
        onNewNotifications?.call(n - _unread);
        LiveSync.instance.signal();
      }
      _baseline = true;
      if (n != _unread) {
        _unread = n;
        notifyListeners();
      }
    } on ApiException {
      // Polling failures are silent; the list screen shows errors.
    }
  }

  Future<void> load({String? studentId}) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _items = await service.notifications(studentId: studentId);
      if (studentId == null) _unread = _items.where((n) => n.isUnread).length;
    } on ApiException catch (e) {
      _error = e.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> markAllRead() async {
    try {
      await service.markNotificationsRead();
      _unread = 0;
      _items = _items
          .map(
            (n) => n.isUnread
                ? AppNotification(
                    id: n.id,
                    title: n.title,
                    body: n.body,
                    eventType: n.eventType,
                    studentId: n.studentId,
                    studentName: n.studentName,
                    createdAt: n.createdAt,
                    readAt: DateTime.now(),
                  )
                : n,
          )
          .toList();
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
    }
  }

  void clear() {
    stopPolling();
    onTick = null;
    _baseline = false;
    _items = const [];
    _unread = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }
}
