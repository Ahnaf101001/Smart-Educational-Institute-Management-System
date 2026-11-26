import 'package:aeroschool_guardian_mobile_app/models/academics.dart';
import 'package:aeroschool_guardian_mobile_app/models/campus.dart';
import 'package:aeroschool_guardian_mobile_app/models/child.dart';
import 'package:aeroschool_guardian_mobile_app/providers/app_lock_provider.dart';
import 'package:aeroschool_guardian_mobile_app/providers/locale_provider.dart';
import 'package:aeroschool_guardian_mobile_app/screens/home/family_calendar_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Campus life (GA-17..22)', () {
    final data = CampusData.fromJson({
      'hifz': {
        'parasDone': 7,
        'logs': [
          {
            'logDate': '2026-11-20',
            'sabakPara': 8,
            'mistakes': 1,
            'tajweedRating': 5,
          },
        ],
      },
      'salah': [
        {'attendanceDate': '2026-11-20', 'wakt': 'Fajr', 'status': 'Jamaat'},
        {'attendanceDate': '2026-11-20', 'wakt': 'Dhuhr', 'status': 'Alone'},
        {'attendanceDate': '2026-11-20', 'wakt': 'Asr', 'status': 'Missed'},
      ],
      'library': [
        {
          'title': 'Book A',
          'status': 'Issued',
          'dueDate': '2026-11-01',
          'fine': '20',
        },
        {
          'title': 'Book B',
          'status': 'Returned',
          'dueDate': '2026-10-01',
          'returnDate': '2026-09-30',
        },
      ],
      'hostel': {'building': 'North', 'roomNo': '101', 'isLillah': true},
      'houses': [
        {'name': 'Red House', 'kind': 'House', 'points': 120, 'myPoints': '15'},
      ],
      'dailyLogs': [
        {'logDate': '2026-11-20', 'mood': 'Happy'},
      ],
      'clubAttendance': [
        {'sessionDate': '2026-11-18', 'status': 'Late', 'clubName': 'Debate'},
      ],
    });

    test('parses every section', () {
      expect(data.parasDone, 7);
      expect(data.hifzLogs.single.tajweedRating, 5);
      expect(data.hostel?.isLillah, isTrue);
      expect(data.houses.single.myPoints, 15);
      expect(data.clubSessions.single.status, 'Late');
      expect(data.hasMadrasa, isTrue);
      expect(data.hasCommunity, isTrue);
    });

    test('salah score counts Jamaat and alone, not missed', () {
      expect(data.salahScore, (prayed: 2, total: 3));
    });

    test('library overdue only for books still out past the due date', () {
      final today = DateTime(2026, 11, 26);
      expect(data.library[0].overdueOn(today), isTrue);
      expect(data.library[1].overdueOn(today), isFalse);
    });

    test('empty extras do not claim madrasa or community data', () {
      final empty = CampusData.fromJson({'transport': null, 'leaves': []});
      expect(empty.hasMadrasa, isFalse);
      expect(empty.hasCommunity, isFalse);
      expect(empty.hostel, isNull);
    });
  });

  test('PTM slots: own bookings are recognised', () {
    final free = PtmSlot.fromJson({
      'id': '1',
      'status': 'Available',
      'startTime': '10:00',
      'endTime': '10:15',
    });
    final mine = PtmSlot.fromJson({
      'id': '2',
      'status': 'Booked',
      'guardianId': 'G1',
      'startTime': '10:15',
      'endTime': '10:30',
    });
    expect(free.available, isTrue);
    expect(free.mine, isFalse);
    expect(mine.mine, isTrue);
  });

  test('device labels from user agents', () {
    String label(String ua) =>
        DeviceSession.fromJson({'id': 'x', 'userAgent': ua}).label;
    expect(label('Dart/3.10 (dart:io)'), 'Guardian app');
    expect(
      label('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537'),
      'Chrome on Windows',
    );
    expect(
      label('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537'),
      'Chrome on Android',
    );
    expect(DeviceSession.fromJson({'id': 'x'}).label, 'Unknown device');
  });

  test(
    'online class is joinable from 15 minutes before start until the end',
    () {
      final c = OnlineClass.fromJson({
        'id': '1',
        'title': 'Maths',
        'status': 'Scheduled',
        'scheduledAt': '2026-12-01T10:00:00',
        'durationMinutes': 45,
        'meetingUrl': 'https://meet.example/x',
      });
      expect(c.joinableAt(DateTime(2026, 12, 1, 9, 40)), isFalse);
      expect(c.joinableAt(DateTime(2026, 12, 1, 9, 50)), isTrue);
      expect(c.joinableAt(DateTime(2026, 12, 1, 10, 40)), isTrue);
      expect(c.joinableAt(DateTime(2026, 12, 1, 10, 50)), isFalse);
      final noLink = OnlineClass.fromJson({'id': '2', 'status': 'Live'});
      expect(noLink.joinableAt(DateTime(2026, 12, 1)), isFalse);
    },
  );

  test('cancelled online classes are not listed', () {
    final a = AcademicsData.fromJson({
      'onlineClasses': [
        {'id': '1', 'status': 'Cancelled'},
        {'id': '2', 'status': 'Scheduled'},
      ],
    });
    expect(a.onlineClasses.map((c) => c.id), ['2']);
  });

  group('Family calendar (GA-14 / SB-05)', () {
    ChildSummary kid(String id) =>
        ChildSummary.fromJson({'id': id, 'name': 'Child $id'});
    AcademicsData academics(String examDate) => AcademicsData.fromJson({
      'examRoutine': [
        {
          'examName': 'Half Yearly',
          'subjectName': 'Maths',
          'examDate': examDate,
        },
      ],
      'homework': [
        {
          'id': 'h1',
          'title': 'Essay',
          'dueDate': '2026-12-03',
          'submissionStatus': 'Not Submitted',
        },
        {
          'id': 'h2',
          'title': 'Done one',
          'dueDate': '2026-12-03',
          'submissionStatus': 'Submitted',
        },
      ],
      'events': [
        {'title': 'Victory Day', 'type': 'Holiday', 'startDate': '2026-12-16'},
        {'title': 'Old event', 'type': 'Event', 'startDate': '2026-10-01'},
      ],
    });

    test('merges both children, keeps school events once, skips submitted homework', () {
      final items = mergeFamilyCalendar([
        (kid('A'), academics('2026-12-02')),
        (kid('B'), academics('2026-12-05')),
      ], today: DateTime(2026, 11, 26));
      expect(items.where((i) => i.kind == 'exam').length, 2);
      expect(items.where((i) => i.kind == 'homework').length, 2);
      expect(items.where((i) => i.kind == 'holiday').length, 1);
      expect(items.any((i) => i.title == 'Old event'), isFalse);
      expect(items.any((i) => i.title == 'Done one'), isFalse);
      // Sorted by date.
      for (var i = 1; i < items.length; i++) {
        expect(items[i].date.isBefore(items[i - 1].date), isFalse);
      }
      expect(items.first.child?.id, 'A');
    });

    test('drops items beyond the window', () {
      final items = mergeFamilyCalendar(
        [(kid('A'), academics('2027-06-01'))],
        today: DateTime(2026, 11, 26),
        days: 30,
      );
      expect(items.any((i) => i.kind == 'exam'), isFalse);
      expect(items.any((i) => i.title == 'Victory Day'), isTrue);
    });
  });

  group('App lock (GA-23 / NF-44)', () {
    test('only 4-digit PINs are valid', () {
      expect(AppLockProvider.isValidPin('1234'), isTrue);
      expect(AppLockProvider.isValidPin('123'), isFalse);
      expect(AppLockProvider.isValidPin('12a4'), isFalse);
    });

    test('hash is salted and deterministic', () {
      expect(
        AppLockProvider.hashPin('1234', 's1'),
        AppLockProvider.hashPin('1234', 's1'),
      );
      expect(
        AppLockProvider.hashPin('1234', 's1'),
        isNot(AppLockProvider.hashPin('1234', 's2')),
      );
      expect(AppLockProvider.hashPin('1234', 's1'), isNot(contains('1234')));
    });

    test('set, verify, wrong attempts and disable', () async {
      final lock = AppLockProvider();
      expect(lock.enabled, isFalse);
      await lock.setPin('4321');
      expect(lock.enabled, isTrue);
      expect(lock.locked, isFalse);
      expect(lock.verify('4321'), isTrue);
      expect(lock.verify('0000'), isFalse);
      // Coming back after the timeout locks the app.
      lock.didChangeAppLifecycleState(AppLifecycleState.paused);
      final away = AppLockProvider(timeout: Duration.zero);
      await away.setPin('1111');
      away.didChangeAppLifecycleState(AppLifecycleState.paused);
      away.didChangeAppLifecycleState(AppLifecycleState.resumed);
      expect(away.locked, isTrue);
      expect(away.unlock('2222'), isFalse);
      expect(away.failedAttempts, 1);
      expect(away.unlock('1111'), isTrue);
      expect(away.locked, isFalse);
      await away.disable();
      expect(away.enabled, isFalse);
    });
  });

  test('Bangla is the default language until the guardian picks one', () async {
    SharedPreferences.setMockInitialValues({});
    final p = LocaleProvider();
    expect(p.locale, const Locale('bn'));
    await p.load();
    expect(p.locale, const Locale('bn'));
    SharedPreferences.setMockInitialValues({'aeroschool.locale': 'en'});
    final chosen = LocaleProvider();
    await chosen.load();
    expect(chosen.locale, const Locale('en'));
  });
}
