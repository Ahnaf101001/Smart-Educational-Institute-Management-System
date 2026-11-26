import 'package:aeroschool_guardian_mobile_app/core/theme.dart';
import 'package:aeroschool_guardian_mobile_app/widgets/common.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('negative statuses are never shown in the success colour', () {
    for (final s in [
      'Not Submitted',
      'Inactive',
      'Unpaid',
      'Absent',
      'Overdue',
    ]) {
      expect(StatusChip.colorFor(s), AppColors.danger, reason: s);
    }
    for (final s in ['Submitted', 'Active', 'Paid', 'Present']) {
      expect(StatusChip.colorFor(s), AppColors.success, reason: s);
    }
  });
}
