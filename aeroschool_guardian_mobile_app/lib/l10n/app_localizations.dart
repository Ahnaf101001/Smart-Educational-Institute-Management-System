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
