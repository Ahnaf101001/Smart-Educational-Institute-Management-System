// Renders every screen with realistic API data on a small phone and fails on
// any exception – including RenderFlex overflows and ParentData misuse.
import 'dart:convert';

import 'package:aeroschool_guardian_mobile_app/models/child.dart';
import 'package:aeroschool_guardian_mobile_app/models/family.dart';
import 'package:aeroschool_guardian_mobile_app/models/academics.dart';
import 'package:aeroschool_guardian_mobile_app/providers/auth_provider.dart';
import 'package:aeroschool_guardian_mobile_app/providers/family_provider.dart';
import 'package:aeroschool_guardian_mobile_app/providers/notification_provider.dart';
import 'package:aeroschool_guardian_mobile_app/screens/academics/academics_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/attendance/attendance_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/auth/change_password_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/auth/forgot_password_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/auth/login_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/children/child_dashboard_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/children/student_profile_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/exams/exams_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/exams/result_detail_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/fees/fees_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/fees/receipt_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/home/family_dashboard_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/home/home_shell.dart';
import 'package:aeroschool_guardian_mobile_app/screens/notices/notice_detail_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/notifications/notifications_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/profile/edit_profile_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/profile/profile_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/support/complaint_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/support/documents_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/support/leave_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/support/teachers_screen.dart';
import 'package:aeroschool_guardian_mobile_app/screens/transport/transport_screen.dart';
import 'package:aeroschool_guardian_mobile_app/core/theme.dart';
import 'package:aeroschool_guardian_mobile_app/l10n/app_localizations.dart';
import 'package:aeroschool_guardian_mobile_app/l10n/l10n_ext.dart';
import 'package:aeroschool_guardian_mobile_app/providers/locale_provider.dart';
import 'package:aeroschool_guardian_mobile_app/services/deep_link_service.dart';
import 'package:aeroschool_guardian_mobile_app/models/support.dart';
import 'package:aeroschool_guardian_mobile_app/services/api_client.dart';
import 'package:aeroschool_guardian_mobile_app/services/file_service.dart';
import 'package:aeroschool_guardian_mobile_app/services/guardian_service.dart';
import 'package:aeroschool_guardian_mobile_app/services/receipt_pdf_service.dart';
import 'package:aeroschool_guardian_mobile_app/services/token_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

const longName = 'Mohammad Abdullah Al Mamun Chowdhury';

Map<String, dynamic> child(String id, String name, String cls) => {
  'id': id,
  'name': name,
  'className': '$cls-A',
  'section': 'A',
  'roll': '012',
  'relation': 'Father',
  'isPrimary': true,
  'canViewResults': true,
  'canViewFees': true,
  'classTeacher': 'Mst. Rokeya Sultana Khatun',
  'todayAttendance': 'Present',
  'todayInTime': '2026-11-21T02:05:00.000Z',
  'monthAttendance': {'total': 18, 'present': 17, 'absent': 1, 'late': 2},
  'monthAttendancePercentage': 94.4,
  'feeDue': '125000.00',
  'monthFee': '3500.00',
  'homeworkCount': 3,
  'nextExam': {
    'name': 'Half Yearly Examination 2026',
    'date': '2026-12-02',
    'subject': 'Higher Mathematics (Optional)',
  },
  'todayRoutine': [
    {
      'period': 'P1',
      'start': '08:00:00',
      'end': '08:45:00',
      'subject': 'Bangla First Paper',
      'teacher': 'Md. Jahangir Alam Sarkar',
      'room': '204',
    },
    {
      'period': 'B',
      'start': '10:15:00',
      'end': '10:35:00',
      'subject': 'Break',
      'isBreak': true,
    },
  ],
  'latestResult': {
    'exam': 'First Terminal Examination 2026',
    'grade': 'A+',
    'gpa': '5.00',
  },
};

