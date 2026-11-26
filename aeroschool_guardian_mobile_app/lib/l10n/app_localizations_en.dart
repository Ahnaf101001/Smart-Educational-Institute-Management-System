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

  @override
  String payNow(String amount) {
    return 'Pay $amount now';
  }

  @override
  String entryAt(String time) {
    return 'Entry $time';
  }

  @override
  String exitAt(String time) {
    return 'Exit $time';
  }

  @override
  String nextExam(String subject, String exam) {
    return 'Next exam: $subject – $exam';
  }

  @override
  String classTeacherName(String name) {
    return 'Class teacher: $name';
  }

  @override
  String get daily => 'Daily';

  @override
  String get bySubject => 'By subject';

  @override
  String get classRoutineNotPublishedYet => 'Class routine not published yet';

  @override
  String get upcomingClassTests => 'Upcoming Class Tests';

  @override
  String get type => 'Type';

  @override
  String get subject => 'Subject';

  @override
  String get assigned => 'Assigned';

  @override
  String get dueDate => 'Due date';

  @override
  String get submission => 'Submission';

  @override
  String get submittedOn => 'Submitted on';

  @override
  String get marks => 'Marks';

  @override
  String get teacherRemarks => 'Teacher remarks';

  @override
  String get assignmentDetails => 'Assignment details';

  @override
  String get openAttachment => 'Open attachment';

  @override
  String get holidays => 'Holidays';

  @override
  String get noUpcomingHolidays => 'No upcoming holidays';

  @override
  String get academicCalendar => 'Academic Calendar';

  @override
  String get noUpcomingEvents => 'No upcoming events';

  @override
  String get monthlyCalendar => 'Monthly Calendar';

  @override
  String get dailyAttendance => 'Daily Attendance';

  @override
  String get noAttendanceRecordedThisMonth =>
      'No attendance recorded this month';

  @override
  String get attendanceHistory => 'Attendance History';

  @override
  String get noHistoryYet => 'No history yet';

  @override
  String get attendancePercentage => 'Attendance percentage';

  @override
  String get signOut => 'Sign out';

  @override
  String get youSignedInWithA =>
      'You signed in with a temporary password from the school. Please set your own password to continue to your dashboard.';

  @override
  String get newPassword => 'New password';

  @override
  String get atLeast8CharactersWith =>
      'At least 8 characters with letters and numbers';

  @override
  String get confirmNewPassword => 'Confirm new password';

  @override
  String get forgotPassword => 'Forgot password';

  @override
  String get openTheLinkInThe =>
      'Open the link in the email, set a new password, then sign in here.';

  @override
  String get backToLogin => 'Back to login';

  @override
  String get enterYourLoginEmailWe =>
      'Enter your login email. We will send you a secure link to reset your password.';

  @override
  String get loginEmail2 => 'Login email';

  @override
  String get sendResetLink => 'Send reset link';

  @override
  String get guardianAccountsAreCreatedBy =>
      'Guardian accounts are created by the school. Contact the office for login details or if your account is inactive.';

  @override
  String get pleaseVisitTheSchoolOffice => 'Please visit the school office.';

  @override
  String get contactSchool => 'Contact school';

  @override
  String get resetPassword => 'Reset password';

  @override
  String get yourPasswordHasBeenChanged => 'Your password has been changed.';

  @override
  String get signInWithYourNew => 'Sign in with your new password.';

  @override
  String get goToLogin => 'Go to login';

  @override
  String get chooseANewPasswordFor =>
      'Choose a new password for your guardian account.';

  @override
  String get saveNewPassword => 'Save new password';

  @override
  String get guardianMobileApp => 'Guardian Mobile App';

  @override
  String get askTheSchoolOfficeTo =>
      'Ask the school office to link your children to this account.';

  @override
  String get academic => 'Academic';

  @override
  String get classLabel => 'Class';

  @override
  String get section => 'Section';

  @override
  String get shift => 'Shift';

  @override
  String get group => 'Group';

  @override
  String get version => 'Version';

  @override
  String get session => 'Session';

  @override
  String get admissionInformation => 'Admission Information';

  @override
  String get admissionDate => 'Admission date';

  @override
  String get previousSchool => 'Previous school';

  @override
  String get personal => 'Personal';

  @override
  String get dateOfBirth => 'Date of birth';

  @override
  String get gender => 'Gender';

  @override
  String get bloodGroup => 'Blood group';

  @override
  String get religion => 'Religion';

  @override
  String get nationality => 'Nationality';

  @override
  String get address => 'Address';

  @override
  String get allergies => 'Allergies';

  @override
  String get medicalNotes => 'Medical notes';

  @override
  String get assignedClassTeacher => 'Assigned Class Teacher';

  @override
  String get notAssignedYet => 'Not assigned yet';

  @override
  String get name => 'Name';

  @override
  String get phone => 'Phone';

  @override
  String get email => 'Email';

  @override
  String get emergencyContact => 'Emergency Contact';

  @override
  String get mobile => 'Mobile';

  @override
  String get noUpcomingExamsScheduled => 'No upcoming exams scheduled';

  @override
  String get noResultsPublishedYet => 'No results published yet';

  @override
  String get downloadProgressReportPdf => 'Download progress report (PDF)';

  @override
  String get progressReportAppearsAfterThe =>
      'Progress report appears after the first published result';

  @override
  String get examWiseProgress => 'Exam-wise progress';

  @override
  String get subjectWiseAverage => 'Subject-wise average';

  @override
  String get downloadMarksheet => 'Download marksheet';

  @override
  String get grade => 'Grade';

  @override
  String get percentage => 'Percentage';

  @override
  String get position => 'Position';

  @override
  String get subjectWiseMarks => 'Subject-wise Marks';

  @override
  String get summary => 'Summary';

  @override
  String get totalMarks => 'Total marks';

  @override
  String get failedSubjects => 'Failed subjects';

  @override
  String get sectionPosition => 'Section position';

  @override
  String get published => 'Published';

  @override
  String get teacherComment => 'Teacher comment';

  @override
  String get downloadMarksheetPdf => 'Download marksheet (PDF)';

  @override
  String get choosePaymentMethod => 'Choose payment method';

  @override
  String get totalPayable => 'Total Payable';

  @override
  String get previousDue => 'Previous Due';

  @override
  String get thisMonth2 => 'This Month';

  @override
  String get totalPaid => 'Total Paid';

  @override
  String get feeReminderSomeFeesAre =>
      'Fee reminder: some fees are past their due date. Please pay to avoid late fines.';

  @override
  String get dueByFeeType => 'Due by Fee Type';

  @override
  String get allFeesArePaid => 'All fees are paid';

  @override
  String get thankYou => 'Thank you!';

  @override
  String get overdue => 'Overdue';

  @override
  String get discountScholarship => 'Discount / Scholarship';

  @override
  String get payNow2 => 'Pay Now';

  @override
  String get completeYourPayment => 'Complete your payment';

  @override
  String get finishThePaymentOnThe =>
      'Finish the payment on the gateway page. The app confirms it automatically when you return.';

  @override
  String get waitingForConfirmation => 'Waiting for confirmation…';

  @override
  String get status => 'Status: ';

  @override
  String get close => 'Close';

  @override
  String get paymentsReceipts => 'Payments & Receipts';

  @override
  String get noPaymentsYet => 'No payments yet';

  @override
  String get paidFees => 'Paid Fees';

  @override
  String get receiptNo => 'Receipt no.';

  @override
  String get date => 'Date';

  @override
  String get student => 'Student';

  @override
  String get method => 'Method';

  @override
  String get reference => 'Reference';

  @override
  String get totalPaid2 => 'Total paid';

  @override
  String get downloadReceiptPdf => 'Download receipt (PDF)';

  @override
  String get schoolNotice => 'School Notice';

  @override
  String get important => 'Important';

  @override
  String get attendanceExamFeeAndSchool =>
      'Attendance, exam, fee and school alerts will appear here.';

  @override
  String get editProfile => 'Edit profile';

  @override
  String get alternateMobile => 'Alternate mobile';

  @override
  String get occupation => 'Occupation';

  @override
  String get emergencyContact2 => 'Emergency contact';

  @override
  String get notificationPreferences => 'Notification preferences';

  @override
  String get turningATypeOffStops =>
      'Turning a type off stops its SMS and email copies. Every alert still appears in the app, and emergency messages are always sent.';

  @override
  String get saveChanges => 'Save changes';

  @override
  String get registeredMobile => 'Registered mobile';

  @override
  String get loginEmailAndRegisteredMobile =>
      'Login email and registered mobile can only be changed by the school office.';

  @override
  String get noOtherGuardiansAreLinked =>
      'No other guardians are linked to your children.';

  @override
  String get toAddAGuardianOr =>
      'To add a guardian or change their details, contact the school office.';

  @override
  String get school => 'School';

  @override
  String get website => 'Website';

  @override
  String get emergency => 'Emergency';

  @override
  String get complaintsFeedback2 => 'Complaints & Feedback';

  @override
  String get newLabel => 'New';

  @override
  String get nothingSubmittedYet => 'Nothing submitted yet';

  @override
  String get sendAComplaintOrFeedback =>
      'Send a complaint or feedback to the school with the New button.';

  @override
  String get complaint => 'Complaint';

  @override
  String get about => 'About';

  @override
  String get generalNotAboutOneChild => 'General (not about one child)';

  @override
  String get category => 'Category';

  @override
  String get details => 'Details';

  @override
  String get studentDocuments => 'Student Documents';

  @override
  String get noDocumentsSharedYet => 'No documents shared yet';

  @override
  String get issuedCertificates => 'Issued Certificates';

  @override
  String get noCertificatesIssued => 'No certificates issued';

  @override
  String get otherDownloads => 'Other downloads';

  @override
  String get feeReceipts => 'Fee receipts';

  @override
  String get downloadFromFeesPaymentHistory =>
      'Download from Fees → Payment History';

  @override
  String get leaveHistory => 'Leave History';

  @override
  String get noLeaveApplicationsYet => 'No leave applications yet';

  @override
  String get newLeaveApplication => 'New Leave Application';

  @override
  String get leaveType => 'Leave type';

  @override
  String get reason => 'Reason';

  @override
  String get submitApplication => 'Submit application';

  @override
  String get teacherMessages2 => 'Teacher Messages';

  @override
  String get noMessagesYet => 'No messages yet';

  @override
  String get openAChildTeachersAnd =>
      'Open a child → Teachers and tap \"Message\" to contact a teacher.';

  @override
  String get startTheConversation => 'Start the conversation';

  @override
  String get messagesAreDeliveredToThe =>
      'Messages are delivered to the teacher during school hours.';

  @override
  String get writeAMessage => 'Write a message…';

  @override
  String get teachersNotAssignedYet => 'Teachers not assigned yet';

  @override
  String get classTeacher2 => 'Class teacher';

  @override
  String get message => 'Message';

  @override
  String get call => 'Call';

  @override
  String get noSchoolTransportAssigned => 'No school transport assigned';

  @override
  String get contactTheSchoolOfficeTo =>
      'Contact the school office to request a bus seat.';

  @override
  String get assignedBus => 'Assigned Bus';

  @override
  String get busVehicle => 'Bus / vehicle';

  @override
  String get route => 'Route';

  @override
  String get pickupLocation => 'Pickup location';

  @override
  String get dropOffLocation => 'Drop-off location';

  @override
  String get transportSchedule => 'Transport Schedule';

  @override
  String get morningDeparture => 'Morning departure';

  @override
  String get eveningDeparture => 'Evening departure';

  @override
  String get busDriver => 'Bus Driver';

  @override
  String get youGetANotificationWhen =>
      'You get a notification when the bus reaches your stop (when the bus has GPS or the transport desk confirms arrival).';

  @override
  String get liveBusLocation => 'Live Bus Location';

  @override
  String get refreshLocation => 'Refresh location';

  @override
  String get gpsTrackingIsNotAvailable =>
      'GPS tracking is not available for this bus yet.';

  @override
  String get openInMaps => 'Open in Maps';

  @override
  String get mapUnavailable => 'Map unavailable';

  @override
  String get somethingWentWrongPleaseTry =>
      'Something went wrong. Please try again.';

  @override
  String titleForChild(String screen, String name) {
    return '$screen – $name';
  }

  @override
  String noClassesOnDay(String day) {
    return 'No classes on $day';
  }

  @override
  String noFilterHomework(String filter) {
    return 'No $filter homework';
  }

  @override
  String amountLabel(String amount) {
    return 'Amount: $amount';
  }

  @override
  String receiptTitle(String number) {
    return 'Receipt $number';
  }

  @override
  String onBehalfOf(String name) {
    return 'On behalf of $name';
  }

  @override
  String schoolResponse(String response) {
    return 'School response: $response';
  }

  @override
  String sendKind(String kind) {
    return 'Send $kind';
  }

  @override
  String dateFrom(String date) {
    return 'From $date';
  }

  @override
  String dateTo(String date) {
    return 'To $date';
  }

  @override
  String get everyday => 'Everyday';

  @override
  String get more => 'More';

  @override
  String get academicsTitle => 'Academics';

  @override
  String get examsTitle => 'Exams';

  @override
  String roomNo(String room) {
    return 'Room $room';
  }

  @override
  String teacherLabel(String name) {
    return 'Teacher: $name';
  }

  @override
  String homeworkAssignmentsCount(String count) {
    return 'Homework & Assignments ($count)';
  }

  @override
  String dueOn(String date) {
    return 'Due $date';
  }

  @override
  String marksOf(String got, String total) {
    return 'Marks: $got/$total';
  }

  @override
  String get passwordChangedSuccessfully => 'Password changed successfully.';

  @override
  String get setANewPassword => 'Set a new password';

  @override
  String get welcome => 'Welcome!';

  @override
  String welcomeUser(String name) {
    return 'Welcome, $name!';
  }

  @override
  String get temporaryPassword => 'Temporary password';

  @override
  String get currentPassword => 'Current password';

  @override
  String get enterCurrentPassword => 'Enter your current password.';

  @override
  String get passwordsDoNotMatch => 'Passwords do not match.';

  @override
  String get saveAndContinue => 'Save and continue';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get couldNotLoadChildren => 'Could not load your children.';

  @override
  String rollNo(String roll) {
    return 'Roll $roll';
  }

  @override
  String sectionName(String section) {
    return 'Section $section';
  }

  @override
  String get scheduleTab => 'Schedule';

  @override
  String get resultsTab => 'Results';

  @override
  String get progressTab => 'Progress';

  @override
  String publishedOn(String date) {
    return 'Published $date';
  }

  @override
  String get couldNotCreateProgressReport =>
      'Could not create the progress report.';

  @override
  String get couldNotCreateMarksheet => 'Could not create the marksheet PDF.';

  @override
  String get fourthSubject => ' (4th subject)';

  @override
  String pointValue(String point) {
    return ' • Point $point';
  }

  @override
  String get duesAndPay => 'Dues & Pay';

  @override
  String get paymentHistory => 'Payment History';

  @override
  String get feeInfoNotShared =>
      'Fee information is not shared with your account.';

  @override
  String get onlinePaymentNotEnabled =>
      'Online payment is not enabled by the school yet. Please pay at the school office.';

  @override
  String get couldNotOpenPaymentPage => 'Could not open the payment page.';

  @override
  String get paymentSuccessful =>
      'Payment successful. Your receipt is in Payment History.';

  @override
  String unpaidFeesCount(String count) {
    return 'Unpaid Fees ($count)';
  }

  @override
  String lateFine(String amount) {
    return 'Late fine $amount';
  }

  @override
  String discountAmount(String amount) {
    return 'Discount $amount';
  }

  @override
  String get allFees => 'All fees';

  @override
  String get stillWaiting =>
      'Still waiting. Tap \"Check status\" after completing the payment.';

  @override
  String get gatewayFailed => 'The gateway reported a failed payment.';

  @override
  String get paymentCancelled => 'The payment was cancelled.';

  @override
  String get checking => 'Checking…';

  @override
  String get checkStatus => 'Check status';

  @override
  String get couldNotCreateReceipt => 'Could not create the receipt PDF.';

  @override
  String get loadingFamilyOverview => 'Loading your family overview…';

  @override
  String get couldNotLoadDashboard => 'Could not load the dashboard.';

  @override
  String get noRecords => 'No records';

  @override
  String get noClassesToday => 'No classes scheduled today';

  @override
  String get thisMonthBilled => 'This month billed';

  @override
  String get totalOutstanding => 'Total outstanding';

  @override
  String get notShared => 'Not shared';

  @override
  String amountDue(String amount) {
    return '$amount due';
  }

  @override
  String get noDues => 'No dues';

  @override
  String get profileUpdated => 'Profile updated.';

  @override
  String get enterValidBdMobile => 'Enter a valid Bangladeshi mobile number.';

  @override
  String childCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count children',
      one: '1 child',
    );
    return '$_temp0';
  }

  @override
  String lastLogin(String time) {
    return 'Last login $time';
  }

  @override
  String get principal => 'Principal';

  @override
  String get enterSubject => 'Enter a subject.';

  @override
  String get addDetails => 'Please add some details.';

  @override
  String downloadingFile(String name) {
    return 'Downloading $name…';
  }

  @override
  String get couldNotSaveFile => 'Could not save the file.';

  @override
  String issuedCollect(String date) {
    return 'Issued $date • Collect the signed copy from the school office';
  }

  @override
  String schoolNote(String note) {
    return 'School: $note';
  }

  @override
  String get leaveSent => 'Leave application sent to the school.';

  @override
  String forChild(String name, String classLine) {
    return 'For $name ($classLine)';
  }

  @override
  String get describeReason => 'Please describe the reason.';

  @override
  String get youPrefix => 'You: ';

  @override
  String aboutName(String name) {
    return 'About $name';
  }

  @override
  String updatedRefresh(String time) {
    return 'Updated $time • refreshes every 15 s';
  }

  @override
  String speedKmh(String speed) {
    return 'Speed: $speed km/h';
  }

  @override
  String selectedCount(String count) {
    return '$count selected';
  }

  @override
  String daysPresentOf(String present, String total, String percent) {
    return '$present/$total days • $percent';
  }

  @override
  String get tomorrow => 'Tomorrow';

  @override
  String daysCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count days',
      one: '1 day',
    );
    return '$_temp0';
  }

  @override
  String get updatedFromSchool => 'Updated from school just now';

  @override
  String get withdraw => 'Withdraw';

  @override
  String get respond => 'Respond';

  @override
  String get history => 'History';

  @override
  String get withdrawLeaveTitle => 'Withdraw this application?';

  @override
  String get withdrawLeaveBody => 'The school will no longer review it.';

  @override
  String get leaveWithdrawn => 'Application withdrawn';

  @override
  String get respondTitle => 'Reply to the school';

  @override
  String get respondHint => 'Your answer';

  @override
  String get responseSent => 'Reply sent to the school';

  @override
  String get sendReply => 'Send reply';

  @override
  String clarificationNeeded(String note) {
    return 'School asks: $note';
  }
}
