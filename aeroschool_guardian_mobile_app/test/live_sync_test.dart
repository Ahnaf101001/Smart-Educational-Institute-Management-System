// Live sync: a change saved on the website must reach open app screens
// without the guardian pulling to refresh.
import 'dart:convert';

import 'package:aeroschool_guardian_mobile_app/core/live_sync.dart';
import 'package:aeroschool_guardian_mobile_app/providers/family_provider.dart';
import 'package:aeroschool_guardian_mobile_app/providers/notification_provider.dart';
import 'package:aeroschool_guardian_mobile_app/services/api_client.dart';
import 'package:aeroschool_guardian_mobile_app/services/guardian_service.dart';
import 'package:aeroschool_guardian_mobile_app/services/token_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// A tiny "school server" whose data the test changes, like the website would.
class School {
  String attendance = 'Not marked';
  int unread = 0;

  Map<String, dynamic> get home => {
    'guardian': {'id': 'GDN-1', 'name': 'Parent'},
    'children': [
      {
        'id': 'STU-1',
        'name': 'Child One',
        'className': 'Class 7',
        'todayAttendance': attendance,
        'feeDue': 100,
      },
    ],
    'notices': <dynamic>[],
    'upcomingExams': <dynamic>[],
    'recentNotifications': <dynamic>[],
  };

  http.Client client() => MockClient((r) async {
    final path = r.url.path.replaceFirst('/api/v1', '');
    final data = path.endsWith('/unread-count') ? {'unread': unread} : home;
    return http.Response(
      jsonEncode({'success': true, 'data': data}),
      200,
      headers: {'content-type': 'application/json'},
    );
  });
}

void main() {
  late School school;
  late GuardianService service;
  late int signals;
  void count() => signals++;

  setUp(() {
    school = School();
    service = GuardianService(
      ApiClient(tokens: TokenStorage(), client: school.client()),
    );
    signals = 0;
    LiveSync.instance.addListener(count);
  });
  tearDown(() => LiveSync.instance.removeListener(count));

  test(
    'a re-check signals open screens only when school data changed',
    () async {
      final family = FamilyProvider(service);
      await family.load();
      expect(signals, 0, reason: 'first load is not a change');

      await family.load(silent: true);
      expect(signals, 0, reason: 'same data, nothing to reload');

      school.attendance = 'Present'; // teacher marks attendance on the website
      await family.load(silent: true);
      expect(signals, 1);
      expect(family.children.single.todayAttendance, 'Present');
    },
  );

  test(
    'a new notification is announced even if Alerts was never opened',
    () async {
      final notifications = NotificationProvider(service);
      var announced = 0;
      notifications.onNewNotifications = (n) => announced += n;

      await notifications.refreshCount(); // baseline
      expect(announced, 0);

      school.unread = 2; // two notices published on the website
      await notifications.refreshCount();
      expect(announced, 2);
      expect(notifications.unread, 2);
      expect(signals, 1);
    },
  );
}
