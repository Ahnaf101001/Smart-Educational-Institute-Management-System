// ignore_for_file: deprecated_member_use

// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Bengali Bangla (`bn`).
class AppLocalizationsBn extends AppLocalizations {
  AppLocalizationsBn([String locale = 'bn']) : super(locale);

  @override
  String get appTitle => 'অ্যারোস্কুল অভিভাবক মোবাইল অ্যাপ';

  @override
  String get language => 'ভাষা';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageBangla => 'বাংলা';

  @override
  String get tryAgain => 'আবার চেষ্টা করুন';

  @override
  String get edit => 'সম্পাদনা';

  @override
  String get viewAll => 'সব দেখুন';

  @override
  String get cancel => 'বাতিল';

  @override
  String get navHome => 'হোম';

  @override
  String get navMyChild => 'আমার সন্তান';

  @override
  String get navAlerts => 'বিজ্ঞপ্তি';

  @override
  String get navProfile => 'প্রোফাইল';

  @override
  String get loginSchoolFallback => 'আপনার স্কুল';

  @override
  String get loginBrand => 'অ্যারোস্কুল • অভিভাবক অ্যাপ';

  @override
  String get loginEmail => 'ইমেইল ঠিকানা';

  @override
  String get loginPassword => 'পাসওয়ার্ড';

  @override
  String get loginRemember => 'আমাকে মনে রাখুন';

  @override
  String get loginForgot => 'পাসওয়ার্ড ভুলে গেছেন?';

  @override
  String get loginButton => 'লগইন';

  @override
  String get loginContactSchool => 'স্কুলে যোগাযোগ করুন';

  @override
  String get loginNoSignup =>
      'অভিভাবক অ্যাকাউন্ট স্কুল তৈরি করে দেয়।\nএই অ্যাপ থেকে নিবন্ধন করা যায় না।';

  @override
  String get loginEnterEmail => 'আপনার লগইন ইমেইল লিখুন।';

  @override
  String get loginInvalidEmail => 'সঠিক ইমেইল ঠিকানা লিখুন।';

  @override
  String get loginEnterPassword => 'আপনার পাসওয়ার্ড লিখুন।';

  @override
  String get dashTitle => 'অভিভাবক ড্যাশবোর্ড';

  @override
  String get greetMorning => 'শুভ সকাল';

  @override
  String get greetAfternoon => 'শুভ অপরাহ্ন';

  @override
  String get greetEvening => 'শুভ সন্ধ্যা';

  @override
  String get statTotalChildren => 'মোট সন্তান';

  @override
  String get statPresentToday => 'আজ উপস্থিত';

  @override
  String get statTotalDue => 'মোট বকেয়া';

  @override
  String get statPendingHomework => 'বাকি হোমওয়ার্ক';

  @override
  String absentCount(int count) {
    return '$count জন অনুপস্থিত';
  }

  @override
  String myChildren(int count) {
    return 'আমার সন্তান ($count)';
  }

  @override
  String get noLinkedStudents => 'কোনো শিক্ষার্থী যুক্ত নেই';

  @override
  String get noLinkedStudentsHint =>
      'আপনার সন্তানদের এই অ্যাকাউন্টে যুক্ত করতে স্কুলে যোগাযোগ করুন।';

  @override
  String get childWiseAttendance => 'সন্তানভিত্তিক উপস্থিতি';

  @override
  String get thisMonth => 'এই মাস';

  @override
  String get todaysRoutine => 'আজকের ক্লাস রুটিন';

  @override
  String get monthlyFeeSummary => 'মাসিক ফি সারাংশ';

  @override
  String get upcomingExams => 'আসন্ন পরীক্ষা';

  @override
  String get noUpcomingExams => 'কোনো আসন্ন পরীক্ষা নেই';

  @override
  String get recentNotices => 'সাম্প্রতিক স্কুল নোটিশ';

  @override
  String get noNotices => 'এখনো কোনো নোটিশ নেই';

  @override
  String get importantNotifications => 'গুরুত্বপূর্ণ বিজ্ঞপ্তি';

