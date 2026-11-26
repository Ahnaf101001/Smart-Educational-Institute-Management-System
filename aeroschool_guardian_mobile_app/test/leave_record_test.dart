import 'package:aeroschool_guardian_mobile_app/models/support.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('leave awaiting clarification exposes reply, withdraw and history', () {
    final l = LeaveRecord.fromJson({
      'id': 'LV-000001',
      'leaveType': 'Sick',
      'status': 'Clarification',
      'days': 2,
      'decisionNote': 'Please attach a doctor note',
      'canWithdraw': true,
      'canRespond': true,
      'history': [
        {'action': 'Submitted', 'by': 'Guardian', 'at': '2026-11-21T08:25:00Z'},
        {
          'action': 'Clarification',
          'by': 'Super Admin',
          'at': '2026-11-22T08:25:00Z',
          'note': 'Please attach a doctor note',
        },
      ],
    });
    expect(l.needsReply, isTrue);
    expect(l.canWithdraw, isTrue);
    expect(l.history.map((h) => h.action), ['Submitted', 'Clarification']);
    expect(l.history.last.note, 'Please attach a doctor note');
  });

  test('decided leave offers no actions and tolerates missing history', () {
    final l = LeaveRecord.fromJson({
      'id': 'LV-000002',
      'status': 'Approved',
      'days': 1,
    });
    expect(l.needsReply, isFalse);
    expect(l.canWithdraw, isFalse);
    expect(l.history, isEmpty);
  });
}