final home = {
  'guardian': {
    'id': 'GDN-00005',
    'name': longName,
    'mobile': '01711000301',
    'relationDefault': 'Father',
  },
  'children': [
    child('STU-1', longName, 'Class 10'),
    child('STU-2', 'Tasnim Ahmed', 'Class 6'),
    child('STU-3', 'Ayesha Siddiqua Rahman', 'Class 2'),
  ],
  'notices': [
    {
      'id': 'N1',
      'title': 'School will remain closed tomorrow due to heavy rain warning',
      'message': 'Dear guardians, ' * 20,
      'priority': 'Urgent',
      'category': 'Emergency',
      'createdAt': '2026-11-20T10:00:00Z',
    },
    {
      'id': 'N2',
      'title': 'Annual sports day',
      'message': 'Join us.',
      'priority': 'Normal',
      'category': 'Event',
      'createdAt': '2026-11-19T10:00:00Z',
    },
  ],
  'upcomingExams': [
    {
      'examName': 'Half Yearly Examination 2026',
      'subjectName': 'Higher Mathematics (Optional)',
      'studentName': longName,
      'studentId': 'STU-1',
      'examDate': '2026-12-02',
      'startTime': '10:00',
      'room': 'Exam Hall 3',
    },
  ],
  'recentNotifications': [
    {
      'id': 1,
      'eventType': 'Absent',
      'subject': 'Absent today',
      'body': '$longName আজ স্কুলে অনুপস্থিত।',
      'studentId': 'STU-1',
      'studentName': longName,
      'createdAt': '2026-11-21T03:00:00Z',
    },
  ],
  'unreadNotifications': 12,
  'totalDue': '250000.00',
};

