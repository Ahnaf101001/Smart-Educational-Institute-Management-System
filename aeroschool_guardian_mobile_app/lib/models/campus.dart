import '../core/format.dart';

/// Madrasa, campus-life and school-community data for one child, from
/// `/portal/guardian/students/:id/extras` (GA-17..22), plus the gallery,
/// parent–teacher meeting slots and signed-in sessions.

class HifzLog {
  HifzLog({
    this.date,
    this.logType = 'Hifz',
    this.sabakPara,
    this.sabakFrom,
    this.sabakTo,
    this.sabqi,
    this.amukhtaPara,
    this.mistakes = 0,
    this.tajweedRating,
    this.comment,
    this.ustadName,
  });

  final DateTime? date;
  final String logType;
  final int? sabakPara;
  final String? sabakFrom;
  final String? sabakTo;
  final String? sabqi;
  final String? amukhtaPara;
  final int mistakes;
  final int? tajweedRating;
  final String? comment;
  final String? ustadName;

  factory HifzLog.fromJson(Map<String, dynamic> j) => HifzLog(
    date: J.date(j['logDate']),
    logType: J.str(j['logType'], 'Hifz'),
    sabakPara: J.numOrNull(j['sabakPara'])?.toInt(),
    sabakFrom: J.strOrNull(j['sabakFrom']),
    sabakTo: J.strOrNull(j['sabakTo']),
    sabqi: J.strOrNull(j['sabqi']),
    amukhtaPara: J.strOrNull(j['amukhtaPara']),
    mistakes: J.intOf(j['mistakes']),
    tajweedRating: J.numOrNull(j['tajweedRating'])?.toInt(),
    comment: J.strOrNull(j['comment']),
    ustadName: J.strOrNull(j['ustadName']),
  );
}

class SalahRecord {
  SalahRecord({required this.wakt, required this.status, this.date});

  final DateTime? date;
  final String wakt;
  final String status;

  bool get prayed => status == 'Jamaat' || status == 'Alone';

  factory SalahRecord.fromJson(Map<String, dynamic> j) => SalahRecord(
    date: J.date(j['attendanceDate']),
    wakt: J.str(j['wakt']),
    status: J.str(j['status']),
  );
}

class LibraryLoan {
  LibraryLoan({
    required this.title,
    required this.status,
    this.issueDate,
    this.dueDate,
    this.returnDate,
    this.fine = 0,
    this.finePaid = false,
  });

  final String title;
  final String status;
  final DateTime? issueDate;
  final DateTime? dueDate;
  final DateTime? returnDate;
  final num fine;
  final bool finePaid;

  bool get isOut => returnDate == null && status != 'Returned';

  bool overdueOn(DateTime today) =>
      isOut &&
      dueDate != null &&
      dueDate!.isBefore(DateTime(today.year, today.month, today.day));

  factory LibraryLoan.fromJson(Map<String, dynamic> j) => LibraryLoan(
    title: J.str(j['title'], 'Book'),
    status: J.str(j['status'], 'Issued'),
    issueDate: J.date(j['issueDate']),
    dueDate: J.date(j['dueDate']),
    returnDate: J.date(j['returnDate']),
    fine: J.numOf(j['fine']),
    finePaid: J.boolOf(j['finePaid']),
  );
}

class HostelStay {
  HostelStay({
    required this.building,
    required this.roomNo,
    this.seatNo,
    this.fromDate,
    this.isLillah = false,
  });

  final String building;
  final String roomNo;
  final String? seatNo;
  final DateTime? fromDate;
  final bool isLillah;

  factory HostelStay.fromJson(Map<String, dynamic> j) => HostelStay(
    building: J.str(j['building']),
    roomNo: J.str(j['roomNo']),
    seatNo: J.strOrNull(j['seatNo']),
    fromDate: J.date(j['fromDate']),
    isLillah: J.boolOf(j['isLillah']),
  );
}

/// House / club / ECA the child belongs to (English-medium extras, GA-22).
class HouseMembership {
  HouseMembership({
    required this.name,
    required this.kind,
    this.points = 0,
    this.myPoints = 0,
  });

