// ignore_for_file: deprecated_member_use

// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'AeroSchool Guardian Mobile App';

  @override
  String get language => 'Language';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageBangla => 'বাংলা';

  @override
  String get tryAgain => 'Try again';

  @override
  String get edit => 'Edit';

  @override
  String get viewAll => 'View all';

  @override
  String get cancel => 'Cancel';

  @override
  String get navHome => 'Home';

  @override
  String get navMyChild => 'My Child';

  @override
  String get navAlerts => 'Alerts';

  @override
  String get navProfile => 'Profile';

  @override
  String get loginSchoolFallback => 'Your School';

  @override
  String get loginBrand => 'AEROSCHOOL • GUARDIAN APP';

  @override
  String get loginEmail => 'Email address';

  @override
  String get loginPassword => 'Password';

  @override
  String get loginRemember => 'Remember me';

  @override
  String get loginForgot => 'Forgot password?';

  @override
  String get loginButton => 'Login';

  @override
  String get loginContactSchool => 'Contact School';

  @override
  String get loginNoSignup =>
      'Guardian accounts are created by the school.\nYou cannot register from this app.';

  @override
  String get loginEnterEmail => 'Enter your login email.';

  @override
  String get loginInvalidEmail => 'Enter a valid email address.';

  @override
  String get loginEnterPassword => 'Enter your password.';

  @override
  String get dashTitle => 'Guardian Dashboard';

  @override
  String get greetMorning => 'Good morning';

  @override
  String get greetAfternoon => 'Good afternoon';

  @override
  String get greetEvening => 'Good evening';

  @override
  String get statTotalChildren => 'Total Children';

  @override
  String get statPresentToday => 'Present Today';

  @override
  String get statTotalDue => 'Total Due';

  @override
  String get statPendingHomework => 'Pending Homework';

  @override
  String absentCount(int count) {
    return '$count absent';
  }

  @override
  String myChildren(int count) {
    return 'My Children ($count)';
  }

  @override
  String get noLinkedStudents => 'No linked students';

  @override
  String get noLinkedStudentsHint =>
      'Please contact the school to link your children to this account.';

  @override
  String get childWiseAttendance => 'Child-wise Attendance';

  @override
  String get thisMonth => 'This month';

  @override
  String get todaysRoutine => 'Today\'s Class Routine';

  @override
  String get monthlyFeeSummary => 'Monthly Fee Summary';

  @override
  String get upcomingExams => 'Upcoming Exams';

  @override
  String get noUpcomingExams => 'No upcoming exams';

  @override
  String get recentNotices => 'Recent School Notices';

  @override
  String get noNotices => 'No notices yet';

  @override
  String get importantNotifications => 'Important Notifications';

  @override
  String get noNotifications => 'No notifications';

  @override
  String get notMarked => 'Not marked';

  @override
  String get studentDashboard => 'Student Dashboard';

  @override
  String selectedStudentDashboard(String name) {
    return '$name — Selected Student Dashboard';
  }

  @override
  String get selectYourChild => 'SELECT YOUR CHILD';

  @override
  String get myChildrenTitle => 'My Children';

  @override
  String get attendance => 'Attendance';

  @override
  String get monthlyAttendance => 'Monthly attendance';

  @override
  String get feeDue => 'Fee Due';

  @override
  String get outstandingAmount => 'Outstanding amount';

  @override
  String get homework => 'Homework';

  @override
  String get pendingAssignments => 'Pending assignments';

  @override
  String get latestResult => 'Latest Result';

  @override
  String get lastPublishedResult => 'Last published result';

  @override
  String get today => 'Today';

  @override
  String get notMarkedYet => 'Not marked yet';

  @override
  String get modules => 'Modules';

  @override
  String get modProfile => 'Profile';

  @override
  String get modAttendance => 'Attendance';

  @override
  String get modFees => 'Fees';

  @override
  String get modExams => 'Exam & Results';

  @override
  String get modHomework => 'Homework';

  @override
  String get modRoutine => 'Routine';

  @override
  String get modCalendar => 'Calendar';

  @override
  String get modNotices => 'Notices';

  @override
  String get modTransport => 'Transport';

  @override
  String get modLeave => 'Leave';

  @override
  String get modProgress => 'Progress Report';

  @override
  String get modTeachers => 'Teachers';

  @override
  String get modDocuments => 'Documents';

  @override
  String get modFeedback => 'Feedback';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get markAllRead => 'Mark all read';

  @override
  String get teacherMessages => 'Teacher messages';

  @override
  String get allChildren => 'All children';

  @override
  String get profileTitle => 'My Profile';

  @override
  String get contactInformation => 'Contact Information';

  @override
  String get otherGuardianContacts => 'Other Guardian Contacts';

  @override
  String get schoolContact => 'School Contact';

  @override
  String get support => 'Support';

  @override
  String get security => 'Security';

  @override
  String get leaveApplication => 'Leave application';

  @override
  String get complaintsFeedback => 'Complaints & feedback';

  @override
  String get downloadDocuments => 'Download documents';

  @override
  String get changePassword => 'Change password';

  @override
  String get signOutAllDevices => 'Sign out of all devices';

  @override
  String get logout => 'Logout';

  @override
  String get logoutTitle => 'Logout?';

  @override
  String get logoutAllTitle => 'Sign out everywhere?';

  @override
  String get logoutBody =>
      'You will need your email and password to sign in again.';

  @override
  String get logoutAllBody =>
      'You will be signed out on every phone and browser.';
}
