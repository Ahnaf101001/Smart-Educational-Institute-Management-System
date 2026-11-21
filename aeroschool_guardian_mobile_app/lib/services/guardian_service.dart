import 'dart:typed_data';

import '../core/format.dart';
import '../models/academics.dart';
import '../models/family.dart';
import '../models/fees.dart';
import '../models/school.dart';
import '../models/student.dart';
import '../models/support.dart';
import 'api_client.dart';

/// Guardian portal API (`/portal/guardian/*`). The server enforces that a
/// guardian only ever receives data for students linked to their account.
class GuardianService {
  GuardianService(this._api);

  final ApiClient _api;
  static const _base = '/portal/guardian';

  String _student(String id, String part) => '$_base/students/${Uri.encodeComponent(id)}/$part';

  Future<FamilyOverview> home() async => FamilyOverview.fromJson(J.map(await _api.get('$_base/home')));

  Future<StudentProfile> studentProfile(String studentId) async => StudentProfile.fromJson(J.map(await _api.get(_student(studentId, 'profile'))));

  Future<AttendanceReport> attendance(String studentId, String month) async =>
      AttendanceReport.fromJson(J.map(await _api.get(_student(studentId, 'attendance'), query: {'month': month})));

  Future<AcademicsData> academics(String studentId) async => AcademicsData.fromJson(J.map(await _api.get(_student(studentId, 'academics'))));

  Future<({List<ExamResult> results, String? message})> results(String studentId) async {
    final env = await _api.getEnvelope(_student(studentId, 'results'));
    return (results: J.list(env.data).map(ExamResult.fromJson).toList(), message: env.message);
  }

  Future<FeeOverview> fees(String studentId) async {
    final env = await _api.getEnvelope(_student(studentId, 'fees'));
    return FeeOverview.fromJson(J.map(env.data), message: env.message);
  }

  Future<StudentExtras> extras(String studentId) async => StudentExtras.fromJson(J.map(await _api.get(_student(studentId, 'extras'))));

  Future<({List<StudentDocument> documents, List<IssuedCertificate> certificates})> documents(String studentId) async {
    final data = J.map(await _api.get(_student(studentId, 'documents')));
    return (
      documents: J.list(data['documents']).map(StudentDocument.fromJson).toList(),
      certificates: J.list(data['certificates']).map(IssuedCertificate.fromJson).toList(),
    );
  }

  Future<Uint8List> downloadDocument(String studentId, String documentId) =>
      _api.download('${_student(studentId, 'documents')}/${Uri.encodeComponent(documentId)}/file');

  Future<Receipt> receipt(String receiptNo) async => Receipt.fromJson(J.map(await _api.get('$_base/receipts/${Uri.encodeComponent(receiptNo)}')));

  /// Starts an online payment; returns the gateway checkout URL and transaction id.
  Future<({String transactionId, String paymentUrl, num amount})> startPayment(List<String> invoiceIds, String gateway) async {
    final data = J.map(await _api.post('/fees/online/initiate', body: {'invoiceIds': invoiceIds, 'gateway': gateway}));
    final txn = J.map(data['transaction']);
    return (transactionId: J.str(txn['id']), paymentUrl: J.str(data['paymentUrl']), amount: J.numOf(txn['amount']));
  }

  Future<({String status, bool posted})> paymentStatus(String transactionId) async {
    final data = J.map(await _api.get('/fees/online/${Uri.encodeComponent(transactionId)}'));
    return (status: J.str(data['status'], 'Pending'), posted: J.boolOf(data['posted']));
  }

  Future<List<AppNotification>> notifications({String? studentId}) async =>
      J.list(await _api.get('$_base/notifications', query: {'markRead': 'false', 'studentId': studentId})).map(AppNotification.fromJson).toList();

  Future<int> unreadCount() async => J.intOf(J.map(await _api.get('$_base/notifications/unread-count'))['unread']);

  Future<void> markNotificationsRead({List<String>? ids}) => _api.post('$_base/notifications/read', body: {'ids': ids});

  Future<GuardianProfile> profile() async => GuardianProfile.fromJson(J.map(await _api.get('$_base/profile')));

  Future<SchoolInfo> school() async => SchoolInfo.fromJson(J.map(await _api.get('$_base/school')));

  Future<void> updateProfile(Map<String, dynamic> changes) => _api.patch('$_base/profile', body: changes);

  Future<List<LeaveType>> leaveTypes() async => J.list(await _api.get('$_base/leave-types')).map(LeaveType.fromJson).toList();

  Future<void> applyLeave({required String studentId, String? leaveTypeId, required DateTime from, required DateTime to, required String reason}) => _api.post(
        '/leave/apply',
        body: {
          'applicantType': 'Student',
          'applicantId': studentId,
          'leaveTypeId': leaveTypeId,
          'fromDate': _date(from),
          'toDate': _date(to),
          'reason': reason,
        },
      );

  Future<List<Complaint>> complaints() async => J.list(await _api.get('$_base/complaints')).map(Complaint.fromJson).toList();

  Future<void> submitComplaint({String? studentId, required String category, required String subject, required String description}) => _api.post(
        '$_base/complaints',
        body: {'studentId': studentId, 'category': category, 'subject': subject, 'description': description},
      );

  static String _date(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
