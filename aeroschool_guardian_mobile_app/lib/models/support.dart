import '../core/format.dart';

class TransportInfo {
  TransportInfo({
    required this.routeName,
    this.stopName,
    this.morningDeparture,
    this.registrationNo,
    this.driverName,
    this.driverPhone,
    this.latitude,
    this.longitude,
    this.locationAt,
  });

  final String routeName;
  final String? stopName;
  final String? morningDeparture;
  final String? registrationNo;
  final String? driverName;
  final String? driverPhone;
  final double? latitude;
  final double? longitude;
  final DateTime? locationAt;

  bool get hasLocation => latitude != null && longitude != null;

  factory TransportInfo.fromJson(Map<String, dynamic> j) {
    final loc = J.map(j['location']);
    return TransportInfo(
      routeName: J.str(j['routeName'], 'Route'),
      stopName: J.strOrNull(j['stopName']),
      morningDeparture: J.strOrNull(j['morningDeparture']),
      registrationNo: J.strOrNull(j['registrationNo']),
      driverName: J.strOrNull(j['driverName']),
      driverPhone: J.strOrNull(j['driverPhone']),
      latitude: J.numOrNull(loc['lat'])?.toDouble(),
      longitude: J.numOrNull(loc['lng'])?.toDouble(),
      locationAt: J.date(loc['at']),
    );
  }
}

class LeaveRecord {
  LeaveRecord({required this.id, required this.leaveType, required this.status, required this.days, this.fromDate, this.toDate, this.reason, this.decisionNote});

  final String id;
  final String leaveType;
  final String status;
  final int days;
  final DateTime? fromDate;
  final DateTime? toDate;
  final String? reason;
  final String? decisionNote;

  factory LeaveRecord.fromJson(Map<String, dynamic> j) => LeaveRecord(
        id: J.str(j['id']),
        leaveType: J.str(j['leaveType'], 'Leave'),
        status: J.str(j['status'], 'Pending'),
        days: J.intOf(j['days'], 1),
        fromDate: J.date(j['fromDate']),
        toDate: J.date(j['toDate']),
        reason: J.strOrNull(j['reason']),
        decisionNote: J.strOrNull(j['decisionNote']),
      );
}

class TeacherInfo {
  TeacherInfo({required this.id, required this.name, this.designation, this.phone, this.subject, this.isClassTeacher = false});

  final String id;
  final String name;
  final String? designation;
  final String? phone;
  final String? subject;
  final bool isClassTeacher;

  factory TeacherInfo.fromJson(Map<String, dynamic> j) => TeacherInfo(
        id: J.str(j['id']),
        name: J.str(j['name']),
        designation: J.strOrNull(j['designation']),
        phone: J.strOrNull(j['phone']),
        subject: J.strOrNull(j['subjectName']),
        isClassTeacher: J.boolOf(j['isClassTeacher']),
      );
}

/// `/portal/guardian/students/:id/extras` (transport, leave history, teachers).
class StudentExtras {
  StudentExtras({required this.leaves, required this.teachers, this.transport});

  final TransportInfo? transport;
  final List<LeaveRecord> leaves;
  final List<TeacherInfo> teachers;

  factory StudentExtras.fromJson(Map<String, dynamic> j) {
    // Several subjects may share a teacher; merge them into one contact card.
    final byId = <String, TeacherInfo>{};
    for (final t in J.list(j['teachers']).map(TeacherInfo.fromJson)) {
      final existing = byId[t.id];
      if (existing == null) {
        byId[t.id] = t;
      } else {
        final subjects = {...?existing.subject?.split(', '), if (t.subject != null) t.subject!};
        byId[t.id] = TeacherInfo(
          id: t.id,
          name: t.name,
          designation: t.designation,
          phone: t.phone,
          subject: subjects.isEmpty ? null : subjects.join(', '),
          isClassTeacher: existing.isClassTeacher || t.isClassTeacher,
        );
      }
    }
    final teachers = byId.values.toList()..sort((a, b) => (b.isClassTeacher ? 1 : 0) - (a.isClassTeacher ? 1 : 0));
    return StudentExtras(
      transport: j['transport'] is Map ? TransportInfo.fromJson(J.map(j['transport'])) : null,
      leaves: J.list(j['leaves']).map(LeaveRecord.fromJson).toList(),
      teachers: teachers,
    );
  }
}

class LeaveType {
  LeaveType({required this.id, required this.name});

  final String id;
  final String name;

  factory LeaveType.fromJson(Map<String, dynamic> j) => LeaveType(id: J.str(j['id']), name: J.str(j['name']));
}

class Complaint {
  Complaint({required this.id, required this.subject, required this.category, required this.status, this.description, this.response, this.createdAt, this.studentId});