final routes = <String, Object?>{
  '/portal/guardian/home': home,
  '/portal/guardian/students/STU-1/profile': {
    'id': 'STU-1',
    'name': longName,
    'nameBn': 'মোহাম্মদ আব্দুল্লাহ',
    'roll': '012',
    'className': 'Class 10-A',
    'section': 'A',
    'shift': 'Morning',
    'groupName': 'Science',
    'dateOfBirth': '2010-02-25',
    'admissionDate': '2016-01-05',
    'bloodGroup': 'O+',
    'address': 'House 12, Road 5, ' * 4,
    'classTeacher': 'Mst. Rokeya Sultana Khatun',
    'classTeacherPhone': '01711111111',
    'status': 'Active',
    'sessionName': '2026',
    'emergencyContact': {
      'name': longName,
      'relation': 'Father',
      'mobile': '01711000301',
    },
    'guardians': [
      {
        'name': longName,
        'relation': 'Father',
        'mobile': '01711000301',
        'isPrimary': true,
      },
      {
        'name': 'Nasima Khatun Begum Chowdhury',
        'relation': 'Mother',
        'mobile': '01811000302',
      },
    ],
  },
  '/portal/guardian/students/STU-1/attendance': {
    'month': '2026-11',
    'records': [
      for (var d = 1; d <= 20; d++)
        {
          'attendanceDate': '2026-11-${d.toString().padLeft(2, '0')}',
          'status': d % 7 == 0 ? 'Absent' : (d % 5 == 0 ? 'Late' : 'Present'),
          'inTime': '2026-11-01T02:05:00Z',
          'outTime': '2026-11-01T08:05:00Z',
        },
    ],
    'summary': {
      'total': 20,
      'present': 18,
      'absent': 2,
      'late': 4,
      'leave': 1,
      'earlyLeave': 1,
    },
    'history': [
      {
        'month': '2026-11',
        'total': 20,
        'present': 18,
        'absent': 2,
        'late': 4,
        'percentage': 90,
      },
      {
        'month': '2026-10',
        'total': 22,
        'present': 17,
        'absent': 5,
        'late': 0,
        'percentage': 77.3,
      },
    ],
    'percentage': 90,
  },
  '/portal/guardian/students/STU-1/academics': {
    'routine': [
      for (final day in [
        'Saturday',
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
      ])
        {
          'dayOfWeek': day,
          'periodCode': 'P1',
          'startTime': '08:00:00',
          'endTime': '08:45:00',
          'subjectName': 'Information and Communication Technology',
          'teacherName': 'Md. Jahangir Alam Sarkar',
          'roomNo': 'Computer Lab 2',
        },
    ],
    'homework': [
      {
        'id': 'HW1',
        'kind': 'Assignment',
        'title': 'Write an essay on the Liberation War of Bangladesh and its significance',
        'subjectName': 'Bangladesh and Global Studies',
        'assignedDate': '2026-11-15',
        'dueDate': '2026-12-30',
        'totalMarks': '20',
        'submissionStatus': 'Not Submitted',
        'description': 'Long text ' * 30,
      },
      {
        'id': 'HW2',
        'kind': 'Class Test',
        'title': 'Class test – algebra',
        'subjectName': 'Mathematics',
        'dueDate': '2026-12-25',
        'submissionStatus': 'Not Submitted',
      },
      {
        'id': 'HW3',
        'kind': 'Homework',
        'title': 'Old homework',
        'dueDate': '2026-10-01',
        'submissionStatus': 'Reviewed',
        'submissionMarks': '9',
        'totalMarks': '10',
      },
    ],
    'examRoutine': [
      {
        'examName': 'Half Yearly Examination 2026',
        'subjectName': 'Higher Mathematics (Optional)',
        'examDate': '2026-12-02',
        'startTime': '10:00',
        'endTime': '13:00',
        'room': 'Exam Hall 3',
        'fullMarks': '100',
      },
    ],
    'events': [
      {
        'title': 'Victory Day holiday',
        'type': 'Holiday',
        'startDate': '2026-12-16',
        'endDate': '2026-12-16',
      },
      {
        'title': 'Annual cultural programme and prize giving ceremony',
        'type': 'Event',
        'startDate': '2026-12-20',
        'description': 'All guardians are invited.',
      },
    ],
  },
  '/portal/guardian/students/STU-1/results': [
    {
      'id': 'R1',
      'examName': 'First Terminal Examination 2026',
      'totalMarks': '1185',
      'maxMarks': '1300',
      'percentage': '91.15',
      'gpa': '5.00',
      'grade': 'A+',
      'status': 'Pass',
      'classPosition': 3,
      'sectionPosition': 1,
      'publishedAt': '2026-07-01T00:00:00Z',
      'teacherComment': 'Excellent work. ' * 6,
      'subjects': [
        {
          'subjectName': 'Information and Communication Technology',
          'obtained': 95,
          'fullMarks': 100,
          'grade': 'A+',
          'point': 5,
          'passed': true,
        },
        {
          'subjectName': 'Higher Mathematics',
          'obtained': 0,
          'fullMarks': 100,
          'grade': 'F',
          'point': 0,
          'passed': false,
          'absent': true,
          'isFourth': true,
        },
      ],
    },
  ],
  '/portal/guardian/students/STU-1/fees': {
    'invoices': [
      {
        'id': 'INV-1',
        'feeHead': 'Monthly Tuition Fee (Science group, Class 10)',
        'billingMonth': '2026-10-01',
        'dueDate': '2026-10-10',
        'amount': '3500',
        'discount': '500',
        'lateFine': '100',
        'paidAmount': '0',
        'status': 'Due',
        'due': '3100',
      },
      {
        'id': 'INV-2',
        'feeHead': 'Transport Fee',
        'billingMonth': '2026-11-01',
        'dueDate': '2026-12-30',
        'amount': '1500',
        'discount': '0',
        'lateFine': '0',
        'paidAmount': '0',
        'status': 'Due',
        'due': '1500',
      },
      {
        'id': 'INV-3',
        'feeHead': 'Admission Fee',
        'billingMonth': '2026-01-01',
        'amount': '10000',
        'discount': '0',
        'lateFine': '0',
        'paidAmount': '10000',
        'status': 'Paid',
        'due': '0',
      },
    ],
    'payments': [
      {
        'id': 'PAY-1',
        'receiptNo': 'RCP-2026-000123',
        'amount': '10000',
        'paymentMethod': 'Online - bkash',
        'paidAt': '2026-01-05T05:00:00Z',
        'status': 'Valid',
        'feeHead': 'Admission Fee',
      },
    ],
    'discounts': [
      {
        'discountType': 'Sibling discount',
        'mode': 'Percent',
        'value': '15',
        'reason': 'Second child at the same school',
        'feeHead': 'Monthly Tuition Fee',
      },
    ],
    'summary': {
      'totalPayable': '4600',
      'previousDue': '3100',
      'currentMonthDue': '1500',
      'totalPaid': '10000',
    },
    'gateways': {'bkash': true, 'nagad': true},
  },
  '/portal/guardian/students/STU-1/extras': {
    'transport': {
      'routeName': 'Route 7 – Mirpur to Dhanmondi via Shyamoli',
      'stopName': 'Mirpur 10 Golchattar',
      'morningDeparture': '06:45',
      'registrationNo': 'DHAKA METRO-JA-11-2233',
      'driverName': 'Md. Abdul Karim',
      'driverPhone': '01700000000',
      'location': {
        'lat': 23.8069,
        'lng': 90.3687,
        'at': '2026-11-21T02:00:00Z',
      },
    },
    'leaves': [
      {
        'id': 'LV1',
        'leaveType': 'Sick Leave',
        'status': 'Approved',
        'days': 2,
        'fromDate': '2026-11-02',
        'toDate': '2026-11-03',
        'reason': 'Fever',
        'decisionNote': 'Get well soon',
      },
    ],
    'teachers': [
      {
        'id': 'T1',
        'name': 'Mst. Rokeya Sultana Khatun',
        'designation': 'Senior Assistant Teacher',
        'phone': '01711111111',
        'subjectName': 'Bangla',
        'isClassTeacher': true,
      },
      {
        'id': 'T1',
        'name': 'Mst. Rokeya Sultana Khatun',
        'designation': 'Senior Assistant Teacher',
        'subjectName': 'English',
        'isClassTeacher': true,
      },
    ],
  },
  '/portal/guardian/students/STU-1/documents': {
    'documents': [
      {
        'id': 'D1',
        'documentType': 'Birth Certificate',
        'fileName': 'birth-certificate-scan-high-resolution.pdf',
        'mimeType': 'application/pdf',
        'sizeBytes': 1048576,
        'createdAt': '2026-01-05T00:00:00Z',
      },
    ],
    'certificates': [
      {
        'id': 'C1',
        'certificateType': 'Testimonial',
        'issuedAt': '2026-06-01T00:00:00Z',
      },
    ],
  },
  '/portal/guardian/receipts/RCP-2026-000123': {
    'receiptNo': 'RCP-2026-000123',
    'paidAt': '2026-01-05T05:00:00Z',
    'method': 'Online - bkash',
    'reference': 'TXN1735123456789',
    'status': 'Valid',
    'lines': [
      {
        'feeHead': 'Admission Fee',
        'billingMonth': '2026-01-01',
        'amount': '10000',
        'status': 'Valid',
      },
    ],
    'student': {
      'id': 'STU-1',
      'name': longName,
      'className': 'Class 10-A',
      'section': 'A',
      'roll': '012',
    },
    'institute': {
      'name': 'EduManage School & College',
      'address': '123 Education Road, Dhaka',
    },
    'total': 10000,
  },
  '/portal/guardian/notifications': [
    for (var i = 0; i < 6; i++)
      {
        'id': i,
        'eventType': [
          'Absent',
          'Result',
          'FeeReminder',
          'Homework',
          'Transport',
          'Emergency',
        ][i],
        'subject': 'Notification subject that is fairly long $i',
        'body': '$longName – details of the event ' * 2,
        'studentId': 'STU-1',
        'studentName': longName,
        'createdAt': '2026-11-21T03:00:00Z',
      },
  ],
  '/portal/guardian/notifications/unread-count': {'unread': 12},
  '/portal/guardian/profile': {
    'guardian': {
      'id': 'GDN-00005',
      'name': longName,
      'relationDefault': 'Father',
      'mobile': '01711000301',
      'altMobile': '01911000301',
      'loginEmail': 'mohammad.abdullah.chowdhury@example.com',
      'occupation': 'Senior Software Engineer',
      'address': 'House 12, Road 5, ' * 4,
      'emergencyContact': '01611000000',
      'lastLoginAt': '2026-11-21T03:00:00Z',
      'notificationPrefs': {'fee': false},
    },
    'children': [],
    'otherGuardians': [
      {
        'id': 'GDN-00006',
        'name': 'Nasima Khatun Begum Chowdhury',
        'relation': 'Mother',
        'mobile': '01811000302',
        'children': '$longName, Tasnim Ahmed, Ayesha Siddiqua Rahman',
      },
    ],
  },
  '/portal/guardian/school': {
    'name': 'EduManage School & College, Dhaka – A Very Long Institution Name',
    'address': '123 Education Road, Dhaka',
    'phone': '01700000000',
    'email': 'info@school.edu',
    'website': 'www.school.edu',
    'principalName': 'Prof. Dr. Md. Habibur Rahman',
  },
  '/public/institute': {
    'name': 'EduManage School & College',
    'phone': '01700000000',
    'email': 'info@school.edu',
  },
  '/portal/guardian/leave-types': [
    {'id': 'LT1', 'name': 'Sick Leave'},
    {'id': 'LT2', 'name': 'Family Emergency'},
  ],
  '/portal/guardian/complaints': [
    {
      'id': 'CMP1',
      'subject': 'Bus arrives late almost every morning at our stop',
      'category': 'Transport',
      'status': 'Resolved',
      'description': 'Details ' * 20,
      'response': 'We have adjusted the schedule.',
      'createdAt': '2026-11-01T00:00:00Z',
      'studentId': 'STU-1',
    },
  ],
};

