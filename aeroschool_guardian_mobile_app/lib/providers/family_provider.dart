import 'package:flutter/foundation.dart';

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
    _loading = true;
    if (!silent) {
      _error = null;
      notifyListeners();
    }
    try {
      _overview = await service.home();
      _error = null;
      if (_selectedChildId == null || childById(_selectedChildId!) == null) {
        _selectedChildId = children.isEmpty ? null : children.first.id;
      }
    } on ApiException catch (e) {
      _error = e.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void clear() {
    _overview = null;
    _selectedChildId = null;
    _error = null;
    notifyListeners();
  }
}
