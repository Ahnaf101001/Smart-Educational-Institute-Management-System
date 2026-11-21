import 'package:aeroschool_guardian_mobile_app/core/format.dart';
import 'package:aeroschool_guardian_mobile_app/models/child.dart';
import 'package:aeroschool_guardian_mobile_app/models/family.dart';
import 'package:aeroschool_guardian_mobile_app/models/fees.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('JSON parsing', () {
    test('numeric strings and date-only values parse safely', () {
      expect(J.numOf('1500.50'), 1500.5);
      expect(J.numOf(null), 0);
      final d = J.date('2026-11-21')!;
      expect([d.year, d.month, d.day], [2026, 11, 21]);
    });

    test('family overview keeps each child separate', () {
      final o = FamilyOverview.fromJson({
        'guardian': {'id': 'GDN-00005', 'name': 'Mizanur Rahman', 'relationDefault': 'Father'},
        'children': [
          {'id': 'STU-4003', 'name': 'Tanvir Ahmed', 'className': 'Class 7-A', 'section': 'A', 'roll': '001', 'feeDue': '1200.00', 'todayAttendance': 'Present', 'homeworkCount': 2},
          {'id': 'STU-4008', 'name': 'Tasnim Ahmed', 'className': 'Class 6-A', 'section': 'A', 'roll': '003', 'feeDue': '0', 'todayAttendance': 'Absent', 'canViewFees': false},
        ],
        'totalDue': '1200',
        'unreadNotifications': 3,
      });
      expect(o.children.length, 2);
      expect(o.presentToday, 1);
      expect(o.absentToday, 1);
      expect(o.pendingHomework, 2);
      expect(o.children.first.classLine, 'Class 7 • Section A • Roll 001');
      expect(o.children.last.canViewFees, isFalse);
    });

    test('notifications are categorised for child-wise filtering', () {
      final n = AppNotification.fromJson({'id': 1, 'eventType': 'StudentAbsent', 'body': 'Karim is absent today', 'studentName': 'Karim'});
      expect(n.category, 'Attendance');
      expect(n.isUnread, isTrue);
    });

    test('fee categories follow the specification', () {
      FeeInvoice inv(String head) => FeeInvoice.fromJson({'id': 'x', 'feeHead': head, 'amount': '100', 'due': '100'});
      expect(inv('Monthly Tuition Fee').category, 'Monthly Tuition');
      expect(inv('Admission Fee').category, 'Admission');
      expect(inv('Half-yearly Exam Fee').category, 'Examination');
      expect(inv('Transport Fee').category, 'Transport');
      expect(inv('Library Fine').category, 'Other');
    });

    test('child summary tolerates missing optional data', () {
      final c = ChildSummary.fromJson({'id': 'STU-1', 'name': 'A'});
      expect(c.todayRoutine, isEmpty);
      expect(c.monthAttendancePercentage, isNull);
    });
  });
}