  final String name;
  final String kind;
  final num points;
  final num myPoints;

  factory HouseMembership.fromJson(Map<String, dynamic> j) => HouseMembership(
    name: J.str(j['name']),
    kind: J.str(j['kind'], 'Club'),
    points: J.numOf(j['points']),
    myPoints: J.numOf(j['myPoints']),
  );
}

/// Pre-school daily log (meal, nap, activity, mood).
class DailyLog {
  DailyLog({
    this.date,
    this.meal,
    this.nap,
    this.activity,
    this.mood,
    this.photoUrl,
    this.note,
  });

  final DateTime? date;
  final String? meal;
  final String? nap;
  final String? activity;
  final String? mood;
  final String? photoUrl;
  final String? note;

  factory DailyLog.fromJson(Map<String, dynamic> j) => DailyLog(
    date: J.date(j['logDate']),
    meal: J.strOrNull(j['meal']),
    nap: J.strOrNull(j['nap']),
    activity: J.strOrNull(j['activity']),
    mood: J.strOrNull(j['mood']),
    photoUrl: J.strOrNull(j['photoUrl']),
    note: J.strOrNull(j['note']),
  );
}

class ClubSession {
  ClubSession({required this.status, this.date, this.clubName, this.activity});

  final DateTime? date;
  final String status;
  final String? clubName;
  final String? activity;

  factory ClubSession.fromJson(Map<String, dynamic> j) => ClubSession(
    date: J.date(j['sessionDate']),
    status: J.str(j['status'], 'Present'),
    clubName: J.strOrNull(j['clubName']),
    activity: J.strOrNull(j['activity']),
  );
}

/// Everything on the Campus life screen for one child.
class CampusData {
  CampusData({
    this.parasDone = 0,
    this.hifzLogs = const [],
    this.salah = const [],
    this.library = const [],
    this.hostel,
    this.houses = const [],
    this.dailyLogs = const [],
    this.clubSessions = const [],
  });

  final int parasDone;
  final List<HifzLog> hifzLogs;
  final List<SalahRecord> salah;
  final List<LibraryLoan> library;
  final HostelStay? hostel;
  final List<HouseMembership> houses;
  final List<DailyLog> dailyLogs;
  final List<ClubSession> clubSessions;

  bool get hasMadrasa =>
      parasDone > 0 || hifzLogs.isNotEmpty || salah.isNotEmpty;
  bool get hasCommunity =>
      houses.isNotEmpty || dailyLogs.isNotEmpty || clubSessions.isNotEmpty;

  /// Salah in the last 7 days prayed (Jamaat / alone) out of the records kept.
  ({int prayed, int total}) get salahScore =>
      (prayed: salah.where((s) => s.prayed).length, total: salah.length);

  factory CampusData.fromJson(Map<String, dynamic> j) {
    final hifz = J.map(j['hifz']);
    return CampusData(
      parasDone: J.intOf(hifz['parasDone']),
      hifzLogs: J.list(hifz['logs']).map(HifzLog.fromJson).toList(),
      salah: J.list(j['salah']).map(SalahRecord.fromJson).toList(),
      library: J.list(j['library']).map(LibraryLoan.fromJson).toList(),
      hostel: j['hostel'] is Map
          ? HostelStay.fromJson(J.map(j['hostel']))
          : null,
      houses: J.list(j['houses']).map(HouseMembership.fromJson).toList(),
      dailyLogs: J.list(j['dailyLogs']).map(DailyLog.fromJson).toList(),
      clubSessions: J
          .list(j['clubAttendance'])
          .map(ClubSession.fromJson)
          .toList(),
    );
  }
}

class GalleryPhoto {
  GalleryPhoto({required this.id, required this.imageUrl, this.caption});

  final String id;
  final String imageUrl;
  final String? caption;

  factory GalleryPhoto.fromJson(Map<String, dynamic> j) => GalleryPhoto(
    id: J.str(j['id']),
    imageUrl: J.str(j['imageUrl']),
    caption: J.strOrNull(j['caption']),
  );
}

