import '../core/format.dart';
import 'child.dart';

class Notice {
  Notice({
    required this.id,
    required this.title,
    required this.message,
    this.priority,
    this.category,
    this.createdAt,
    this.attachmentUrl,
  });

  final String id;
  final String title;
  final String message;
  final String? priority;
  final String? category;
  final DateTime? createdAt;
  final String? attachmentUrl;

  bool get isUrgent {
    final p = (priority ?? '').toLowerCase();
    final c = (category ?? '').toLowerCase();
    return p == 'urgent' || p == 'high' || c.contains('emergency');
  }

  factory Notice.fromJson(Map<String, dynamic> j) => Notice(
    id: J.str(j['id']),
    title: J.str(j['title'], 'Notice'),
    message: J.str(j['message']),
    priority: J.strOrNull(j['priority']),
    category: J.strOrNull(j['category']),
    createdAt: J.date(j['createdAt']),
    attachmentUrl: J.strOrNull(j['attachmentUrl']),
  );
}

class UpcomingExam {
  UpcomingExam({
    required this.examName,
    required this.subjectName,
    required this.studentName,
    required this.studentId,
    this.date,
    this.startTime,
    this.room,
  });

  final String examName;
  final String subjectName;
  final String studentName;
  final String studentId;
  final DateTime? date;
  final String? startTime;
  final String? room;

  factory UpcomingExam.fromJson(Map<String, dynamic> j) => UpcomingExam(
    examName: J.str(j['examName'], 'Exam'),
    subjectName: J.str(j['subjectName']),
    studentName: J.str(j['studentName']),
    studentId: J.str(j['studentId']),
    date: J.date(j['examDate']),
    startTime: J.strOrNull(j['startTime']),
    room: J.strOrNull(j['room']),
  );
}

class AppNotification {
  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.eventType,
    this.studentId,
    this.studentName,
    this.createdAt,
    this.readAt,
  });

  final String id;
  final String title;
  final String body;
  final String eventType;
  final String? studentId;
  final String? studentName;
  final DateTime? createdAt;
  final DateTime? readAt;

  bool get isUnread => readAt == null;

  /// Groups backend event types into the categories of the specification.
  String get category {
    final e = eventType.toLowerCase();
    if (e.contains('absent') ||
        e.contains('late') ||
        e.contains('attendance') ||
        e.contains('entry') ||
        e.contains('exit')) {
      return 'Attendance';
    }
    if (e.contains('result')) return 'Result';
    if (e.contains('exam')) return 'Exam';
    if (e.contains('fee') ||
        e.contains('payment') ||
        e.contains('due') ||
        e.contains('invoice')) {
      return 'Fee';
    }
    if (e.contains('homework') || e.contains('assignment')) return 'Homework';
    if (e.contains('transport') || e.contains('bus')) return 'Transport';
    if (e.contains('emergency')) return 'Emergency';
    if (e.contains('event')) return 'Event';
    if (e.contains('teacher') || e.contains('message')) return 'Teacher';
    return 'Notice';
  }

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
    id: J.str(j['id']),
    title: J.str(j['subject']).isNotEmpty
        ? J.str(j['subject'])
        : J.str(j['eventType'], 'Notification'),
    body: J.str(j['body']),
    eventType: J.str(j['eventType'], 'General'),
    studentId: J.strOrNull(j['studentId']),
    studentName: J.strOrNull(j['studentName']),
    createdAt: J.date(j['createdAt']),
    readAt: J.date(j['readAt']),
  );
}

/// Payload of `/portal/guardian/home`: Family Overview + per-child summaries.
class FamilyOverview {
  FamilyOverview({
    required this.guardianId,
    required this.guardianName,
    required this.children,
    required this.notices,
    required this.upcomingExams,
    required this.recentNotifications,
    required this.unreadNotifications,
    required this.totalDue,
    this.guardianMobile,
    this.guardianEmail,
    this.relation,
  });

  final String guardianId;
  final String guardianName;
  final String? guardianMobile;
  final String? guardianEmail;
  final String? relation;
  final List<ChildSummary> children;
  final List<Notice> notices;
  final List<UpcomingExam> upcomingExams;
  final List<AppNotification> recentNotifications;
  final int unreadNotifications;
  final num totalDue;

  int get presentToday => children
      .where(
        (c) => c.todayAttendance == 'Present' || c.todayAttendance == 'Late',
      )
      .length;
  int get absentToday =>
      children.where((c) => c.todayAttendance == 'Absent').length;
  int get pendingHomework => children.fold(0, (s, c) => s + c.homeworkCount);
  num get monthFeeTotal => children.fold<num>(0, (s, c) => s + c.monthFee);

  factory FamilyOverview.fromJson(Map<String, dynamic> j) {
    final g = J.map(j['guardian']);
    return FamilyOverview(
      guardianId: J.str(g['id']),
      guardianName: J.str(g['name'], 'Guardian'),
      guardianMobile: J.strOrNull(g['mobile']),
      guardianEmail: J.strOrNull(g['email']),
      relation: J.strOrNull(g['relationDefault']),
      children: J.list(j['children']).map(ChildSummary.fromJson).toList(),
      notices: J.list(j['notices']).map(Notice.fromJson).toList(),
      upcomingExams: J
          .list(j['upcomingExams'])
          .map(UpcomingExam.fromJson)
          .toList(),
      recentNotifications: J
          .list(j['recentNotifications'])
          .map(AppNotification.fromJson)
          .toList(),
      unreadNotifications: J.intOf(j['unreadNotifications']),
      totalDue: J.numOf(j['totalDue']),
    );
  }
}