  final String id;
  final String subject;
  final String category;
  final String status;
  final String? description;
  final String? response;
  final DateTime? createdAt;
  final String? studentId;

  factory Complaint.fromJson(Map<String, dynamic> j) => Complaint(
        id: J.str(j['id']),
        subject: J.str(j['subject']),
        category: J.str(j['category'], 'General'),
        status: J.str(j['status'], 'Open'),
        description: J.strOrNull(j['description']),
        response: J.strOrNull(j['response']),
        createdAt: J.date(j['createdAt']),
        studentId: J.strOrNull(j['studentId']),
      );
}

class StudentDocument {
  StudentDocument({required this.id, required this.type, required this.fileName, this.mimeType, this.sizeBytes, this.createdAt});

  final String id;
  final String type;
  final String fileName;
  final String? mimeType;
  final int? sizeBytes;
  final DateTime? createdAt;

  String get sizeLabel {
    final b = sizeBytes;
    if (b == null) return '';
    if (b < 1024) return '$b B';
    if (b < 1024 * 1024) return '${(b / 1024).toStringAsFixed(0)} KB';
    return '${(b / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  factory StudentDocument.fromJson(Map<String, dynamic> j) => StudentDocument(
        id: J.str(j['id']),
        type: J.str(j['documentType'], 'Document'),
        fileName: J.str(j['fileName'], 'document'),
        mimeType: J.strOrNull(j['mimeType']),
        sizeBytes: J.numOrNull(j['sizeBytes'])?.toInt(),
        createdAt: J.date(j['createdAt']),
      );
}

class IssuedCertificate {
  IssuedCertificate({required this.id, required this.type, this.issuedAt});

  final String id;
  final String type;
  final DateTime? issuedAt;

  factory IssuedCertificate.fromJson(Map<String, dynamic> j) =>
      IssuedCertificate(id: J.str(j['id']), type: J.str(j['certificateType'], 'Certificate'), issuedAt: J.date(j['issuedAt']));
}

class GuardianContact {
  GuardianContact({required this.id, required this.name, required this.relation, required this.mobile, this.altMobile, this.children});

  final String id;
  final String name;
  final String relation;
  final String mobile;
  final String? altMobile;
  final String? children;

  factory GuardianContact.fromJson(Map<String, dynamic> j) => GuardianContact(
        id: J.str(j['id']),
        name: J.str(j['name']),
        relation: J.str(j['relation'], 'Guardian'),
        mobile: J.str(j['mobile']),
        altMobile: J.strOrNull(j['altMobile']),
        children: J.strOrNull(j['children']),
      );
}

/// `/portal/guardian/profile`.
class GuardianProfile {
  GuardianProfile({
    required this.id,
    required this.name,
    required this.mobile,
    required this.otherGuardians,
    required this.notificationPrefs,
    this.nameBn,
    this.relation,
    this.altMobile,
    this.email,
    this.loginEmail,
    this.occupation,
    this.address,
    this.emergencyContact,
    this.photoUrl,
    this.lastLoginAt,
  });

  final String id;
  final String name;
  final String? nameBn;
  final String? relation;
  final String mobile;
  final String? altMobile;
  final String? email;
  final String? loginEmail;
  final String? occupation;
  final String? address;
  final String? emergencyContact;
  final String? photoUrl;
  final DateTime? lastLoginAt;
  final List<GuardianContact> otherGuardians;
  final Map<String, bool> notificationPrefs;

  bool pref(String key) => notificationPrefs[key] ?? true;

  factory GuardianProfile.fromJson(Map<String, dynamic> data) {
    final g = J.map(data['guardian']);
    final prefs = J.map(g['notificationPrefs']);
    return GuardianProfile(
      id: J.str(g['id']),
      name: J.str(g['name']),
      nameBn: J.strOrNull(g['nameBn']),
      relation: J.strOrNull(g['relationDefault']),
      mobile: J.str(g['mobile']),
      altMobile: J.strOrNull(g['altMobile']),
      email: J.strOrNull(g['email']),
      loginEmail: J.strOrNull(g['loginEmail']),
      occupation: J.strOrNull(g['occupation']),
      address: J.strOrNull(g['address']),
      emergencyContact: J.strOrNull(g['emergencyContact']),
      photoUrl: J.strOrNull(g['photoUrl']),
      lastLoginAt: J.date(g['lastLoginAt']),
      otherGuardians: J.list(data['otherGuardians']).map(GuardianContact.fromJson).toList(),
      notificationPrefs: prefs.map((k, v) => MapEntry(k, J.boolOf(v, true))),
    );
  }
}
