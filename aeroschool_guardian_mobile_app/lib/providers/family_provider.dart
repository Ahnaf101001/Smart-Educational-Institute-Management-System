import 'package:flutter/foundation.dart';

import '../core/live_sync.dart';
import '../models/child.dart';
import '../models/family.dart';
import '../services/api_exception.dart';
import '../services/guardian_service.dart';

/// Family Overview data and the Child Selector (one guardian account →
/// several student profiles → one dashboard).
class FamilyProvider extends ChangeNotifier {
  FamilyProvider(this.service);

  final GuardianService service;

  FamilyOverview? _overview;
  bool _loading = false;
  String? _error;
  String? _selectedChildId;
  String? _fingerprint;
  String? _syncVersion;

  /// Bumped by [clear] (sign-out). A load that started for the previous
  /// guardian is discarded, so a shared phone never shows another family's data.
  int _session = 0;

  /// The values a guardian sees on the dashboards. When a silent re-check
  /// returns different values, open screens are told to reload.
  static String fingerprintOf(FamilyOverview o) => [
    o.totalDue,
    o.unreadNotifications,
    for (final c in o.children) ...[
      c.id,
      c.todayAttendance,
      c.todayInTime,
      c.todayOutTime,
      c.monthPresent,
      c.monthAbsent,
      c.monthLate,
      c.feeDue,
      c.homeworkCount,
      c.nextExamName,
      c.nextExamDate,
      c.latestResultExam,
      c.latestResultGrade,
      c.canViewFees,
      c.canViewResults,
      c.className,
      c.section,
      c.roll,
      c.photoUrl,
    ],
    for (final n in o.notices) n.id,
    for (final e in o.upcomingExams) '${e.examName}${e.subjectName}${e.date}',
    for (final n in o.recentNotifications) n.id,
  ].join('|');

  FamilyOverview? get overview => _overview;
  bool get loading => _loading;
  String? get error => _error;
  List<ChildSummary> get children => _overview?.children ?? const [];

  ChildSummary? get selectedChild {
    if (children.isEmpty) return null;
    return children.firstWhere(
      (c) => c.id == _selectedChildId,
      orElse: () => children.first,
    );
  }

  ChildSummary? childById(String id) {
    for (final c in children) {
      if (c.id == id) return c;
    }
    return null;
  }

  void selectChild(String id) {
    if (_selectedChildId == id) return;
    _selectedChildId = id;
    notifyListeners();
  }

  Future<void> load({bool silent = false}) async {
    if (_loading) return;
    final session = _session;
    _loading = true;
    if (!silent) {
      _error = null;
      notifyListeners();
    }
    try {
      // The overview covers the dashboards; the sync version covers everything else a guardian
      // can open (routine, results, notices, leave, profiles…), including deletions.
      // Both requests run in parallel; syncVersion() never throws, so home() errors keep their type.
      final pendingVersion = service.syncVersion();
      final o = await service.home();
      final version = await pendingVersion;
      if (session != _session) return;
      final fp = fingerprintOf(o);
      final changed =
          (_fingerprint != null && fp != _fingerprint) ||
          (version != null && _syncVersion != null && version != _syncVersion);
      _overview = o;
      _fingerprint = fp;
      _syncVersion = version ?? _syncVersion;
      _error = null;
      if (changed) LiveSync.instance.signal();
      if (_selectedChildId == null || childById(_selectedChildId!) == null) {
        _selectedChildId = children.isEmpty ? null : children.first.id;
      }
    } on ApiException catch (e) {
      if (session == _session) _error = e.message;
    } catch (_) {
      // Unexpected data from the server must not crash the app.
      if (session == _session) {
        _error = 'Something went wrong. Please try again.';
      }
    } finally {
      if (session == _session) {
        _loading = false;
        notifyListeners();
      }
    }
  }

  void clear() {
    _session++;
    _loading = false;
    _overview = null;
    _fingerprint = null;
    _syncVersion = null;
    _selectedChildId = null;
    _error = null;
    notifyListeners();
  }
}
