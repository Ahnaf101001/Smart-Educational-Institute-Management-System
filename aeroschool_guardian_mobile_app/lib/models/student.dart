import '../core/format.dart';

class StudentGuardianContact {
  StudentGuardianContact({
    required this.name,
    required this.relation,
    required this.mobile,
    this.isPrimary = false,
    this.altMobile,
  });

  final String name;
  final String relation;
  final String mobile;
  final String? altMobile;
  final bool isPrimary;

  factory StudentGuardianContact.fromJson(Map<String, dynamic> j) =>
      StudentGuardianContact(
        name: J.str(j['name']),
        relation: J.str(j['relation'], 'Guardian'),
        mobile: J.str(j['mobile']),
        altMobile: J.strOrNull(j['altMobile']),
        isPrimary: J.boolOf(j['isPrimary']),
      );
}

/// Full student profile (`/portal/guardian/students/:id/profile`).
class StudentProfile {
  StudentProfile({
    required this.id,
    required this.name,
    required this.className,
    required this.guardians,
    this.nameBn,
    this.roll,
    this.gender,
    this.section,
    this.shift,
    this.groupName,
    this.version,
    this.photoUrl,
    this.dateOfBirth,
    this.admissionDate,
    this.bloodGroup,
    this.religion,
    this.nationality,
    this.address,
    this.status,
    this.previousSchool,
    this.sessionName,
    this.classTeacher,
    this.classTeacherPhone,
    this.classTeacherEmail,
    this.allergies,
    this.medicalNotes,
    this.emergencyName,
    this.emergencyRelation,
    this.emergencyMobile,
    this.canViewResults = true,
    this.canViewFees = true,
  });

  final String id;
  final String name;
  final String? nameBn;
  final String? roll;
  final String? gender;
  final String className;
  final String? section;
  final String? shift;
  final String? groupName;
  final String? version;
  final String? photoUrl;
  final DateTime? dateOfBirth;
  final DateTime? admissionDate;
  final String? bloodGroup;
  final String? religion;
  final String? nationality;
  final String? address;
  final String? status;
  final String? previousSchool;
  final String? sessionName;
  final String? classTeacher;
  final String? classTeacherPhone;
  final String? classTeacherEmail;
  final String? allergies;
  final String? medicalNotes;
  final String? emergencyName;
  final String? emergencyRelation;
  final String? emergencyMobile;
  final bool canViewResults;
  final bool canViewFees;
  final List<StudentGuardianContact> guardians;

  factory StudentProfile.fromJson(Map<String, dynamic> j) {
    final e = J.map(j['emergencyContact']);
    return StudentProfile(
      id: J.str(j['id']),
      name: J.str(j['name']),
      nameBn: J.strOrNull(j['nameBn']),
      roll: J.strOrNull(j['roll']),
      gender: J.strOrNull(j['gender']),
      className: J.str(j['className'], '—'),
      section: J.strOrNull(j['section']),
      shift: J.strOrNull(j['shift']),
      groupName: J.strOrNull(j['groupName']),
      version: J.strOrNull(j['version']),
      photoUrl: J.strOrNull(j['photoUrl']),
      dateOfBirth: J.date(j['dateOfBirth']),
      admissionDate: J.date(j['admissionDate']),
      bloodGroup: J.strOrNull(j['bloodGroup']),
      religion: J.strOrNull(j['religion']),
      nationality: J.strOrNull(j['nationality']),
      address: J.strOrNull(j['address']),
      status: J.strOrNull(j['status']),
      previousSchool: J.strOrNull(j['previousSchool']),
      sessionName: J.strOrNull(j['sessionName']),
      classTeacher: J.strOrNull(j['classTeacher']),
      classTeacherPhone: J.strOrNull(j['classTeacherPhone']),
      classTeacherEmail: J.strOrNull(j['classTeacherEmail']),
      allergies: J.strOrNull(j['allergies']),
      medicalNotes: J.strOrNull(j['medicalNotes']),
      emergencyName: J.strOrNull(e['name']),
      emergencyRelation: J.strOrNull(e['relation']),
      emergencyMobile: J.strOrNull(e['mobile']),
      canViewResults: J.boolOf(j['canViewResults'], true),
      canViewFees: J.boolOf(j['canViewFees'], true),
      guardians: J
          .list(j['guardians'])
          .map(StudentGuardianContact.fromJson)
          .toList(),
    );
  }
}

class AttendanceRecord {
  AttendanceRecord({
    required this.date,
    required this.status,
    this.inTime,
    this.outTime,
  });

  final DateTime date;
  final String status;
  final DateTime? inTime;
  final DateTime? outTime;

  factory AttendanceRecord.fromJson(Map<String, dynamic> j) => AttendanceRecord(
    date: J.date(j['attendanceDate']) ?? DateTime.now(),
    status: J.str(j['status'], '—'),
    inTime: J.date(j['inTime']),
    outTime: J.date(j['outTime']),
  );
}

class AttendanceMonthSummary {
  AttendanceMonthSummary({
    required this.month,
    required this.total,
    required this.present,
    required this.absent,
    required this.late,
    this.percentage,
  });

  final String month;
  final int total;
  final int present;
  final int absent;
  final int late;
  final num? percentage;

  factory AttendanceMonthSummary.fromJson(Map<String, dynamic> j) =>
      AttendanceMonthSummary(
        month: J.str(j['month']),
        total: J.intOf(j['total']),
        present: J.intOf(j['present']),
        absent: J.intOf(j['absent']),
        late: J.intOf(j['late']),
        percentage: J.numOrNull(j['percentage']),
      );
}

/// `/portal/guardian/students/:id/attendance?month=YYYY-MM`.
class AttendanceReport {
  AttendanceReport({
    required this.month,
    required this.records,
    required this.history,
    required this.total,
    required this.present,
    required this.absent,
    required this.late,
    required this.leave,
    required this.earlyLeave,
    this.percentage,
  });

  final String month;
  final List<AttendanceRecord> records;
  final List<AttendanceMonthSummary> history;
  final int total;
  final int present;
  final int absent;
  final int late;
  final int leave;
  final int earlyLeave;
  final num? percentage;

  factory AttendanceReport.fromJson(Map<String, dynamic> j) {
    final s = J.map(j['summary']);
    return AttendanceReport(
      month: J.str(j['month']),
      records: J.list(j['records']).map(AttendanceRecord.fromJson).toList(),
      history: J
          .list(j['history'])
          .map(AttendanceMonthSummary.fromJson)
          .toList(),
      total: J.intOf(s['total']),
      present: J.intOf(s['present']),
      absent: J.intOf(s['absent']),
      late: J.intOf(s['late']),
      leave: J.intOf(s['leave']),
      earlyLeave: J.intOf(s['earlyLeave']),
      percentage: J.numOrNull(j['percentage']),
    );
  }
}
