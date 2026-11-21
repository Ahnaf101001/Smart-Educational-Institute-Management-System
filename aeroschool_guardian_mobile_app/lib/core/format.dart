import 'package:intl/intl.dart';

/// Formatting and tolerant JSON parsing helpers.
///
/// PostgreSQL NUMERIC columns arrive as strings ("1500.00"), DATE columns as
/// "YYYY-MM-DD" and TIMESTAMPTZ as ISO strings, so parsing is defensive.
class Fmt {
  Fmt._();

  static final NumberFormat _money = NumberFormat.decimalPattern('en_IN');

  static String money(num? value) => '৳${_money.format((value ?? 0).round())}';

  static String date(DateTime? d) => d == null ? '—' : DateFormat('d MMM yyyy').format(d);
  static String shortDate(DateTime? d) => d == null ? '—' : DateFormat('d MMM').format(d);
  static String dateTime(DateTime? d) => d == null ? '—' : DateFormat('d MMM yyyy, h:mm a').format(d.toLocal());
  static String time(DateTime? d) => d == null ? '—' : DateFormat('h:mm a').format(d.toLocal());
  static String monthLabel(String yyyyMm) {
    final d = DateTime.tryParse('$yyyyMm-01');
    return d == null ? yyyyMm : DateFormat('MMMM yyyy').format(d);
  }

  static String month(DateTime d) => DateFormat('yyyy-MM').format(d);

  /// "08:30:00" or "08:30" → "8:30 AM".
  static String clock(String? hhmm) {
    if (hhmm == null || hhmm.isEmpty) return '';
    final parts = hhmm.split(':');
    final h = int.tryParse(parts[0]);
    final m = parts.length > 1 ? int.tryParse(parts[1]) : 0;
    if (h == null || m == null) return hhmm;
    return DateFormat('h:mm a').format(DateTime(2000, 1, 1, h, m));
  }

  static String percent(num? v) => v == null ? '—' : '${v % 1 == 0 ? v.toInt() : v.toStringAsFixed(1)}%';

  static String relative(DateTime? d) {
    if (d == null) return '';
    final diff = DateTime.now().difference(d.toLocal());
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} h ago';
    if (diff.inDays < 7) return '${diff.inDays} d ago';
    return date(d);
  }

  static String initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}

/// Defensive readers for loosely typed JSON maps.
class J {
  J._();

  static String str(dynamic v, [String fallback = '']) => v == null ? fallback : v.toString();
  static String? strOrNull(dynamic v) => v == null || v.toString().isEmpty ? null : v.toString();
  static num numOf(dynamic v, [num fallback = 0]) {
    if (v is num) return v;
    if (v is String) return num.tryParse(v) ?? fallback;
    return fallback;
  }

  static num? numOrNull(dynamic v) {
    if (v == null) return null;
    if (v is num) return v;
    return num.tryParse(v.toString());
  }

  static int intOf(dynamic v, [int fallback = 0]) => numOf(v, fallback).toInt();
  static bool boolOf(dynamic v, [bool fallback = false]) {
    if (v is bool) return v;
    if (v is String) return v == 'true' || v == '1';
    if (v is num) return v != 0;
    return fallback;
  }

  /// Parses dates. Date-only strings are treated as local calendar dates.
  static DateTime? date(dynamic v) {
    if (v == null) return null;
    final s = v.toString();
    if (s.isEmpty) return null;
    if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(s)) {
      final p = s.split('-').map(int.parse).toList();
      return DateTime(p[0], p[1], p[2]);
    }
    return DateTime.tryParse(s)?.toLocal();
  }

  static Map<String, dynamic> map(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
  static List<Map<String, dynamic>> list(dynamic v) =>
      v is List ? v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : <Map<String, dynamic>>[];
}
