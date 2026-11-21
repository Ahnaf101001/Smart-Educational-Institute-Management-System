import '../core/format.dart';

/// One period of today's routine for a child.
class RoutineSlot {
  RoutineSlot({required this.subject, this.period, this.start, this.end, this.teacher, this.room, this.isBreak = false});

  final String subject;
  final String? period;
  final String? start;
  final String? end;
  final String? teacher;
  final String? room;
  final bool isBreak;

  factory RoutineSlot.fromJson(Map<String, dynamic> j) => RoutineSlot(
        subject: J.str(j['subject'], J.boolOf(j['isBreak']) ? 'Break' : 'Class'),
        period: J.strOrNull(j['period']),
        start: J.strOrNull(j['start']),
        end: J.strOrNull(j['end']),
        teacher: J.strOrNull(j['teacher']),
        room: J.strOrNull(j['room']),
        isBreak: J.boolOf(j['isBreak']),
      );
}

/// A linked child as summarised on the guardian dashboard (`/portal/guardian/home`).
class ChildSummary {
  ChildSummary({
    required this.id,
    required this.name,
    required this.className,
    this.nameBn,
    this.photoUrl,
    this.section,
    this.roll,
    this.shift,
    this.relation,
    this.isPrimary = false,
    this.canViewResults = true,
    this.canViewFees = true,
    this.classTeacher,
    this.classTeacherPhone,
    this.todayAttendance,
    this.todayInTime,
    this.todayOutTime,
    this.monthPresent = 0,
    this.monthAbsent = 0,
    this.monthLate = 0,
    this.monthTotal = 0,
    this.monthAttendancePercentage,
    this.feeDue = 0,
    this.monthFee = 0,
    this.homeworkCount = 0,
    this.nextExamName,
    this.nextExamSubject,
    this.nextExamDate,
    this.todayRoutine = const [],
    this.latestResultExam,
    this.latestResultGrade,
    this.latestResultGpa,
  });

  final String id;
  final String name;
  final String? nameBn;
  final String? photoUrl;
  final String className;
  final String? section;
  final String? roll;
  final String? shift;
  final String? relation;
  final bool isPrimary;
  final bool canViewResults;
  final bool canViewFees;
  final String? classTeacher;
  final String? classTeacherPhone;
  final String? todayAttendance;
  final DateTime? todayInTime;
  final DateTime? todayOutTime;
  final int monthPresent;
  final int monthAbsent;
  final int monthLate;
  final int monthTotal;
  final num? monthAttendancePercentage;
  final num feeDue;
  final num monthFee;
  final int homeworkCount;
  final String? nextExamName;
  final String? nextExamSubject;
  final DateTime? nextExamDate;
  final List<RoutineSlot> todayRoutine;
  final String? latestResultExam;
  final String? latestResultGrade;
  final num? latestResultGpa;

  /// "Class 7 • Section A • Roll 001"
  String get classLine {
    final base = className.contains('-') ? className.split('-').first : className;
    return [
      base,
      if (section != null && section!.isNotEmpty) 'Section $section',
      if (roll != null && roll!.isNotEmpty) 'Roll $roll',
    ].join(' • ');
  }

  factory ChildSummary.fromJson(Map<String, dynamic> j) {
    final month = J.map(j['monthAttendance']);
    final exam = J.map(j['nextExam']);
    final result = J.map(j['latestResult']);
    return ChildSummary(
      id: J.str(j['id']),
      name: J.str(j['name'], 'Student'),
      nameBn: J.strOrNull(j['nameBn']),
      photoUrl: J.strOrNull(j['photoUrl']),
      className: J.str(j['className'], '—'),
      section: J.strOrNull(j['section']),
      roll: J.strOrNull(j['roll']),
      shift: J.strOrNull(j['shift']),
      relation: J.strOrNull(j['relation']),
      isPrimary: J.boolOf(j['isPrimary']),
      canViewResults: J.boolOf(j['canViewResults'], true),
      canViewFees: J.boolOf(j['canViewFees'], true),
      classTeacher: J.strOrNull(j['classTeacher']),
      classTeacherPhone: J.strOrNull(j['classTeacherPhone']),
      todayAttendance: J.strOrNull(j['todayAttendance']),
      todayInTime: J.date(j['todayInTime']),
      todayOutTime: J.date(j['todayOutTime']),
      monthPresent: J.intOf(month['present']),
      monthAbsent: J.intOf(month['absent']),
      monthLate: J.intOf(month['late']),
      monthTotal: J.intOf(month['total']),
      monthAttendancePercentage: J.numOrNull(j['monthAttendancePercentage']),
      feeDue: J.numOf(j['feeDue']),
      monthFee: J.numOf(j['monthFee']),
      homeworkCount: J.intOf(j['homeworkCount']),
      nextExamName: J.strOrNull(exam['name']),
      nextExamSubject: J.strOrNull(exam['subject']),
      nextExamDate: J.date(exam['date']),
      todayRoutine: J.list(j['todayRoutine']).map(RoutineSlot.fromJson).toList(),
      latestResultExam: J.strOrNull(result['exam']),
      latestResultGrade: J.strOrNull(result['grade']),
      latestResultGpa: J.numOrNull(result['gpa']),
    );
  }
}
