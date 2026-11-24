// ignore_for_file: deprecated_member_use
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_bn.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('bn'),
    Locale('en'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'AeroSchool Guardian Mobile App'**
  String get appTitle;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageBangla.
  ///
  /// In en, this message translates to:
  /// **'বাংলা'**
  String get languageBangla;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get tryAgain;

  /// No description provided for @edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// No description provided for @viewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get viewAll;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navMyChild.
  ///
  /// In en, this message translates to:
  /// **'My Child'**
  String get navMyChild;

  /// No description provided for @navAlerts.
  ///
  /// In en, this message translates to:
  /// **'Alerts'**
  String get navAlerts;

  /// No description provided for @navProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get navProfile;

  /// No description provided for @loginSchoolFallback.
  ///
  /// In en, this message translates to:
  /// **'Your School'**
  String get loginSchoolFallback;

  /// No description provided for @loginBrand.
  ///
  /// In en, this message translates to:
  /// **'AEROSCHOOL • GUARDIAN APP'**
  String get loginBrand;

  /// No description provided for @loginEmail.
  ///
  /// In en, this message translates to:
  /// **'Email address'**
  String get loginEmail;

  /// No description provided for @loginPassword.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get loginPassword;

  /// No description provided for @loginRemember.
  ///
  /// In en, this message translates to:
  /// **'Remember me'**
  String get loginRemember;

  /// No description provided for @loginForgot.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get loginForgot;

  /// No description provided for @loginButton.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get loginButton;

  /// No description provided for @loginContactSchool.
  ///
  /// In en, this message translates to:
  /// **'Contact School'**
  String get loginContactSchool;

  /// No description provided for @loginNoSignup.
  ///
  /// In en, this message translates to:
  /// **'Guardian accounts are created by the school.\nYou cannot register from this app.'**
  String get loginNoSignup;

  /// No description provided for @loginEnterEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter your login email.'**
  String get loginEnterEmail;

  /// No description provided for @loginInvalidEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address.'**
  String get loginInvalidEmail;

  /// No description provided for @loginEnterPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter your password.'**
  String get loginEnterPassword;

  /// No description provided for @dashTitle.
  ///
  /// In en, this message translates to:
  /// **'Guardian Dashboard'**
  String get dashTitle;

  /// No description provided for @greetMorning.
  ///
  /// In en, this message translates to:
  /// **'Good morning'**
  String get greetMorning;

  /// No description provided for @greetAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Good afternoon'**
  String get greetAfternoon;

  /// No description provided for @greetEvening.
  ///
  /// In en, this message translates to:
  /// **'Good evening'**
  String get greetEvening;

  /// No description provided for @statTotalChildren.
  ///
  /// In en, this message translates to:
  /// **'Total Children'**
  String get statTotalChildren;

  /// No description provided for @statPresentToday.
  ///
  /// In en, this message translates to:
  /// **'Present Today'**
  String get statPresentToday;

  /// No description provided for @statTotalDue.
  ///
  /// In en, this message translates to:
  /// **'Total Due'**
  String get statTotalDue;

  /// No description provided for @statPendingHomework.
  ///
  /// In en, this message translates to:
  /// **'Pending Homework'**
  String get statPendingHomework;

  /// No description provided for @absentCount.
  ///
  /// In en, this message translates to:
  /// **'{count} absent'**
  String absentCount(int count);

  /// No description provided for @myChildren.
  ///
  /// In en, this message translates to:
  /// **'My Children ({count})'**
  String myChildren(int count);

  /// No description provided for @noLinkedStudents.
  ///
  /// In en, this message translates to:
  /// **'No linked students'**
  String get noLinkedStudents;

  /// No description provided for @noLinkedStudentsHint.
  ///
  /// In en, this message translates to:
  /// **'Please contact the school to link your children to this account.'**
  String get noLinkedStudentsHint;

  /// No description provided for @childWiseAttendance.
  ///
  /// In en, this message translates to:
  /// **'Child-wise Attendance'**
  String get childWiseAttendance;

  /// No description provided for @thisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get thisMonth;

  /// No description provided for @todaysRoutine.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Class Routine'**
  String get todaysRoutine;

  /// No description provided for @monthlyFeeSummary.
  ///
  /// In en, this message translates to:
  /// **'Monthly Fee Summary'**
  String get monthlyFeeSummary;

  /// No description provided for @upcomingExams.
  ///
  /// In en, this message translates to:
  /// **'Upcoming Exams'**
  String get upcomingExams;

  /// No description provided for @noUpcomingExams.
  ///
  /// In en, this message translates to:
  /// **'No upcoming exams'**
  String get noUpcomingExams;

  /// No description provided for @recentNotices.
  ///
  /// In en, this message translates to:
  /// **'Recent School Notices'**
  String get recentNotices;

  /// No description provided for @noNotices.
  ///
  /// In en, this message translates to:
  /// **'No notices yet'**
  String get noNotices;

  /// No description provided for @importantNotifications.
  ///
  /// In en, this message translates to:
  /// **'Important Notifications'**
  String get importantNotifications;

  /// No description provided for @noNotifications.
  ///
  /// In en, this message translates to:
  /// **'No notifications'**
  String get noNotifications;

  /// No description provided for @notMarked.
  ///
  /// In en, this message translates to:
  /// **'Not marked'**
  String get notMarked;

  /// No description provided for @studentDashboard.
  ///
  /// In en, this message translates to:
  /// **'Student Dashboard'**
  String get studentDashboard;

  /// No description provided for @selectedStudentDashboard.
  ///
  /// In en, this message translates to:
  /// **'{name} — Selected Student Dashboard'**
  String selectedStudentDashboard(String name);

  /// No description provided for @selectYourChild.
  ///
  /// In en, this message translates to:
  /// **'SELECT YOUR CHILD'**
  String get selectYourChild;

  /// No description provided for @myChildrenTitle.
  ///
  /// In en, this message translates to:
  /// **'My Children'**
  String get myChildrenTitle;

  /// No description provided for @attendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get attendance;

  /// No description provided for @monthlyAttendance.
  ///
  /// In en, this message translates to:
  /// **'Monthly attendance'**
  String get monthlyAttendance;

  /// No description provided for @feeDue.
  ///
  /// In en, this message translates to:
  /// **'Fee Due'**
  String get feeDue;

  /// No description provided for @outstandingAmount.
  ///
  /// In en, this message translates to:
  /// **'Outstanding amount'**
  String get outstandingAmount;

  /// No description provided for @homework.
  ///
  /// In en, this message translates to:
  /// **'Homework'**
  String get homework;

  /// No description provided for @pendingAssignments.
  ///
  /// In en, this message translates to:
  /// **'Pending assignments'**
  String get pendingAssignments;

  /// No description provided for @latestResult.
  ///
  /// In en, this message translates to:
  /// **'Latest Result'**
  String get latestResult;

  /// No description provided for @lastPublishedResult.
  ///
  /// In en, this message translates to:
  /// **'Last published result'**
  String get lastPublishedResult;

  /// No description provided for @today.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get today;

  /// No description provided for @notMarkedYet.
  ///
  /// In en, this message translates to:
  /// **'Not marked yet'**
  String get notMarkedYet;

  /// No description provided for @modules.
  ///
  /// In en, this message translates to:
  /// **'Modules'**
  String get modules;

  /// No description provided for @modProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get modProfile;

  /// No description provided for @modAttendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get modAttendance;

  /// No description provided for @modFees.
  ///
  /// In en, this message translates to:
  /// **'Fees'**
  String get modFees;

  /// No description provided for @modExams.
  ///
  /// In en, this message translates to:
  /// **'Exam & Results'**
  String get modExams;

  /// No description provided for @modHomework.
  ///
  /// In en, this message translates to:
  /// **'Homework'**
  String get modHomework;

  /// No description provided for @modRoutine.
  ///
  /// In en, this message translates to:
  /// **'Routine'**
  String get modRoutine;

  /// No description provided for @modCalendar.
  ///
  /// In en, this message translates to:
  /// **'Calendar'**
  String get modCalendar;

  /// No description provided for @modNotices.
  ///
  /// In en, this message translates to:
  /// **'Notices'**
  String get modNotices;

  /// No description provided for @modTransport.
  ///
  /// In en, this message translates to:
  /// **'Transport'**
  String get modTransport;

  /// No description provided for @modLeave.
  ///
  /// In en, this message translates to:
  /// **'Leave'**
  String get modLeave;

  /// No description provided for @modProgress.
  ///
  /// In en, this message translates to:
  /// **'Progress Report'**
  String get modProgress;

  /// No description provided for @modTeachers.
  ///
  /// In en, this message translates to:
  /// **'Teachers'**
  String get modTeachers;

  /// No description provided for @modDocuments.
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get modDocuments;

  /// No description provided for @modFeedback.
  ///
  /// In en, this message translates to:
  /// **'Feedback'**
  String get modFeedback;

  /// No description provided for @notificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notificationsTitle;

  /// No description provided for @markAllRead.
  ///
  /// In en, this message translates to:
  /// **'Mark all read'**
  String get markAllRead;

  /// No description provided for @teacherMessages.
  ///
  /// In en, this message translates to:
  /// **'Teacher messages'**
  String get teacherMessages;

  /// No description provided for @allChildren.
  ///
  /// In en, this message translates to:
  /// **'All children'**
  String get allChildren;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'My Profile'**
  String get profileTitle;

  /// No description provided for @contactInformation.
  ///
  /// In en, this message translates to:
  /// **'Contact Information'**
  String get contactInformation;

  /// No description provided for @otherGuardianContacts.
  ///
  /// In en, this message translates to:
  /// **'Other Guardian Contacts'**
  String get otherGuardianContacts;

  /// No description provided for @schoolContact.
  ///
  /// In en, this message translates to:
  /// **'School Contact'**
  String get schoolContact;

  /// No description provided for @support.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get support;

  /// No description provided for @security.
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get security;

  /// No description provided for @leaveApplication.
  ///
  /// In en, this message translates to:
  /// **'Leave application'**
  String get leaveApplication;

  /// No description provided for @complaintsFeedback.
  ///
  /// In en, this message translates to:
  /// **'Complaints & feedback'**
  String get complaintsFeedback;

  /// No description provided for @downloadDocuments.
  ///
  /// In en, this message translates to:
  /// **'Download documents'**
  String get downloadDocuments;

  /// No description provided for @changePassword.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get changePassword;

  /// No description provided for @signOutAllDevices.
  ///
  /// In en, this message translates to:
  /// **'Sign out of all devices'**
  String get signOutAllDevices;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @logoutTitle.
  ///
  /// In en, this message translates to:
  /// **'Logout?'**
  String get logoutTitle;

  /// No description provided for @logoutAllTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign out everywhere?'**
  String get logoutAllTitle;

  /// No description provided for @logoutBody.
  ///
  /// In en, this message translates to:
  /// **'You will need your email and password to sign in again.'**
  String get logoutBody;

  /// No description provided for @logoutAllBody.
  ///
  /// In en, this message translates to:
  /// **'You will be signed out on every phone and browser.'**
  String get logoutAllBody;

  /// No description provided for @payNow.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount} now'**
  String payNow(String amount);

  /// No description provided for @entryAt.
  ///
  /// In en, this message translates to:
  /// **'Entry {time}'**
  String entryAt(String time);

  /// No description provided for @exitAt.
  ///
  /// In en, this message translates to:
  /// **'Exit {time}'**
  String exitAt(String time);

  /// No description provided for @nextExam.
  ///
  /// In en, this message translates to:
  /// **'Next exam: {subject} – {exam}'**
  String nextExam(String subject, String exam);

  /// No description provided for @classTeacherName.
  ///
  /// In en, this message translates to:
  /// **'Class teacher: {name}'**
  String classTeacherName(String name);

  /// No description provided for @daily.
  ///
  /// In en, this message translates to:
  /// **'Daily'**
  String get daily;

  /// No description provided for @bySubject.
  ///
  /// In en, this message translates to:
  /// **'By subject'**
  String get bySubject;

  /// No description provided for @classRoutineNotPublishedYet.
  ///
  /// In en, this message translates to:
  /// **'Class routine not published yet'**
  String get classRoutineNotPublishedYet;

  /// No description provided for @upcomingClassTests.
  ///
  /// In en, this message translates to:
  /// **'Upcoming Class Tests'**
  String get upcomingClassTests;

  /// No description provided for @type.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get type;

  /// No description provided for @subject.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get subject;

  /// No description provided for @assigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned'**
  String get assigned;

  /// No description provided for @dueDate.
  ///
  /// In en, this message translates to:
  /// **'Due date'**
  String get dueDate;

  /// No description provided for @submission.
  ///
  /// In en, this message translates to:
  /// **'Submission'**
  String get submission;

  /// No description provided for @submittedOn.
  ///
  /// In en, this message translates to:
  /// **'Submitted on'**
  String get submittedOn;

  /// No description provided for @marks.
  ///
  /// In en, this message translates to:
  /// **'Marks'**
  String get marks;

  /// No description provided for @teacherRemarks.
  ///
  /// In en, this message translates to:
  /// **'Teacher remarks'**
  String get teacherRemarks;

  /// No description provided for @assignmentDetails.
  ///
  /// In en, this message translates to:
  /// **'Assignment details'**
  String get assignmentDetails;

  /// No description provided for @openAttachment.
  ///
  /// In en, this message translates to:
  /// **'Open attachment'**
  String get openAttachment;

  /// No description provided for @holidays.
  ///
  /// In en, this message translates to:
  /// **'Holidays'**
  String get holidays;

  /// No description provided for @noUpcomingHolidays.
  ///
  /// In en, this message translates to:
  /// **'No upcoming holidays'**
  String get noUpcomingHolidays;

  /// No description provided for @academicCalendar.
  ///
  /// In en, this message translates to:
  /// **'Academic Calendar'**
  String get academicCalendar;

  /// No description provided for @noUpcomingEvents.
  ///
  /// In en, this message translates to:
  /// **'No upcoming events'**
  String get noUpcomingEvents;

  /// No description provided for @monthlyCalendar.
  ///
  /// In en, this message translates to:
  /// **'Monthly Calendar'**
  String get monthlyCalendar;

  /// No description provided for @dailyAttendance.
  ///
  /// In en, this message translates to:
  /// **'Daily Attendance'**
  String get dailyAttendance;

  /// No description provided for @noAttendanceRecordedThisMonth.
  ///
  /// In en, this message translates to:
  /// **'No attendance recorded this month'**
  String get noAttendanceRecordedThisMonth;

  /// No description provided for @attendanceHistory.
  ///
  /// In en, this message translates to:
  /// **'Attendance History'**
  String get attendanceHistory;

  /// No description provided for @noHistoryYet.
  ///
  /// In en, this message translates to:
  /// **'No history yet'**
  String get noHistoryYet;

  /// No description provided for @attendancePercentage.
  ///
  /// In en, this message translates to:
  /// **'Attendance percentage'**
  String get attendancePercentage;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @youSignedInWithA.
  ///
  /// In en, this message translates to:
  /// **'You signed in with a temporary password from the school. Please set your own password to continue to your dashboard.'**
  String get youSignedInWithA;

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get newPassword;

  /// No description provided for @atLeast8CharactersWith.
  ///
  /// In en, this message translates to:
  /// **'At least 8 characters with letters and numbers'**
  String get atLeast8CharactersWith;

  /// No description provided for @confirmNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm new password'**
  String get confirmNewPassword;

  /// No description provided for @forgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot password'**
  String get forgotPassword;

  /// No description provided for @openTheLinkInThe.
  ///
  /// In en, this message translates to:
  /// **'Open the link in the email, set a new password, then sign in here.'**
  String get openTheLinkInThe;

  /// No description provided for @backToLogin.
  ///
  /// In en, this message translates to:
  /// **'Back to login'**
  String get backToLogin;

  /// No description provided for @enterYourLoginEmailWe.
  ///
  /// In en, this message translates to:
  /// **'Enter your login email. We will send you a secure link to reset your password.'**
  String get enterYourLoginEmailWe;

  /// No description provided for @loginEmail2.
  ///
  /// In en, this message translates to:
  /// **'Login email'**
  String get loginEmail2;

  /// No description provided for @sendResetLink.
  ///
  /// In en, this message translates to:
  /// **'Send reset link'**
  String get sendResetLink;

  /// No description provided for @guardianAccountsAreCreatedBy.
  ///
  /// In en, this message translates to:
  /// **'Guardian accounts are created by the school. Contact the office for login details or if your account is inactive.'**
  String get guardianAccountsAreCreatedBy;

  /// No description provided for @pleaseVisitTheSchoolOffice.
  ///
  /// In en, this message translates to:
  /// **'Please visit the school office.'**
  String get pleaseVisitTheSchoolOffice;

  /// No description provided for @contactSchool.
  ///
  /// In en, this message translates to:
  /// **'Contact school'**
  String get contactSchool;

  /// No description provided for @resetPassword.
  ///
  /// In en, this message translates to:
  /// **'Reset password'**
  String get resetPassword;

  /// No description provided for @yourPasswordHasBeenChanged.
  ///
  /// In en, this message translates to:
  /// **'Your password has been changed.'**
  String get yourPasswordHasBeenChanged;

  /// No description provided for @signInWithYourNew.
  ///
  /// In en, this message translates to:
  /// **'Sign in with your new password.'**
  String get signInWithYourNew;

  /// No description provided for @goToLogin.
  ///
  /// In en, this message translates to:
  /// **'Go to login'**
  String get goToLogin;

  /// No description provided for @chooseANewPasswordFor.
  ///
  /// In en, this message translates to:
  /// **'Choose a new password for your guardian account.'**
  String get chooseANewPasswordFor;

  /// No description provided for @saveNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Save new password'**
  String get saveNewPassword;

  /// No description provided for @guardianMobileApp.
  ///
  /// In en, this message translates to:
  /// **'Guardian Mobile App'**
  String get guardianMobileApp;

  /// No description provided for @askTheSchoolOfficeTo.
  ///
  /// In en, this message translates to:
  /// **'Ask the school office to link your children to this account.'**
  String get askTheSchoolOfficeTo;

  /// No description provided for @academic.
  ///
  /// In en, this message translates to:
  /// **'Academic'**
  String get academic;

  /// No description provided for @classLabel.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get classLabel;

  /// No description provided for @section.
  ///
  /// In en, this message translates to:
  /// **'Section'**
  String get section;

  /// No description provided for @shift.
  ///
  /// In en, this message translates to:
  /// **'Shift'**
  String get shift;

  /// No description provided for @group.
  ///
  /// In en, this message translates to:
  /// **'Group'**
  String get group;

  /// No description provided for @version.
  ///
  /// In en, this message translates to:
  /// **'Version'**
  String get version;

  /// No description provided for @session.
  ///
  /// In en, this message translates to:
  /// **'Session'**
  String get session;

  /// No description provided for @admissionInformation.
  ///
  /// In en, this message translates to:
  /// **'Admission Information'**
  String get admissionInformation;

  /// No description provided for @admissionDate.
  ///
  /// In en, this message translates to:
  /// **'Admission date'**
  String get admissionDate;

  /// No description provided for @previousSchool.
  ///
  /// In en, this message translates to:
  /// **'Previous school'**
  String get previousSchool;

  /// No description provided for @personal.
  ///
  /// In en, this message translates to:
  /// **'Personal'**
  String get personal;

  /// No description provided for @dateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get dateOfBirth;

  /// No description provided for @gender.
  ///
  /// In en, this message translates to:
  /// **'Gender'**
  String get gender;

  /// No description provided for @bloodGroup.
  ///
  /// In en, this message translates to:
  /// **'Blood group'**
  String get bloodGroup;

  /// No description provided for @religion.
  ///
  /// In en, this message translates to:
  /// **'Religion'**
  String get religion;

  /// No description provided for @nationality.
  ///
  /// In en, this message translates to:
  /// **'Nationality'**
  String get nationality;

  /// No description provided for @address.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get address;

  /// No description provided for @allergies.
  ///
  /// In en, this message translates to:
  /// **'Allergies'**
  String get allergies;

  /// No description provided for @medicalNotes.
  ///
  /// In en, this message translates to:
  /// **'Medical notes'**
  String get medicalNotes;

  /// No description provided for @assignedClassTeacher.
  ///
  /// In en, this message translates to:
  /// **'Assigned Class Teacher'**
  String get assignedClassTeacher;

  /// No description provided for @notAssignedYet.
  ///
  /// In en, this message translates to:
  /// **'Not assigned yet'**
  String get notAssignedYet;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// No description provided for @phone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get phone;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @emergencyContact.
  ///
  /// In en, this message translates to:
  /// **'Emergency Contact'**
  String get emergencyContact;

  /// No description provided for @mobile.
  ///
  /// In en, this message translates to:
  /// **'Mobile'**
  String get mobile;

  /// No description provided for @noUpcomingExamsScheduled.
  ///
  /// In en, this message translates to:
  /// **'No upcoming exams scheduled'**
  String get noUpcomingExamsScheduled;

  /// No description provided for @noResultsPublishedYet.
  ///
  /// In en, this message translates to:
  /// **'No results published yet'**
  String get noResultsPublishedYet;

  /// No description provided for @downloadProgressReportPdf.
  ///
  /// In en, this message translates to:
  /// **'Download progress report (PDF)'**
  String get downloadProgressReportPdf;

  /// No description provided for @progressReportAppearsAfterThe.
  ///
  /// In en, this message translates to:
  /// **'Progress report appears after the first published result'**
  String get progressReportAppearsAfterThe;

  /// No description provided for @examWiseProgress.
  ///
  /// In en, this message translates to:
  /// **'Exam-wise progress'**
  String get examWiseProgress;

  /// No description provided for @subjectWiseAverage.
  ///
  /// In en, this message translates to:
  /// **'Subject-wise average'**
  String get subjectWiseAverage;

  /// No description provided for @downloadMarksheet.
  ///
  /// In en, this message translates to:
  /// **'Download marksheet'**
  String get downloadMarksheet;

  /// No description provided for @grade.
  ///
  /// In en, this message translates to:
  /// **'Grade'**
  String get grade;

  /// No description provided for @percentage.
  ///
  /// In en, this message translates to:
  /// **'Percentage'**
  String get percentage;

  /// No description provided for @position.
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get position;

  /// No description provided for @subjectWiseMarks.
  ///
  /// In en, this message translates to:
  /// **'Subject-wise Marks'**
  String get subjectWiseMarks;

  /// No description provided for @summary.
  ///
  /// In en, this message translates to:
  /// **'Summary'**
  String get summary;

  /// No description provided for @totalMarks.
  ///
  /// In en, this message translates to:
  /// **'Total marks'**
  String get totalMarks;

  /// No description provided for @failedSubjects.
  ///
  /// In en, this message translates to:
  /// **'Failed subjects'**
  String get failedSubjects;

  /// No description provided for @sectionPosition.
  ///
  /// In en, this message translates to:
  /// **'Section position'**
  String get sectionPosition;

  /// No description provided for @published.
  ///
  /// In en, this message translates to:
  /// **'Published'**
  String get published;

  /// No description provided for @teacherComment.
  ///
  /// In en, this message translates to:
  /// **'Teacher comment'**
  String get teacherComment;

  /// No description provided for @downloadMarksheetPdf.
  ///
  /// In en, this message translates to:
  /// **'Download marksheet (PDF)'**
  String get downloadMarksheetPdf;

  /// No description provided for @choosePaymentMethod.
  ///
  /// In en, this message translates to:
  /// **'Choose payment method'**
  String get choosePaymentMethod;

  /// No description provided for @totalPayable.
  ///
  /// In en, this message translates to:
  /// **'Total Payable'**
  String get totalPayable;

  /// No description provided for @previousDue.
  ///
  /// In en, this message translates to:
  /// **'Previous Due'**
  String get previousDue;

  /// No description provided for @thisMonth2.
  ///
  /// In en, this message translates to:
  /// **'This Month'**
  String get thisMonth2;

  /// No description provided for @totalPaid.
  ///
  /// In en, this message translates to:
  /// **'Total Paid'**
  String get totalPaid;

  /// No description provided for @feeReminderSomeFeesAre.
  ///
  /// In en, this message translates to:
  /// **'Fee reminder: some fees are past their due date. Please pay to avoid late fines.'**
  String get feeReminderSomeFeesAre;

  /// No description provided for @dueByFeeType.
  ///
  /// In en, this message translates to:
  /// **'Due by Fee Type'**
  String get dueByFeeType;

  /// No description provided for @allFeesArePaid.
  ///
  /// In en, this message translates to:
  /// **'All fees are paid'**
  String get allFeesArePaid;

  /// No description provided for @thankYou.
  ///
  /// In en, this message translates to:
  /// **'Thank you!'**
  String get thankYou;

  /// No description provided for @overdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get overdue;

  /// No description provided for @discountScholarship.
  ///
  /// In en, this message translates to:
  /// **'Discount / Scholarship'**
  String get discountScholarship;

  /// No description provided for @payNow2.
  ///
  /// In en, this message translates to:
  /// **'Pay Now'**
  String get payNow2;

  /// No description provided for @completeYourPayment.
  ///
  /// In en, this message translates to:
  /// **'Complete your payment'**
  String get completeYourPayment;

  /// No description provided for @finishThePaymentOnThe.
  ///
  /// In en, this message translates to:
  /// **'Finish the payment on the gateway page. The app confirms it automatically when you return.'**
  String get finishThePaymentOnThe;

  /// No description provided for @waitingForConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Waiting for confirmation…'**
  String get waitingForConfirmation;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status: '**
  String get status;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @paymentsReceipts.
  ///
  /// In en, this message translates to:
  /// **'Payments & Receipts'**
  String get paymentsReceipts;

  /// No description provided for @noPaymentsYet.
  ///
  /// In en, this message translates to:
  /// **'No payments yet'**
  String get noPaymentsYet;

  /// No description provided for @paidFees.
  ///
  /// In en, this message translates to:
  /// **'Paid Fees'**
  String get paidFees;

  /// No description provided for @receiptNo.
  ///
  /// In en, this message translates to:
  /// **'Receipt no.'**
  String get receiptNo;

  /// No description provided for @date.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get date;

  /// No description provided for @student.
  ///
  /// In en, this message translates to:
  /// **'Student'**
  String get student;

  /// No description provided for @method.
  ///
  /// In en, this message translates to:
  /// **'Method'**
  String get method;

  /// No description provided for @reference.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get reference;

  /// No description provided for @totalPaid2.
  ///
  /// In en, this message translates to:
  /// **'Total paid'**
  String get totalPaid2;

  /// No description provided for @downloadReceiptPdf.
  ///
  /// In en, this message translates to:
  /// **'Download receipt (PDF)'**
  String get downloadReceiptPdf;

  /// No description provided for @schoolNotice.
  ///
  /// In en, this message translates to:
  /// **'School Notice'**
  String get schoolNotice;

  /// No description provided for @important.
  ///
  /// In en, this message translates to:
  /// **'Important'**
  String get important;

  /// No description provided for @attendanceExamFeeAndSchool.
  ///
  /// In en, this message translates to:
  /// **'Attendance, exam, fee and school alerts will appear here.'**
  String get attendanceExamFeeAndSchool;

  /// No description provided for @editProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get editProfile;

  /// No description provided for @alternateMobile.
  ///
  /// In en, this message translates to:
  /// **'Alternate mobile'**
  String get alternateMobile;

  /// No description provided for @occupation.
  ///
  /// In en, this message translates to:
  /// **'Occupation'**
  String get occupation;

  /// No description provided for @emergencyContact2.
  ///
  /// In en, this message translates to:
  /// **'Emergency contact'**
  String get emergencyContact2;

  /// No description provided for @notificationPreferences.
  ///
  /// In en, this message translates to:
  /// **'Notification preferences'**
  String get notificationPreferences;

  /// No description provided for @turningATypeOffStops.
  ///
  /// In en, this message translates to:
  /// **'Turning a type off stops its SMS and email copies. Every alert still appears in the app, and emergency messages are always sent.'**
  String get turningATypeOffStops;

  /// No description provided for @saveChanges.
  ///
  /// In en, this message translates to:
  /// **'Save changes'**
  String get saveChanges;

  /// No description provided for @registeredMobile.
  ///
  /// In en, this message translates to:
  /// **'Registered mobile'**
  String get registeredMobile;

  /// No description provided for @loginEmailAndRegisteredMobile.
  ///
  /// In en, this message translates to:
  /// **'Login email and registered mobile can only be changed by the school office.'**
  String get loginEmailAndRegisteredMobile;

  /// No description provided for @noOtherGuardiansAreLinked.
  ///
  /// In en, this message translates to:
  /// **'No other guardians are linked to your children.'**
  String get noOtherGuardiansAreLinked;

  /// No description provided for @toAddAGuardianOr.
  ///
  /// In en, this message translates to:
  /// **'To add a guardian or change their details, contact the school office.'**
  String get toAddAGuardianOr;

  /// No description provided for @school.
  ///
  /// In en, this message translates to:
  /// **'School'**
  String get school;

  /// No description provided for @website.
  ///
  /// In en, this message translates to:
  /// **'Website'**
  String get website;

  /// No description provided for @emergency.
  ///
  /// In en, this message translates to:
  /// **'Emergency'**
  String get emergency;

  /// No description provided for @complaintsFeedback2.
  ///
  /// In en, this message translates to:
  /// **'Complaints & Feedback'**
  String get complaintsFeedback2;

  /// No description provided for @newLabel.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get newLabel;

  /// No description provided for @nothingSubmittedYet.
  ///
  /// In en, this message translates to:
  /// **'Nothing submitted yet'**
  String get nothingSubmittedYet;

  /// No description provided for @sendAComplaintOrFeedback.
  ///
  /// In en, this message translates to:
  /// **'Send a complaint or feedback to the school with the New button.'**
  String get sendAComplaintOrFeedback;

  /// No description provided for @complaint.
  ///
  /// In en, this message translates to:
  /// **'Complaint'**
  String get complaint;

  /// No description provided for @about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// No description provided for @generalNotAboutOneChild.
  ///
  /// In en, this message translates to:
  /// **'General (not about one child)'**
  String get generalNotAboutOneChild;

  /// No description provided for @category.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get category;

  /// No description provided for @details.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get details;

  /// No description provided for @studentDocuments.
  ///
  /// In en, this message translates to:
  /// **'Student Documents'**
  String get studentDocuments;

  /// No description provided for @noDocumentsSharedYet.
  ///
  /// In en, this message translates to:
  /// **'No documents shared yet'**
  String get noDocumentsSharedYet;

  /// No description provided for @issuedCertificates.
  ///
  /// In en, this message translates to:
  /// **'Issued Certificates'**
  String get issuedCertificates;

  /// No description provided for @noCertificatesIssued.
  ///
  /// In en, this message translates to:
  /// **'No certificates issued'**
  String get noCertificatesIssued;

  /// No description provided for @otherDownloads.
  ///
  /// In en, this message translates to:
  /// **'Other downloads'**
  String get otherDownloads;

  /// No description provided for @feeReceipts.
  ///
  /// In en, this message translates to:
  /// **'Fee receipts'**
  String get feeReceipts;

  /// No description provided for @downloadFromFeesPaymentHistory.
  ///
  /// In en, this message translates to:
  /// **'Download from Fees → Payment History'**
  String get downloadFromFeesPaymentHistory;

  /// No description provided for @leaveHistory.
  ///
  /// In en, this message translates to:
  /// **'Leave History'**
  String get leaveHistory;

  /// No description provided for @noLeaveApplicationsYet.
  ///
  /// In en, this message translates to:
  /// **'No leave applications yet'**
  String get noLeaveApplicationsYet;

  /// No description provided for @newLeaveApplication.
  ///
  /// In en, this message translates to:
  /// **'New Leave Application'**
  String get newLeaveApplication;

  /// No description provided for @leaveType.
  ///
  /// In en, this message translates to:
  /// **'Leave type'**
  String get leaveType;

  /// No description provided for @reason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get reason;

  /// No description provided for @submitApplication.
  ///
  /// In en, this message translates to:
  /// **'Submit application'**
  String get submitApplication;

  /// No description provided for @teacherMessages2.
  ///
  /// In en, this message translates to:
  /// **'Teacher Messages'**
  String get teacherMessages2;

  /// No description provided for @noMessagesYet.
  ///
  /// In en, this message translates to:
  /// **'No messages yet'**
  String get noMessagesYet;

  /// No description provided for @openAChildTeachersAnd.
  ///
  /// In en, this message translates to:
  /// **'Open a child → Teachers and tap \"Message\" to contact a teacher.'**
  String get openAChildTeachersAnd;

  /// No description provided for @startTheConversation.
  ///
  /// In en, this message translates to:
  /// **'Start the conversation'**
  String get startTheConversation;

  /// No description provided for @messagesAreDeliveredToThe.
  ///
  /// In en, this message translates to:
  /// **'Messages are delivered to the teacher during school hours.'**
  String get messagesAreDeliveredToThe;

  /// No description provided for @writeAMessage.
  ///
  /// In en, this message translates to:
  /// **'Write a message…'**
  String get writeAMessage;

  /// No description provided for @teachersNotAssignedYet.
  ///
  /// In en, this message translates to:
  /// **'Teachers not assigned yet'**
  String get teachersNotAssignedYet;

  /// No description provided for @classTeacher2.
  ///
  /// In en, this message translates to:
  /// **'Class teacher'**
  String get classTeacher2;

  /// No description provided for @message.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get message;

  /// No description provided for @call.
  ///
  /// In en, this message translates to:
  /// **'Call'**
  String get call;

  /// No description provided for @noSchoolTransportAssigned.
  ///
  /// In en, this message translates to:
  /// **'No school transport assigned'**
  String get noSchoolTransportAssigned;

  /// No description provided for @contactTheSchoolOfficeTo.
  ///
  /// In en, this message translates to:
  /// **'Contact the school office to request a bus seat.'**
  String get contactTheSchoolOfficeTo;

  /// No description provided for @assignedBus.
  ///
  /// In en, this message translates to:
  /// **'Assigned Bus'**
  String get assignedBus;

  /// No description provided for @busVehicle.
  ///
  /// In en, this message translates to:
  /// **'Bus / vehicle'**
  String get busVehicle;

  /// No description provided for @route.
  ///
  /// In en, this message translates to:
  /// **'Route'**
  String get route;

  /// No description provided for @pickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Pickup location'**
  String get pickupLocation;

  /// No description provided for @dropOffLocation.
  ///
  /// In en, this message translates to:
  /// **'Drop-off location'**
  String get dropOffLocation;

  /// No description provided for @transportSchedule.
  ///
  /// In en, this message translates to:
  /// **'Transport Schedule'**
  String get transportSchedule;

  /// No description provided for @morningDeparture.
  ///
  /// In en, this message translates to:
  /// **'Morning departure'**
  String get morningDeparture;

  /// No description provided for @eveningDeparture.
  ///
  /// In en, this message translates to:
  /// **'Evening departure'**
  String get eveningDeparture;

  /// No description provided for @busDriver.
  ///
  /// In en, this message translates to:
  /// **'Bus Driver'**
  String get busDriver;

  /// No description provided for @youGetANotificationWhen.
  ///
  /// In en, this message translates to:
  /// **'You get a notification when the bus reaches your stop (when the bus has GPS or the transport desk confirms arrival).'**
  String get youGetANotificationWhen;

  /// No description provided for @liveBusLocation.
  ///
  /// In en, this message translates to:
  /// **'Live Bus Location'**
  String get liveBusLocation;

  /// No description provided for @refreshLocation.
  ///
  /// In en, this message translates to:
  /// **'Refresh location'**
  String get refreshLocation;

  /// No description provided for @gpsTrackingIsNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'GPS tracking is not available for this bus yet.'**
  String get gpsTrackingIsNotAvailable;

  /// No description provided for @openInMaps.
  ///
  /// In en, this message translates to:
  /// **'Open in Maps'**
  String get openInMaps;

  /// No description provided for @mapUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Map unavailable'**
  String get mapUnavailable;

  /// No description provided for @somethingWentWrongPleaseTry.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get somethingWentWrongPleaseTry;

  /// No description provided for @titleForChild.
  ///
  /// In en, this message translates to:
  /// **'{screen} – {name}'**
  String titleForChild(String screen, String name);

  /// No description provided for @noClassesOnDay.
  ///
  /// In en, this message translates to:
  /// **'No classes on {day}'**
  String noClassesOnDay(String day);

  /// No description provided for @noFilterHomework.
  ///
  /// In en, this message translates to:
  /// **'No {filter} homework'**
  String noFilterHomework(String filter);

  /// No description provided for @amountLabel.
  ///
  /// In en, this message translates to:
  /// **'Amount: {amount}'**
  String amountLabel(String amount);

  /// No description provided for @receiptTitle.
  ///
  /// In en, this message translates to:
  /// **'Receipt {number}'**
  String receiptTitle(String number);

  /// No description provided for @onBehalfOf.
  ///
  /// In en, this message translates to:
  /// **'On behalf of {name}'**
  String onBehalfOf(String name);

  /// No description provided for @schoolResponse.
  ///
  /// In en, this message translates to:
  /// **'School response: {response}'**
  String schoolResponse(String response);

  /// No description provided for @sendKind.
  ///
  /// In en, this message translates to:
  /// **'Send {kind}'**
  String sendKind(String kind);

  /// No description provided for @dateFrom.
  ///
  /// In en, this message translates to:
  /// **'From {date}'**
  String dateFrom(String date);

  /// No description provided for @dateTo.
  ///
  /// In en, this message translates to:
  /// **'To {date}'**
  String dateTo(String date);

  /// No description provided for @everyday.
  ///
  /// In en, this message translates to:
  /// **'Everyday'**
  String get everyday;

  /// No description provided for @more.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get more;

  /// No description provided for @academicsTitle.
  ///
  /// In en, this message translates to:
  /// **'Academics'**
  String get academicsTitle;

  /// No description provided for @examsTitle.
  ///
  /// In en, this message translates to:
  /// **'Exams'**
  String get examsTitle;

  /// No description provided for @roomNo.
  ///
  /// In en, this message translates to:
  /// **'Room {room}'**
  String roomNo(String room);

  /// No description provided for @teacherLabel.
  ///
  /// In en, this message translates to:
  /// **'Teacher: {name}'**
  String teacherLabel(String name);

  /// No description provided for @homeworkAssignmentsCount.
  ///
  /// In en, this message translates to:
  /// **'Homework & Assignments ({count})'**
  String homeworkAssignmentsCount(String count);

  /// No description provided for @dueOn.
  ///
  /// In en, this message translates to:
  /// **'Due {date}'**
  String dueOn(String date);

  /// No description provided for @marksOf.
  ///
  /// In en, this message translates to:
  /// **'Marks: {got}/{total}'**
  String marksOf(String got, String total);

  /// No description provided for @passwordChangedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Password changed successfully.'**
  String get passwordChangedSuccessfully;

  /// No description provided for @setANewPassword.
  ///
  /// In en, this message translates to:
  /// **'Set a new password'**
  String get setANewPassword;

  /// No description provided for @welcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome!'**
  String get welcome;

  /// No description provided for @welcomeUser.
  ///
  /// In en, this message translates to:
  /// **'Welcome, {name}!'**
  String welcomeUser(String name);

  /// No description provided for @temporaryPassword.
  ///
  /// In en, this message translates to:
  /// **'Temporary password'**
  String get temporaryPassword;

  /// No description provided for @currentPassword.
  ///
  /// In en, this message translates to:
  /// **'Current password'**
  String get currentPassword;

  /// No description provided for @enterCurrentPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter your current password.'**
  String get enterCurrentPassword;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get passwordsDoNotMatch;

  /// No description provided for @saveAndContinue.
  ///
  /// In en, this message translates to:
  /// **'Save and continue'**
  String get saveAndContinue;

  /// No description provided for @showPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get hidePassword;

  /// No description provided for @couldNotLoadChildren.
  ///
  /// In en, this message translates to:
  /// **'Could not load your children.'**
  String get couldNotLoadChildren;

  /// No description provided for @rollNo.
  ///
  /// In en, this message translates to:
  /// **'Roll {roll}'**
  String rollNo(String roll);

  /// No description provided for @sectionName.
  ///
  /// In en, this message translates to:
  /// **'Section {section}'**
  String sectionName(String section);

  /// No description provided for @scheduleTab.
  ///
  /// In en, this message translates to:
  /// **'Schedule'**
  String get scheduleTab;

  /// No description provided for @resultsTab.
  ///
  /// In en, this message translates to:
  /// **'Results'**
  String get resultsTab;

  /// No description provided for @progressTab.
  ///
  /// In en, this message translates to:
  /// **'Progress'**
  String get progressTab;

  /// No description provided for @publishedOn.
  ///
  /// In en, this message translates to:
  /// **'Published {date}'**
  String publishedOn(String date);

  /// No description provided for @couldNotCreateProgressReport.
  ///
  /// In en, this message translates to:
  /// **'Could not create the progress report.'**
  String get couldNotCreateProgressReport;

  /// No description provided for @couldNotCreateMarksheet.
  ///
  /// In en, this message translates to:
  /// **'Could not create the marksheet PDF.'**
  String get couldNotCreateMarksheet;

  /// No description provided for @fourthSubject.
  ///
  /// In en, this message translates to:
  /// **' (4th subject)'**
  String get fourthSubject;

  /// No description provided for @pointValue.
  ///
  /// In en, this message translates to:
  /// **' • Point {point}'**
  String pointValue(String point);

  /// No description provided for @duesAndPay.
  ///
  /// In en, this message translates to:
  /// **'Dues & Pay'**
  String get duesAndPay;

  /// No description provided for @paymentHistory.
  ///
  /// In en, this message translates to:
  /// **'Payment History'**
  String get paymentHistory;

  /// No description provided for @feeInfoNotShared.
  ///
  /// In en, this message translates to:
  /// **'Fee information is not shared with your account.'**
  String get feeInfoNotShared;

  /// No description provided for @onlinePaymentNotEnabled.
  ///
  /// In en, this message translates to:
  /// **'Online payment is not enabled by the school yet. Please pay at the school office.'**
  String get onlinePaymentNotEnabled;

  /// No description provided for @couldNotOpenPaymentPage.
  ///
  /// In en, this message translates to:
  /// **'Could not open the payment page.'**
  String get couldNotOpenPaymentPage;

  /// No description provided for @paymentSuccessful.
  ///
  /// In en, this message translates to:
  /// **'Payment successful. Your receipt is in Payment History.'**
  String get paymentSuccessful;

  /// No description provided for @unpaidFeesCount.
  ///
  /// In en, this message translates to:
  /// **'Unpaid Fees ({count})'**
  String unpaidFeesCount(String count);

  /// No description provided for @lateFine.
  ///
  /// In en, this message translates to:
  /// **'Late fine {amount}'**
  String lateFine(String amount);

  /// No description provided for @discountAmount.
  ///
  /// In en, this message translates to:
  /// **'Discount {amount}'**
  String discountAmount(String amount);

  /// No description provided for @allFees.
  ///
  /// In en, this message translates to:
  /// **'All fees'**
  String get allFees;

  /// No description provided for @stillWaiting.
  ///
  /// In en, this message translates to:
  /// **'Still waiting. Tap \"Check status\" after completing the payment.'**
  String get stillWaiting;

  /// No description provided for @gatewayFailed.
  ///
  /// In en, this message translates to:
  /// **'The gateway reported a failed payment.'**
  String get gatewayFailed;

  /// No description provided for @paymentCancelled.
  ///
  /// In en, this message translates to:
  /// **'The payment was cancelled.'**
  String get paymentCancelled;

  /// No description provided for @checking.
  ///
  /// In en, this message translates to:
  /// **'Checking…'**
  String get checking;

  /// No description provided for @checkStatus.
  ///
  /// In en, this message translates to:
  /// **'Check status'**
  String get checkStatus;

  /// No description provided for @couldNotCreateReceipt.
  ///
  /// In en, this message translates to:
  /// **'Could not create the receipt PDF.'**
  String get couldNotCreateReceipt;

  /// No description provided for @loadingFamilyOverview.
  ///
  /// In en, this message translates to:
  /// **'Loading your family overview…'**
  String get loadingFamilyOverview;

  /// No description provided for @couldNotLoadDashboard.
  ///
  /// In en, this message translates to:
  /// **'Could not load the dashboard.'**
  String get couldNotLoadDashboard;

  /// No description provided for @noRecords.
  ///
  /// In en, this message translates to:
  /// **'No records'**
  String get noRecords;

  /// No description provided for @noClassesToday.
  ///
  /// In en, this message translates to:
  /// **'No classes scheduled today'**
  String get noClassesToday;

  /// No description provided for @thisMonthBilled.
  ///
  /// In en, this message translates to:
  /// **'This month billed'**
  String get thisMonthBilled;

  /// No description provided for @totalOutstanding.
  ///
  /// In en, this message translates to:
  /// **'Total outstanding'**
  String get totalOutstanding;

  /// No description provided for @notShared.
  ///
  /// In en, this message translates to:
  /// **'Not shared'**
  String get notShared;

  /// No description provided for @amountDue.
  ///
  /// In en, this message translates to:
  /// **'{amount} due'**
  String amountDue(String amount);

  /// No description provided for @noDues.
  ///
  /// In en, this message translates to:
  /// **'No dues'**
  String get noDues;

  /// No description provided for @profileUpdated.
  ///
  /// In en, this message translates to:
  /// **'Profile updated.'**
  String get profileUpdated;

  /// No description provided for @enterValidBdMobile.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid Bangladeshi mobile number.'**
  String get enterValidBdMobile;

  /// No description provided for @childCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 child} other{{count} children}}'**
  String childCount(int count);

  /// No description provided for @lastLogin.
  ///
  /// In en, this message translates to:
  /// **'Last login {time}'**
  String lastLogin(String time);

  /// No description provided for @principal.
  ///
  /// In en, this message translates to:
  /// **'Principal'**
  String get principal;

  /// No description provided for @enterSubject.
  ///
  /// In en, this message translates to:
  /// **'Enter a subject.'**
  String get enterSubject;

  /// No description provided for @addDetails.
  ///
  /// In en, this message translates to:
  /// **'Please add some details.'**
  String get addDetails;

  /// No description provided for @downloadingFile.
  ///
  /// In en, this message translates to:
  /// **'Downloading {name}…'**
  String downloadingFile(String name);

  /// No description provided for @couldNotSaveFile.
  ///
  /// In en, this message translates to:
  /// **'Could not save the file.'**
  String get couldNotSaveFile;

  /// No description provided for @issuedCollect.
  ///
  /// In en, this message translates to:
  /// **'Issued {date} • Collect the signed copy from the school office'**
  String issuedCollect(String date);

  /// No description provided for @schoolNote.
  ///
  /// In en, this message translates to:
  /// **'School: {note}'**
  String schoolNote(String note);

  /// No description provided for @leaveSent.
  ///
  /// In en, this message translates to:
  /// **'Leave application sent to the school.'**
  String get leaveSent;

  /// No description provided for @forChild.
  ///
  /// In en, this message translates to:
  /// **'For {name} ({classLine})'**
  String forChild(String name, String classLine);

  /// No description provided for @describeReason.
  ///
  /// In en, this message translates to:
  /// **'Please describe the reason.'**
  String get describeReason;

  /// No description provided for @youPrefix.
  ///
  /// In en, this message translates to:
  /// **'You: '**
  String get youPrefix;

  /// No description provided for @aboutName.
  ///
  /// In en, this message translates to:
  /// **'About {name}'**
  String aboutName(String name);

  /// No description provided for @updatedRefresh.
  ///
  /// In en, this message translates to:
  /// **'Updated {time} • refreshes every 15 s'**
  String updatedRefresh(String time);

  /// No description provided for @speedKmh.
  ///
  /// In en, this message translates to:
  /// **'Speed: {speed} km/h'**
  String speedKmh(String speed);

  /// No description provided for @selectedCount.
  ///
  /// In en, this message translates to:
  /// **'{count} selected'**
  String selectedCount(String count);

  /// No description provided for @daysPresentOf.
  ///
  /// In en, this message translates to:
  /// **'{present}/{total} days • {percent}'**
  String daysPresentOf(String present, String total, String percent);

  /// No description provided for @tomorrow.
  ///
  /// In en, this message translates to:
  /// **'Tomorrow'**
  String get tomorrow;

  /// No description provided for @daysCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 day} other{{count} days}}'**
  String daysCount(int count);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['bn', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'bn':
      return AppLocalizationsBn();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