http.Client fakeServer() => MockClient((request) async {
  final path = request.url.path.replaceFirst('/api/v1', '');
  if (request.method != 'GET') {
    return http.Response(
      jsonEncode({'success': true}),
      200,
      headers: {'content-type': 'application/json'},
    );
  }
  if (!routes.containsKey(path)) {
    return http.Response(
      jsonEncode({'success': false, 'message': 'Not mocked: $path'}),
      404,
    );
  }
  return http.Response.bytes(
    utf8.encode(jsonEncode({'success': true, 'data': routes[path]})),
    200,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );
});

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 5)),
    );
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<FamilyProvider> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  Locale locale = const Locale('en'),
}) async {
  tester.view.physicalSize = const Size(320, 640);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final tokens = TokenStorage();
  final api = ApiClient(tokens: tokens, client: fakeServer());
  final guardian = GuardianService(api);
  final family = FamilyProvider(guardian);
  await tester.runAsync(family.load);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        Provider<GuardianService>.value(value: guardian),
        Provider<FileService>(create: (_) => FileService()),
        Provider<ReceiptPdfService>(create: (_) => ReceiptPdfService()),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(api: api, tokens: tokens),
        ),
        ChangeNotifierProvider.value(value: family),
        ChangeNotifierProvider(create: (_) => NotificationProvider(guardian)),
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => DeepLinkService()),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: locale,
        supportedLocales: LocaleProvider.supported,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          ...GlobalMaterialLocalizations.delegates,
        ],
        home: screen,
      ),
    ),
  );
  await settle(tester);
  return family;
}

