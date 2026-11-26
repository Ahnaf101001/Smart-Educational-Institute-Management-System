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

  @override
  String payNow(String amount) {
    return '$amount এখনই পরিশোধ করুন';
  }

  @override
  String entryAt(String time) {
    return 'প্রবেশ $time';
  }

  @override
  String exitAt(String time) {
    return 'বের হওয়া $time';
  }

  @override
  String nextExam(String subject, String exam) {
    return 'পরবর্তী পরীক্ষা: $subject – $exam';
  }

  @override
  String classTeacherName(String name) {
    return 'শ্রেণি শিক্ষক: $name';
  }

  @override
  String get daily => 'দৈনিক';

  @override
  String get bySubject => 'বিষয়ভিত্তিক';

  @override
  String get classRoutineNotPublishedYet => 'ক্লাস রুটিন এখনো প্রকাশিত হয়নি';

  @override
  String get upcomingClassTests => 'আসন্ন ক্লাস টেস্ট';

  @override
  String get type => 'ধরন';

  @override
  String get subject => 'বিষয়';

  @override
  String get assigned => 'দেওয়া হয়েছে';

  @override
  String get dueDate => 'জমার তারিখ';

  @override
  String get submission => 'জমা';

  @override
  String get submittedOn => 'জমা দেওয়ার তারিখ';

  @override
  String get marks => 'নম্বর';

  @override
  String get teacherRemarks => 'শিক্ষকের মন্তব্য';

  @override
  String get assignmentDetails => 'অ্যাসাইনমেন্টের বিবরণ';

  @override
  String get openAttachment => 'সংযুক্তি খুলুন';

  @override
  String get holidays => 'ছুটি';

  @override
  String get noUpcomingHolidays => 'সামনে কোনো ছুটি নেই';

  @override
  String get academicCalendar => 'একাডেমিক ক্যালেন্ডার';

  @override
  String get noUpcomingEvents => 'সামনে কোনো অনুষ্ঠান নেই';

  @override
  String get monthlyCalendar => 'মাসিক ক্যালেন্ডার';

  @override
  String get dailyAttendance => 'দৈনিক উপস্থিতি';

  @override
  String get noAttendanceRecordedThisMonth =>
      'এই মাসে কোনো উপস্থিতি রেকর্ড হয়নি';

  @override
  String get attendanceHistory => 'উপস্থিতির ইতিহাস';

  @override
  String get noHistoryYet => 'এখনো কোনো ইতিহাস নেই';

  @override
  String get attendancePercentage => 'উপস্থিতির হার';

  @override
  String get signOut => 'সাইন আউট';

  @override
  String get youSignedInWithA =>
      'আপনি স্কুলের দেওয়া অস্থায়ী পাসওয়ার্ড দিয়ে প্রবেশ করেছেন। ড্যাশবোর্ডে যেতে নিজের একটি পাসওয়ার্ড সেট করুন।';

  @override
  String get newPassword => 'নতুন পাসওয়ার্ড';

  @override
  String get atLeast8CharactersWith => 'অক্ষর ও সংখ্যা মিলিয়ে কমপক্ষে ৮ অক্ষর';

  @override
  String get confirmNewPassword => 'নতুন পাসওয়ার্ড নিশ্চিত করুন';

  @override
  String get forgotPassword => 'পাসওয়ার্ড ভুলে গেছেন';

  @override
  String get openTheLinkInThe =>
      'ইমেইলের লিংকটি খুলুন, নতুন পাসওয়ার্ড সেট করুন, তারপর এখানে প্রবেশ করুন।';

  @override
  String get backToLogin => 'লগইনে ফিরে যান';

  @override
  String get enterYourLoginEmailWe =>
      'আপনার লগইন ইমেইল দিন। পাসওয়ার্ড রিসেট করার একটি নিরাপদ লিংক পাঠানো হবে।';

  @override
  String get loginEmail2 => 'লগইন ইমেইল';

  @override
  String get sendResetLink => 'রিসেট লিংক পাঠান';

  @override
  String get guardianAccountsAreCreatedBy =>
      'অভিভাবক অ্যাকাউন্ট স্কুল তৈরি করে। লগইন তথ্যের জন্য বা অ্যাকাউন্ট বন্ধ থাকলে স্কুল অফিসে যোগাযোগ করুন।';

  @override
  String get pleaseVisitTheSchoolOffice =>
      'অনুগ্রহ করে স্কুল অফিসে যোগাযোগ করুন।';

  @override
  String get contactSchool => 'স্কুলে যোগাযোগ';

  @override
  String get resetPassword => 'পাসওয়ার্ড রিসেট';

  @override
  String get yourPasswordHasBeenChanged => 'আপনার পাসওয়ার্ড পরিবর্তন হয়েছে।';

  @override
  String get signInWithYourNew => 'নতুন পাসওয়ার্ড দিয়ে প্রবেশ করুন।';

  @override
  String get goToLogin => 'লগইনে যান';

  @override
  String get chooseANewPasswordFor =>
      'আপনার অভিভাবক অ্যাকাউন্টের জন্য নতুন পাসওয়ার্ড দিন।';

  @override
  String get saveNewPassword => 'নতুন পাসওয়ার্ড সংরক্ষণ';

  @override
  String get guardianMobileApp => 'অভিভাবক মোবাইল অ্যাপ';

  @override
  String get askTheSchoolOfficeTo =>
      'আপনার সন্তানদের এই অ্যাকাউন্টে যুক্ত করতে স্কুল অফিসে বলুন।';

  @override
  String get academic => 'একাডেমিক';

  @override
  String get classLabel => 'শ্রেণি';

  @override
  String get section => 'শাখা';

  @override
  String get shift => 'শিফট';

  @override
  String get group => 'বিভাগ';

  @override
  String get version => 'ভার্সন';

  @override
  String get session => 'শিক্ষাবর্ষ';

  @override
  String get admissionInformation => 'ভর্তির তথ্য';

  @override
  String get admissionDate => 'ভর্তির তারিখ';

  @override
  String get previousSchool => 'পূর্ববর্তী স্কুল';

  @override
  String get personal => 'ব্যক্তিগত';

  @override
  String get dateOfBirth => 'জন্ম তারিখ';

  @override
  String get gender => 'লিঙ্গ';

  @override
  String get bloodGroup => 'রক্তের গ্রুপ';

  @override
  String get religion => 'ধর্ম';

  @override
  String get nationality => 'জাতীয়তা';

  @override
  String get address => 'ঠিকানা';

  @override
  String get allergies => 'অ্যালার্জি';

  @override
  String get medicalNotes => 'স্বাস্থ্য সংক্রান্ত তথ্য';

  @override
  String get assignedClassTeacher => 'শ্রেণি শিক্ষক';

  @override
  String get notAssignedYet => 'এখনো নির্ধারিত হয়নি';

  @override
  String get name => 'নাম';

  @override
  String get phone => 'ফোন';

  @override
  String get email => 'ইমেইল';

  @override
  String get emergencyContact => 'জরুরি যোগাযোগ';

  @override
  String get mobile => 'মোবাইল';

  @override
  String get noUpcomingExamsScheduled => 'সামনে কোনো পরীক্ষা নির্ধারিত নেই';

  @override
  String get noResultsPublishedYet => 'এখনো কোনো ফলাফল প্রকাশিত হয়নি';

  @override
  String get downloadProgressReportPdf => 'অগ্রগতি প্রতিবেদন ডাউনলোড (PDF)';

  @override
  String get progressReportAppearsAfterThe =>
      'প্রথম ফলাফল প্রকাশের পর অগ্রগতি প্রতিবেদন দেখা যাবে';

  @override
  String get examWiseProgress => 'পরীক্ষাভিত্তিক অগ্রগতি';

  @override
  String get subjectWiseAverage => 'বিষয়ভিত্তিক গড়';

  @override
  String get downloadMarksheet => 'মার্কশিট ডাউনলোড';

  @override
  String get grade => 'গ্রেড';

  @override
  String get percentage => 'শতকরা';

  @override
  String get position => 'মেধাক্রম';

  @override
  String get subjectWiseMarks => 'বিষয়ভিত্তিক নম্বর';

  @override
  String get summary => 'সারসংক্ষেপ';

  @override
  String get totalMarks => 'মোট নম্বর';

  @override
  String get failedSubjects => 'অকৃতকার্য বিষয়';

  @override
  String get sectionPosition => 'শাখায় মেধাক্রম';

  @override
  String get published => 'প্রকাশিত';

  @override
  String get teacherComment => 'শিক্ষকের মন্তব্য';

  @override
  String get downloadMarksheetPdf => 'মার্কশিট ডাউনলোড (PDF)';

  @override
  String get choosePaymentMethod => 'পেমেন্ট পদ্ধতি বাছাই করুন';

  @override
  String get totalPayable => 'মোট প্রদেয়';

  @override
  String get previousDue => 'পূর্বের বকেয়া';

  @override
  String get thisMonth2 => 'এই মাস';

  @override
  String get totalPaid => 'মোট পরিশোধিত';

  @override
  String get feeReminderSomeFeesAre =>
      'ফি স্মরণ: কিছু ফির শেষ তারিখ পেরিয়ে গেছে। বিলম্ব জরিমানা এড়াতে পরিশোধ করুন।';

  @override
  String get dueByFeeType => 'ফির ধরন অনুযায়ী বকেয়া';

  @override
  String get allFeesArePaid => 'সব ফি পরিশোধিত';

  @override
  String get thankYou => 'ধন্যবাদ!';

  @override
  String get overdue => 'মেয়াদোত্তীর্ণ';

  @override
  String get discountScholarship => 'ছাড় / বৃত্তি';

  @override
  String get payNow2 => 'এখনই পরিশোধ করুন';

  @override
  String get completeYourPayment => 'পেমেন্ট সম্পন্ন করুন';

  @override
  String get finishThePaymentOnThe =>
      'গেটওয়ে পেজে পেমেন্ট শেষ করুন। ফিরে এলে অ্যাপ নিজেই তা নিশ্চিত করবে।';

  @override
  String get waitingForConfirmation => 'নিশ্চিতকরণের অপেক্ষায়…';

  @override
  String get status => 'অবস্থা: ';

  @override
  String get close => 'বন্ধ করুন';

  @override
  String get paymentsReceipts => 'পেমেন্ট ও রসিদ';

  @override
  String get noPaymentsYet => 'এখনো কোনো পেমেন্ট নেই';

  @override
  String get paidFees => 'পরিশোধিত ফি';

  @override
  String get receiptNo => 'রসিদ নং';

  @override
  String get date => 'তারিখ';

  @override
  String get student => 'শিক্ষার্থী';

  @override
  String get method => 'পদ্ধতি';

  @override
  String get reference => 'রেফারেন্স';

  @override
  String get totalPaid2 => 'মোট পরিশোধ';

  @override
  String get downloadReceiptPdf => 'রসিদ ডাউনলোড (PDF)';

  @override
  String get schoolNotice => 'স্কুল নোটিশ';

  @override
  String get important => 'গুরুত্বপূর্ণ';

  @override
  String get attendanceExamFeeAndSchool =>
      'উপস্থিতি, পরীক্ষা, ফি ও স্কুলের সতর্কবার্তা এখানে দেখা যাবে।';

  @override
  String get editProfile => 'প্রোফাইল সম্পাদনা';

  @override
  String get alternateMobile => 'বিকল্প মোবাইল';

  @override
  String get occupation => 'পেশা';

  @override
  String get emergencyContact2 => 'জরুরি যোগাযোগ';

  @override
  String get notificationPreferences => 'নোটিফিকেশন পছন্দ';

  @override
  String get turningATypeOffStops =>
      'কোনো ধরন বন্ধ করলে তার এসএমএস ও ইমেইল যাবে না। সব সতর্কবার্তা অ্যাপে দেখা যাবে, আর জরুরি বার্তা সবসময় পাঠানো হবে।';

  @override
  String get saveChanges => 'পরিবর্তন সংরক্ষণ';

  @override
  String get registeredMobile => 'নিবন্ধিত মোবাইল';

  @override
  String get loginEmailAndRegisteredMobile =>
      'লগইন ইমেইল ও নিবন্ধিত মোবাইল শুধু স্কুল অফিস পরিবর্তন করতে পারে।';

  @override
  String get noOtherGuardiansAreLinked =>
      'আপনার সন্তানদের সাথে অন্য কোনো অভিভাবক যুক্ত নেই।';

  @override
  String get toAddAGuardianOr =>
      'অভিভাবক যোগ বা তথ্য পরিবর্তনের জন্য স্কুল অফিসে যোগাযোগ করুন।';

  @override
  String get school => 'স্কুল';

  @override
  String get website => 'ওয়েবসাইট';

  @override
  String get emergency => 'জরুরি';

  @override
  String get complaintsFeedback2 => 'অভিযোগ ও মতামত';

  @override
  String get newLabel => 'নতুন';

  @override
  String get nothingSubmittedYet => 'এখনো কিছু জমা দেওয়া হয়নি';

  @override
  String get sendAComplaintOrFeedback =>
      'নতুন বাটনে চাপ দিয়ে স্কুলে অভিযোগ বা মতামত পাঠান।';

  @override
  String get complaint => 'অভিযোগ';

  @override
  String get about => 'বিষয়';

  @override
  String get generalNotAboutOneChild => 'সাধারণ (নির্দিষ্ট সন্তান নয়)';

  @override
  String get category => 'শ্রেণিবিভাগ';

  @override
  String get details => 'বিস্তারিত';

  @override
  String get studentDocuments => 'শিক্ষার্থীর কাগজপত্র';

  @override
  String get noDocumentsSharedYet => 'এখনো কোনো কাগজপত্র দেওয়া হয়নি';

  @override
  String get issuedCertificates => 'ইস্যুকৃত সনদ';

  @override
  String get noCertificatesIssued => 'কোনো সনদ ইস্যু হয়নি';

  @override
  String get otherDownloads => 'অন্যান্য ডাউনলোড';

  @override
  String get feeReceipts => 'ফির রসিদ';

  @override
  String get downloadFromFeesPaymentHistory =>
      'ফি → পেমেন্ট ইতিহাস থেকে ডাউনলোড করুন';

  @override
  String get leaveHistory => 'ছুটির ইতিহাস';

  @override
  String get noLeaveApplicationsYet => 'এখনো কোনো ছুটির আবেদন নেই';

  @override
  String get newLeaveApplication => 'নতুন ছুটির আবেদন';

  @override
  String get leaveType => 'ছুটির ধরন';

  @override
  String get reason => 'কারণ';

  @override
  String get submitApplication => 'আবেদন জমা দিন';

  @override
  String get teacherMessages2 => 'শিক্ষকের বার্তা';

  @override
  String get noMessagesYet => 'এখনো কোনো বার্তা নেই';

  @override
  String get openAChildTeachersAnd =>
      'শিক্ষকের সাথে যোগাযোগ করতে সন্তান → শিক্ষক খুলে \"বার্তা\" চাপুন।';

  @override
  String get startTheConversation => 'কথোপকথন শুরু করুন';

  @override
  String get messagesAreDeliveredToThe =>
      'বার্তা স্কুল চলাকালীন সময়ে শিক্ষকের কাছে পৌঁছায়।';

  @override
  String get writeAMessage => 'বার্তা লিখুন…';

  @override
  String get teachersNotAssignedYet => 'এখনো শিক্ষক নির্ধারিত হয়নি';

  @override
  String get classTeacher2 => 'শ্রেণি শিক্ষক';

  @override
  String get message => 'বার্তা';

  @override
  String get call => 'কল';

  @override
  String get noSchoolTransportAssigned => 'কোনো স্কুল পরিবহন নির্ধারিত নেই';

  @override
  String get contactTheSchoolOfficeTo =>
      'বাসের আসনের জন্য স্কুল অফিসে যোগাযোগ করুন।';

  @override
  String get assignedBus => 'নির্ধারিত বাস';

  @override
  String get busVehicle => 'বাস / গাড়ি';

  @override
  String get route => 'রুট';

  @override
  String get pickupLocation => 'ওঠার স্থান';

  @override
  String get dropOffLocation => 'নামার স্থান';

  @override
  String get transportSchedule => 'পরিবহন সময়সূচি';

  @override
  String get morningDeparture => 'সকালের যাত্রা';

  @override
  String get eveningDeparture => 'বিকেলের যাত্রা';

  @override
  String get busDriver => 'বাস চালক';

  @override
  String get youGetANotificationWhen =>
      'বাস আপনার স্টপে পৌঁছালে নোটিফিকেশন পাবেন (বাসে জিপিএস থাকলে বা পরিবহন ডেস্ক নিশ্চিত করলে)।';

  @override
  String get liveBusLocation => 'বাসের লাইভ অবস্থান';

  @override
  String get refreshLocation => 'অবস্থান রিফ্রেশ';

  @override
  String get gpsTrackingIsNotAvailable => 'এই বাসে এখনো জিপিএস ট্র্যাকিং নেই।';

  @override
  String get openInMaps => 'ম্যাপে খুলুন';

  @override
  String get mapUnavailable => 'ম্যাপ পাওয়া যাচ্ছে না';

  @override
  String get somethingWentWrongPleaseTry =>
      'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।';

  @override
  String titleForChild(String screen, String name) {
    return '$screen – $name';
  }

  @override
  String noClassesOnDay(String day) {
    return '$day কোনো ক্লাস নেই';
  }

  @override
  String noFilterHomework(String filter) {
    return 'কোনো $filter হোমওয়ার্ক নেই';
  }

  @override
  String amountLabel(String amount) {
    return 'পরিমাণ: $amount';
  }

  @override
  String receiptTitle(String number) {
    return 'রসিদ $number';
  }

  @override
  String onBehalfOf(String name) {
    return '$name-এর পক্ষে';
  }

  @override
  String schoolResponse(String response) {
    return 'স্কুলের উত্তর: $response';
  }

  @override
  String sendKind(String kind) {
    return '$kind পাঠান';
  }

  @override
  String dateFrom(String date) {
    return 'শুরু $date';
  }

  @override
  String dateTo(String date) {
    return 'শেষ $date';
  }

  @override
  String get everyday => 'প্রতিদিন';

  @override
  String get more => 'আরও';

  @override
  String get academicsTitle => 'একাডেমিক';

  @override
  String get examsTitle => 'পরীক্ষা';

  @override
  String roomNo(String room) {
    return 'কক্ষ $room';
  }

  @override
  String teacherLabel(String name) {
    return 'শিক্ষক: $name';
  }

  @override
  String homeworkAssignmentsCount(String count) {
    return 'হোমওয়ার্ক ও অ্যাসাইনমেন্ট ($count)';
  }

  @override
  String dueOn(String date) {
    return 'শেষ তারিখ $date';
  }

  @override
  String marksOf(String got, String total) {
    return 'নম্বর: $got/$total';
  }

  @override
  String get passwordChangedSuccessfully =>
      'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।';

  @override
  String get setANewPassword => 'নতুন পাসওয়ার্ড সেট করুন';

  @override
  String get welcome => 'স্বাগতম!';

  @override
  String welcomeUser(String name) {
    return 'স্বাগতম, $name!';
  }

  @override
  String get temporaryPassword => 'অস্থায়ী পাসওয়ার্ড';

  @override
  String get currentPassword => 'বর্তমান পাসওয়ার্ড';

  @override
  String get enterCurrentPassword => 'আপনার বর্তমান পাসওয়ার্ড লিখুন।';

  @override
  String get passwordsDoNotMatch => 'পাসওয়ার্ড মেলেনি।';

  @override
  String get saveAndContinue => 'সংরক্ষণ করে এগিয়ে যান';

  @override
  String get showPassword => 'পাসওয়ার্ড দেখান';

  @override
  String get hidePassword => 'পাসওয়ার্ড লুকান';

  @override
  String get couldNotLoadChildren => 'আপনার সন্তানদের তথ্য লোড করা যায়নি।';

  @override
  String rollNo(String roll) {
    return 'রোল $roll';
  }

  @override
  String sectionName(String section) {
    return 'শাখা $section';
  }

  @override
  String get scheduleTab => 'সময়সূচি';

  @override
  String get resultsTab => 'ফলাফল';

  @override
  String get progressTab => 'অগ্রগতি';

  @override
  String publishedOn(String date) {
    return 'প্রকাশিত $date';
  }

  @override
  String get couldNotCreateProgressReport =>
      'অগ্রগতি প্রতিবেদন তৈরি করা যায়নি।';

  @override
  String get couldNotCreateMarksheet => 'মার্কশিট PDF তৈরি করা যায়নি।';

  @override
  String get fourthSubject => ' (৪র্থ বিষয়)';

  @override
  String pointValue(String point) {
    return ' • পয়েন্ট $point';
  }

  @override
  String get duesAndPay => 'বকেয়া ও পরিশোধ';

  @override
  String get paymentHistory => 'পরিশোধের ইতিহাস';

  @override
  String get feeInfoNotShared =>
      'ফি সংক্রান্ত তথ্য আপনার অ্যাকাউন্টে শেয়ার করা হয়নি।';

  @override
  String get onlinePaymentNotEnabled =>
      'স্কুল এখনও অনলাইন পেমেন্ট চালু করেনি। অনুগ্রহ করে স্কুল অফিসে পরিশোধ করুন।';

  @override
  String get couldNotOpenPaymentPage => 'পেমেন্ট পেজ খোলা যায়নি।';

  @override
  String get paymentSuccessful =>
      'পেমেন্ট সফল হয়েছে। আপনার রসিদ পরিশোধের ইতিহাসে আছে।';

  @override
  String unpaidFeesCount(String count) {
    return 'অপরিশোধিত ফি ($count)';
  }

  @override
  String lateFine(String amount) {
    return 'বিলম্ব জরিমানা $amount';
  }

  @override
  String discountAmount(String amount) {
    return 'ছাড় $amount';
  }

  @override
  String get allFees => 'সকল ফি';

  @override
  String get stillWaiting =>
      'এখনও অপেক্ষমাণ। পেমেন্ট সম্পন্ন করে \"স্ট্যাটাস দেখুন\" চাপুন।';

  @override
  String get gatewayFailed => 'গেটওয়ে পেমেন্টটি ব্যর্থ বলে জানিয়েছে।';

  @override
  String get paymentCancelled => 'পেমেন্টটি বাতিল করা হয়েছে।';

  @override
  String get checking => 'যাচাই করা হচ্ছে…';

  @override
  String get checkStatus => 'স্ট্যাটাস দেখুন';

  @override
  String get couldNotCreateReceipt => 'রসিদ PDF তৈরি করা যায়নি।';

  @override
  String get loadingFamilyOverview => 'আপনার পরিবারের তথ্য লোড হচ্ছে…';

  @override
  String get couldNotLoadDashboard => 'ড্যাশবোর্ড লোড করা যায়নি।';

  @override
  String get noRecords => 'কোনো তথ্য নেই';

  @override
  String get noClassesToday => 'আজ কোনো ক্লাস নেই';

  @override
  String get thisMonthBilled => 'এ মাসের বিল';

  @override
  String get totalOutstanding => 'মোট বকেয়া';

  @override
  String get notShared => 'শেয়ার করা হয়নি';

  @override
  String amountDue(String amount) {
    return '$amount বকেয়া';
  }

  @override
  String get noDues => 'কোনো বকেয়া নেই';

  @override
  String get profileUpdated => 'প্রোফাইল হালনাগাদ হয়েছে।';

  @override
  String get enterValidBdMobile => 'সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।';

  @override
  String childCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count সন্তান',
    );
    return '$_temp0';
  }

  @override
  String lastLogin(String time) {
    return 'সর্বশেষ লগইন $time';
  }

  @override
  String get principal => 'অধ্যক্ষ';

  @override
  String get enterSubject => 'বিষয় লিখুন।';

  @override
  String get addDetails => 'অনুগ্রহ করে কিছু বিবরণ যোগ করুন।';

  @override
  String downloadingFile(String name) {
    return '$name ডাউনলোড হচ্ছে…';
  }

  @override
  String get couldNotSaveFile => 'ফাইল সংরক্ষণ করা যায়নি।';

  @override
  String issuedCollect(String date) {
    return 'ইস্যু $date • স্বাক্ষরিত কপি স্কুল অফিস থেকে সংগ্রহ করুন';
  }

  @override
  String schoolNote(String note) {
    return 'স্কুল: $note';
  }

  @override
  String get leaveSent => 'ছুটির আবেদন স্কুলে পাঠানো হয়েছে।';

  @override
  String forChild(String name, String classLine) {
    return '$name ($classLine)-এর জন্য';
  }

  @override
  String get describeReason => 'অনুগ্রহ করে কারণ লিখুন।';

  @override
  String get youPrefix => 'আপনি: ';

  @override
  String aboutName(String name) {
    return '$name সম্পর্কে';
  }

  @override
  String updatedRefresh(String time) {
    return 'হালনাগাদ $time • প্রতি ১৫ সেকেন্ডে রিফ্রেশ হয়';
  }

  @override
  String speedKmh(String speed) {
    return 'গতি: $speed কিমি/ঘণ্টা';
  }

  @override
  String selectedCount(String count) {
    return '$countটি নির্বাচিত';
  }

  @override
  String daysPresentOf(String present, String total, String percent) {
    return '$present/$total দিন • $percent';
  }

  @override
  String get tomorrow => 'আগামীকাল';

  @override
  String daysCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count দিন',
    );
    return '$_temp0';
  }

  @override
  String get updatedFromSchool => 'স্কুল থেকে এইমাত্র হালনাগাদ হয়েছে';

  @override
  String get withdraw => 'প্রত্যাহার';

  @override
  String get respond => 'উত্তর দিন';

  @override
  String get history => 'ইতিহাস';

  @override
  String get withdrawLeaveTitle => 'এই আবেদন প্রত্যাহার করবেন?';

  @override
  String get withdrawLeaveBody => 'স্কুল আর এটি পর্যালোচনা করবে না।';

  @override
  String get leaveWithdrawn => 'আবেদন প্রত্যাহার করা হয়েছে';

  @override
  String get respondTitle => 'স্কুলকে উত্তর দিন';

  @override
  String get respondHint => 'আপনার উত্তর';

  @override
  String get responseSent => 'স্কুলে উত্তর পাঠানো হয়েছে';

  @override
  String get sendReply => 'উত্তর পাঠান';

  @override
  String clarificationNeeded(String note) {
    return 'স্কুলের প্রশ্ন: $note';
  }
}
