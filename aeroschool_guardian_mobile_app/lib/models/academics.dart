import '../core/format.dart';

class RoutineEntry {
  RoutineEntry({
    required this.day,
    required this.subject,
    this.period,
    this.start,
    this.end,
    this.teacher,
    this.room,
    this.isBreak = false,
  });

  final String day;
  final String subject;
  final String? period;
  final String? start;
  final String? end;
  final String? teacher;
  final String? room;
  final bool isBreak;

  factory RoutineEntry.fromJson(Map<String, dynamic> j) => RoutineEntry(
    day: J.str(j['dayOfWeek']),
    subject: J.str(j['subjectName']).isNotEmpty
        ? J.str(j['subjectName'])
        : J.str(j['label'], J.boolOf(j['isBreak']) ? 'Break' : 'Class'),
    period: J.strOrNull(j['periodCode']),
    start: J.strOrNull(j['startTime']),
    end: J.strOrNull(j['endTime']),
    teacher: J.strOrNull(j['teacherName']),
    room: J.strOrNull(j['roomNo']),
    isBreak: J.boolOf(j['isBreak']),
  );
}

class Homework {
  Homework({
    required this.id,
    required this.kind,
    required this.title,
    required this.submissionStatus,
    this.description,
    this.subject,
    this.assignedDate,
    this.dueDate,
    this.totalMarks,
    this.attachmentUrl,
    this.submissionMarks,
    this.submissionRemarks,
    this.submittedAt,
  });

  final String id;
  final String kind;
  final String title;
  final String? description;
  final String? subject;
  final DateTime? assignedDate;
  final DateTime? dueDate;
  final num? totalMarks;
  final String? attachmentUrl;
  final String submissionStatus;
  final num? submissionMarks;
  final String? submissionRemarks;
  final DateTime? submittedAt;

  bool get isSubmitted => submissionStatus != 'Not Submitted';
  bool get isOverdue {
    if (isSubmitted || dueDate == null) return false;
    final now = DateTime.now();
    return dueDate!.isBefore(DateTime(now.year, now.month, now.day));
  }

  bool get isPending => !isSubmitted && !isOverdue;
  bool get isClassTest =>
      kind == 'Class Test' || title.toLowerCase().contains('class test');

  factory Homework.fromJson(Map<String, dynamic> j) => Homework(
    id: J.str(j['id']),
    kind: J.str(j['kind'], 'Homework'),
    title: J.str(j['title'], 'Homework'),
    description: J.strOrNull(j['description']),
    subject: J.strOrNull(j['subjectName']),
    assignedDate: J.date(j['assignedDate']),
    dueDate: J.date(j['dueDate']),
    totalMarks: J.numOrNull(j['totalMarks']),
    attachmentUrl: J.strOrNull(j['attachmentUrl']),
    submissionStatus: J.str(j['submissionStatus'], 'Not Submitted'),
    submissionMarks: J.numOrNull(j['submissionMarks']),
    submissionRemarks: J.strOrNull(j['submissionRemarks']),
    submittedAt: J.date(j['submittedAt']),
  );
}

class ExamScheduleItem {
  ExamScheduleItem({
    required this.examName,
    required this.subject,
    this.date,
    this.start,
    this.end,
    this.room,
    this.fullMarks,
  });

  final String examName;
  final String subject;
  final DateTime? date;
  final String? start;
  final String? end;
  final String? room;
  final num? fullMarks;

  factory ExamScheduleItem.fromJson(Map<String, dynamic> j) => ExamScheduleItem(
    examName: J.str(j['examName'], 'Exam'),
    subject: J.str(j['subjectName']),
    date: J.date(j['examDate']),
    start: J.strOrNull(j['startTime']),
    end: J.strOrNull(j['endTime']),
    room: J.strOrNull(j['room']),
    fullMarks: J.numOrNull(j['fullMarks']),
  );
}

class AcademicEvent {
  AcademicEvent({
    required this.title,
    required this.type,
    this.startDate,
    this.endDate,
    this.description,
    this.hijriLabel,
  });

  final String title;
  final String type;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? description;
  final String? hijriLabel;