/// Scrolls every scrollable to its end so off-screen widgets are built too.
Future<void> scrollAll(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    final s = find.byType(Scrollable);
    if (s.evaluate().isEmpty) return;
    await tester.drag(s.first, const Offset(0, -600), warnIfMissed: false);
    await settle(tester);
  }
}

/// Visits each tab of a TabBar screen and scrolls it.
Future<void> visitTabs(WidgetTester tester) async {
  final tabs = find.byType(Tab);
  for (var i = 0; i < tabs.evaluate().length; i++) {
    await tester.tap(tabs.at(i));
    await settle(tester);
    await scrollAll(tester);
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  ChildSummary first() =>
      ChildSummary.fromJson(child('STU-1', longName, 'Class 10'));

  final screens = <String, Widget Function()>{
    'login': () => const LoginScreen(),
    'forgot password': () => const ForgotPasswordScreen(),
    'change password (forced)': () => const ChangePasswordScreen(forced: true),
    'home shell': () => const HomeShell(),
    'family dashboard': () =>
        FamilyDashboardScreen(onOpenChild: (_) {}, onOpenNotifications: () {}),
    'child dashboard': () => const ChildDashboardScreen(),
    'student profile': () => StudentProfileScreen(child: first()),
    'attendance': () => AttendanceScreen(child: first()),
    'transport': () => TransportScreen(child: first()),
    'notifications': () => const NotificationsScreen(),
    'profile': () => const ProfileScreen(),
    'leave': () => LeaveScreen(child: first()),
    'complaints': () => const ComplaintScreen(initialStudentId: 'STU-1'),
    'documents': () => DocumentsScreen(child: first()),
    'teachers': () => TeachersScreen(child: first()),
    'receipt': () => const ReceiptScreen(receiptNo: 'RCP-2026-000123'),
    'notice detail': () =>
        NoticeDetailScreen(notice: FamilyOverview.fromJson(home).notices.first),
    'result detail': () => ResultDetailScreen(
      child: first(),
      result: ExamResult.fromJson(
        (routes['/portal/guardian/students/STU-1/results']! as List).first
            as Map<String, dynamic>,
      ),
    ),
    'edit profile': () => EditProfileScreen(
      profile: GuardianProfile.fromJson(
        routes['/portal/guardian/profile']! as Map<String, dynamic>,
      ),
    ),
  };

  for (final entry in screens.entries) {
    testWidgets('renders ${entry.key} on a 320px phone without errors', (
      tester,
    ) async {
      await pumpScreen(tester, entry.value());
      await scrollAll(tester);
      // Any FlutterError (overflow, ParentData misuse, exceptions) fails the test automatically.
    });
  }

  for (final entry in <String, Widget Function()>{
    'academics': () => AcademicsScreen(child: first()),
    'exams': () => ExamsScreen(child: first()),
    'fees': () => FeesScreen(child: first()),
  }.entries) {
    testWidgets(
      'renders every ${entry.key} tab on a 320px phone without errors',
      (tester) async {
        await pumpScreen(tester, entry.value());
        await visitTabs(tester);
        // Any FlutterError (overflow, ParentData misuse, exceptions) fails the test automatically.
      },
    );
  }

  // Bangla UI (N2): every screen and tab renders in Bangla on a small phone
  // without overflow, and shows Bangla text instead of the English strings.
  for (final entry in screens.entries) {
    testWidgets('renders ${entry.key} in Bangla on a 320px phone', (
      tester,
    ) async {
      await pumpScreen(tester, entry.value(), locale: const Locale('bn'));
      await scrollAll(tester);
    });
  }

  for (final entry in <String, Widget Function()>{
    'academics': () => AcademicsScreen(child: first()),
    'exams': () => ExamsScreen(child: first()),
    'fees': () => FeesScreen(child: first()),
  }.entries) {
    testWidgets('renders every ${entry.key} tab in Bangla', (tester) async {
      await pumpScreen(tester, entry.value(), locale: const Locale('bn'));
      await visitTabs(tester);
    });
  }

  testWidgets('Bangla tabs and fee summary use translated labels', (
    tester,
  ) async {
    final bn = lookupAppLocalizations(const Locale('bn'));
    final vertical = find
        .byWidgetPredicate(
          (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
        )
        .first;
    await pumpScreen(
      tester,
      FeesScreen(child: first()),
      locale: const Locale('bn'),
    );
    expect(find.text(bn.duesAndPay), findsOneWidget);
    expect(find.text('Dues & Pay'), findsNothing);
    expect(find.text('Payment History'), findsNothing);

    await pumpScreen(
      tester,
      FamilyDashboardScreen(onOpenChild: (_) {}, onOpenNotifications: () {}),
      locale: const Locale('bn'),
    );
    await tester.scrollUntilVisible(
      find.text(bn.thisMonthBilled),
      200,
      scrollable: vertical,
    );
    expect(find.text(bn.totalOutstanding), findsOneWidget);
    // Several children owe fees in the fixture: each gets its own Pay button.
    for (var k = 0; k < 10 && find.text(bn.payNow2).evaluate().isEmpty; k++) {
      await tester.drag(vertical, const Offset(0, -150), warnIfMissed: false);
      await settle(tester);
    }
    expect(find.text(bn.payNow2), findsWidgets);
    expect(find.text('Total outstanding'), findsNothing);
  });

  test('data values are translated for display only', () {
    final bn = lookupAppLocalizations(const Locale('bn'));
    final en = lookupAppLocalizations(const Locale('en'));
    expect(bn.word('Present'), 'উপস্থিত');
    expect(bn.word('Monday'), 'সোমবার');
    expect(bn.word('Some unknown value'), 'Some unknown value');
    expect(en.word('Present'), 'Present');
    expect(en.dayShort('Monday'), 'Mon');
    // Network errors raised by the app itself are shown in Bangla too.
    expect(
      bn.word(
        'Cannot reach the school server. Check your internet connection and try again.',
      ),
      isNot(contains('Cannot reach')),
    );
  });
}