class GalleryAlbum {
  GalleryAlbum({
    required this.id,
    required this.title,
    this.titleBn,
    this.description,
    this.eventDate,
    this.coverUrl,
    this.photos = const [],
  });

  final String id;
  final String title;
  final String? titleBn;
  final String? description;
  final DateTime? eventDate;
  final String? coverUrl;
  final List<GalleryPhoto> photos;

  String? get cover =>
      coverUrl ?? (photos.isEmpty ? null : photos.first.imageUrl);

  String titleFor(bool bangla) =>
      bangla && (titleBn?.isNotEmpty ?? false) ? titleBn! : title;

  factory GalleryAlbum.fromJson(Map<String, dynamic> j) => GalleryAlbum(
    id: J.str(j['id']),
    title: J.str(j['title']),
    titleBn: J.strOrNull(j['titleBn']),
    description: J.strOrNull(j['description']),
    eventDate: J.date(j['eventDate']),
    coverUrl: J.strOrNull(j['coverUrl']),
    photos: J.list(j['photos']).map(GalleryPhoto.fromJson).toList(),
  );
}

/// Parent–teacher meeting slot (SB-09).
class PtmSlot {
  PtmSlot({
    required this.id,
    required this.teacherName,
    required this.status,
    required this.startTime,
    required this.endTime,
    this.date,
    this.studentId,
    this.note,
    this.mine = false,
  });

  final String id;
  final String teacherName;
  final String status;
  final DateTime? date;
  final String startTime;
  final String endTime;
  final String? studentId;
  final String? note;

  /// Booked by this guardian (the server only returns free slots and the guardian's own).
  final bool mine;

  bool get available => status == 'Available';

  factory PtmSlot.fromJson(Map<String, dynamic> j) => PtmSlot(
    id: J.str(j['id']),
    teacherName: J.str(j['teacherName'], 'Teacher'),
    status: J.str(j['status'], 'Available'),
    date: J.date(j['slotDate']),
    startTime: J.str(j['startTime']),
    endTime: J.str(j['endTime']),
    studentId: J.strOrNull(j['studentId']),
    note: J.strOrNull(j['note']),
    mine:
        J.str(j['status']) != 'Available' &&
        J.strOrNull(j['guardianId']) != null,
  );
}

/// A signed-in session (phone or browser) on this guardian's account (GA-05v1).
class DeviceSession {
  DeviceSession({
    required this.id,
    this.userAgent,
    this.ip,
    this.method,
    this.createdAt,
    this.lastSeenAt,
    this.current = false,
  });

  final String id;
  final String? userAgent;
  final String? ip;
  final String? method;
  final DateTime? createdAt;
  final DateTime? lastSeenAt;
  final bool current;

  /// Short human label from the user agent ("Android app", "Chrome on Windows"…).
  String get label {
    final ua = (userAgent ?? '').toLowerCase();
    if (ua.isEmpty) return 'Unknown device';
    if (ua.contains('dart') || ua.contains('aeroschool')) return 'Guardian app';
    final browser = ua.contains('edg/')
        ? 'Edge'
        : ua.contains('chrome')
        ? 'Chrome'
        : ua.contains('firefox')
        ? 'Firefox'
        : ua.contains('safari')
        ? 'Safari'
        : 'Browser';
    final os = ua.contains('android')
        ? 'Android'
        : ua.contains('iphone') || ua.contains('ipad')
        ? 'iOS'
        : ua.contains('windows')
        ? 'Windows'
        : ua.contains('mac os')
        ? 'macOS'
        : ua.contains('linux')
        ? 'Linux'
        : null;
    return os == null ? browser : '$browser on $os';
  }

  factory DeviceSession.fromJson(Map<String, dynamic> j) => DeviceSession(
    id: J.str(j['id']),
    userAgent: J.strOrNull(j['userAgent']),
    ip: J.strOrNull(j['ip']),
    method: J.strOrNull(j['method']),
    createdAt: J.date(j['createdAt']),
    lastSeenAt: J.date(j['lastSeenAt']),
    current: J.boolOf(j['current']),
  );
}