  bool get isHoliday =>
      type.toLowerCase().contains('holiday') ||
      type.toLowerCase().contains('vacation');

  factory AcademicEvent.fromJson(Map<String, dynamic> j) => AcademicEvent(
    title: J.str(j['title']),
    type: J.str(j['type'], 'Event'),
    startDate: J.date(j['startDate']),
    endDate: J.date(j['endDate']),
    description: J.strOrNull(j['description']),
    hijriLabel: J.strOrNull(j['hijriLabel']),
  );
}

/// `/portal/guardian/students/:id/academics`.
class AcademicsData {
  AcademicsData({
    required this.routine,
    required this.homework,
    required this.examRoutine,
    required this.events,
  });

  final List<RoutineEntry> routine;
  final List<Homework> homework;
  final List<ExamScheduleItem> examRoutine;
  final List<AcademicEvent> events;

  factory AcademicsData.fromJson(Map<String, dynamic> j) => AcademicsData(
    routine: J.list(j['routine']).map(RoutineEntry.fromJson).toList(),
    homework: J.list(j['homework']).map(Homework.fromJson).toList(),
    examRoutine: J
        .list(j['examRoutine'])
        .map(ExamScheduleItem.fromJson)
        .toList(),
    events: J.list(j['events']).map(AcademicEvent.fromJson).toList(),
  );
}

class SubjectResult {
  SubjectResult({
    required this.subject,
    required this.obtained,
    required this.fullMarks,
    required this.grade,
    this.code,
    this.point,
    this.passed = true,
    this.absent = false,
    this.isFourth = false,
  });

  final String subject;
  final String? code;
  final num obtained;
  final num fullMarks;
  final String grade;
  final num? point;
  final bool passed;
  final bool absent;
  final bool isFourth;

  factory SubjectResult.fromJson(Map<String, dynamic> j) => SubjectResult(
    subject: J.str(j['subjectName'], 'Subject'),
    code: J.strOrNull(j['subjectCode']),
    obtained: J.numOf(j['obtained']),
    fullMarks: J.numOf(j['fullMarks'], 100),
    grade: J.str(j['grade'], '-'),
    point: J.numOrNull(j['point']),
    passed: J.boolOf(j['passed'], true),
    absent: J.boolOf(j['absent']),
    isFourth: J.boolOf(j['isFourth']),
  );
}

class ExamResult {
  ExamResult({
    required this.id,
    required this.examName,
    required this.subjects,
    this.examType,
    this.totalMarks,
    this.maxMarks,
    this.percentage,
    this.gpa,
    this.grade,
    this.status,
    this.classPosition,
    this.sectionPosition,
    this.failedSubjects = 0,
    this.publishedAt,
    this.teacherComment,
  });

  final String id;
  final String examName;
  final String? examType;
  final num? totalMarks;
  final num? maxMarks;
  final num? percentage;
  final num? gpa;
  final String? grade;
  final String? status;
  final int? classPosition;
  final int? sectionPosition;
  final int failedSubjects;
  final DateTime? publishedAt;
  final String? teacherComment;
  final List<SubjectResult> subjects;

  bool get passed => (status ?? 'Pass').toLowerCase() != 'fail';

  factory ExamResult.fromJson(Map<String, dynamic> j) => ExamResult(
    id: J.str(j['id']),
    examName: J.str(j['examName'], 'Exam'),
    examType: J.strOrNull(j['examType']),
    totalMarks: J.numOrNull(j['totalMarks']),
    maxMarks: J.numOrNull(j['maxMarks']),
    percentage: J.numOrNull(j['percentage']),
    gpa: J.numOrNull(j['gpa']),
    grade: J.strOrNull(j['grade']),
    status: J.strOrNull(j['status']),
    classPosition: J.numOrNull(j['classPosition'])?.toInt(),
    sectionPosition: J.numOrNull(j['sectionPosition'])?.toInt(),
    failedSubjects: J.intOf(j['failedSubjects']),
    publishedAt: J.date(j['publishedAt']),
    teacherComment: J.strOrNull(j['teacherComment']),
    subjects: J.list(j['subjects']).map(SubjectResult.fromJson).toList(),
  );
}