  @override
  String get noNotifications => 'কোনো বিজ্ঞপ্তি নেই';

  @override
  String get notMarked => 'হাজিরা হয়নি';

  @override
  String get studentDashboard => 'শিক্ষার্থী ড্যাশবোর্ড';

  @override
  String selectedStudentDashboard(String name) {
    return '$name — নির্বাচিত শিক্ষার্থীর ড্যাশবোর্ড';
  }

  @override
  String get selectYourChild => 'আপনার সন্তান নির্বাচন করুন';

  @override
  String get myChildrenTitle => 'আমার সন্তানেরা';

  @override
  String get attendance => 'উপস্থিতি';

  @override
  String get monthlyAttendance => 'মাসিক উপস্থিতি';

  @override
  String get feeDue => 'বকেয়া ফি';

  @override
  String get outstandingAmount => 'বকেয়া পরিমাণ';

  @override
  String get homework => 'হোমওয়ার্ক';

  @override
  String get pendingAssignments => 'বাকি অ্যাসাইনমেন্ট';

  @override
  String get latestResult => 'সর্বশেষ ফলাফল';

  @override
  String get lastPublishedResult => 'সর্বশেষ প্রকাশিত ফলাফল';

  @override
  String get today => 'আজ';

  @override
  String get notMarkedYet => 'এখনো হাজিরা হয়নি';

  @override
  String get modules => 'মডিউল';

  @override
  String get modProfile => 'প্রোফাইল';

  @override
  String get modAttendance => 'উপস্থিতি';

  @override
  String get modFees => 'ফি';

  @override
  String get modExams => 'পরীক্ষা ও ফলাফল';

  @override
  String get modHomework => 'হোমওয়ার্ক';

  @override
  String get modRoutine => 'রুটিন';

  @override
  String get modCalendar => 'ক্যালেন্ডার';

  @override
  String get modNotices => 'নোটিশ';

  @override
  String get modTransport => 'পরিবহন';

  @override
  String get modLeave => 'ছুটি';

  @override
  String get modProgress => 'অগ্রগতি প্রতিবেদন';

  @override
  String get modTeachers => 'শিক্ষক';

  @override
  String get modDocuments => 'নথিপত্র';

  @override
  String get modFeedback => 'মতামত';

  @override
  String get notificationsTitle => 'বিজ্ঞপ্তি';

  @override
  String get markAllRead => 'সব পড়া হয়েছে';

  @override
  String get teacherMessages => 'শিক্ষকের বার্তা';

  @override
  String get allChildren => 'সব সন্তান';

  @override
  String get profileTitle => 'আমার প্রোফাইল';

  @override
  String get contactInformation => 'যোগাযোগের তথ্য';

  @override
  String get otherGuardianContacts => 'অন্যান্য অভিভাবকের যোগাযোগ';

  @override
  String get schoolContact => 'স্কুলের যোগাযোগ';

  @override
  String get support => 'সহায়তা';

  @override
  String get security => 'নিরাপত্তা';

  @override
  String get leaveApplication => 'ছুটির আবেদন';

  @override
  String get complaintsFeedback => 'অভিযোগ ও মতামত';

  @override
  String get downloadDocuments => 'নথিপত্র ডাউনলোড';

  @override
  String get changePassword => 'পাসওয়ার্ড পরিবর্তন';

  @override
  String get signOutAllDevices => 'সব ডিভাইস থেকে সাইন আউট';

  @override
  String get logout => 'লগআউট';

  @override
  String get logoutTitle => 'লগআউট করবেন?';

  @override
  String get logoutAllTitle => 'সব জায়গা থেকে সাইন আউট করবেন?';

  @override
  String get logoutBody => 'আবার সাইন ইন করতে আপনার ইমেইল ও পাসওয়ার্ড লাগবে।';

  @override
  String get logoutAllBody =>
      'সব ফোন ও ব্রাউজার থেকে আপনি সাইন আউট হয়ে যাবেন।';
}
