import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../l10n/l10n_ext.dart';
import '../../models/campus.dart';
import '../../models/child.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Campus life for one child: Hifz & Salah (GA-17 / GA-18), library card (GA-21),
/// hostel (GA-20) and houses, clubs, ECA and the pre-school daily log (GA-22).
class CampusScreen extends StatelessWidget {
  const CampusScreen({super.key, required this.child, this.initialTab = 0});

  final ChildSummary child;
  final int initialTab;

  static const madrasaTab = 0;
  static const libraryTab = 1;
  static const hostelTab = 2;
  static const activitiesTab = 3;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final l = context.l10n;
    return DefaultTabController(
      length: 4,
      initialIndex: initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.titleForChild(l.campusLife, child.name)),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: l.hifzSalah),
              Tab(text: l.library),
              Tab(text: l.hostel),
              Tab(text: l.activities),
            ],
          ),
        ),
        body: AsyncView<CampusData>(
          load: () => service.campus(child.id),
          builder: (context, data, reload) => TabBarView(
            children: [
              _MadrasaTab(data: data, onRefresh: reload),
              _LibraryTab(data: data, onRefresh: reload),
              _HostelTab(data: data, onRefresh: reload),
              _ActivitiesTab(data: data, onRefresh: reload),
            ],
          ),
        ),
      ),
    );
  }
}

class _Refreshable extends StatelessWidget {
  const _Refreshable({required this.onRefresh, required this.children});

  final Future<void> Function() onRefresh;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: onRefresh,
    child: StaggeredListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: children,
    ),
  );
}

// ---------------------------------------------------------------- Hifz & Salah
class _MadrasaTab extends StatelessWidget {
  const _MadrasaTab({required this.data, required this.onRefresh});

  final CampusData data;
  final Future<void> Function() onRefresh;

  static const _wakts = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    if (!data.hasMadrasa) {
      return _Refreshable(
        onRefresh: onRefresh,
        children: [
          EmptyView(
            title: l.noMadrasaRecords,
            subtitle: l.noMadrasaRecordsHint,
            icon: Icons.menu_book_outlined,
          ),
        ],
      );
    }
    final score = data.salahScore;
    final days = <DateTime, Map<String, SalahRecord>>{};
    for (final s in data.salah) {
      final d = s.date;
      if (d == null) continue;
      days.putIfAbsent(DateTime(d.year, d.month, d.day), () => {})[s.wakt] = s;
    }
    final dayList = days.keys.toList()..sort((a, b) => b.compareTo(a));
    return _Refreshable(
      onRefresh: onRefresh,
      children: [
        StatGrid(
          children: [
            StatTile(
              label: l.parasMemorised,
              value: '${data.parasDone} / 30',
              caption: l.hifzProgress,
              icon: Icons.auto_stories_outlined,
              color: AppColors.success,
            ),
            StatTile(
              label: l.salahThisWeek,
              value: score.total == 0
                  ? '—'
                  : '${score.prayed} / ${score.total}',
              caption: l.salahPrayedCaption,
              icon: Icons.mosque_outlined,
              color: AppColors.blue,
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: l.hifzProgress,
          icon: Icons.auto_stories_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AnimatedProgressBar(value: data.parasDone / 30),
              const SizedBox(height: 6),
              Text(
                l.parasOfThirty(data.parasDone),
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ],
          ),
        ),
        if (data.hifzLogs.isNotEmpty) ...[
          SectionTitle(l.recentLessons),
          for (final h in data.hifzLogs) _HifzCard(log: h),
        ],
        if (dayList.isNotEmpty) ...[
          SectionTitle(l.salahLast7Days),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Row(
                    children: [
                      const SizedBox(width: 72),
                      for (final w in _wakts)
                        Expanded(
                          child: Text(
                            l.word(w),
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.muted,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const Divider(),
                  for (final d in dayList)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 72,
                            child: Text(
                              Fmt.shortDate(d),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          for (final w in _wakts)
                            Expanded(child: _SalahDot(record: days[d]![w])),
                        ],
                      ),
                    ),
                  const Divider(),
                  Wrap(
                    spacing: 12,
                    runSpacing: 4,
                    children: [
                      _Legend(
                        color: AppColors.success,
                        label: l.word('Jamaat'),
                      ),
                      _Legend(color: AppColors.blue, label: l.word('Alone')),
                      _Legend(color: AppColors.danger, label: l.word('Missed')),
                      _Legend(
                        color: AppColors.warning,
                        label: l.word('Excused'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

Color _salahColor(String status) => switch (status) {
  'Jamaat' => AppColors.success,
  'Alone' => AppColors.blue,
  'Missed' => AppColors.danger,
  'Excused' => AppColors.warning,
  _ => AppColors.border,
};

class _SalahDot extends StatelessWidget {
  const _SalahDot({this.record});

  final SalahRecord? record;

  @override
  Widget build(BuildContext context) {
    final r = record;
    return Semantics(
      label: r == null
          ? context.l10n.notMarkedYet
          : context.l10n.word(r.status),
      child: Center(
        child: Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: r == null ? null : _salahColor(r.status),
            border: r == null ? Border.all(color: AppColors.border) : null,
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 4),
      Text(label, style: const TextStyle(fontSize: 12)),
    ],
  );
}

class _HifzCard extends StatelessWidget {
  const _HifzCard({required this.log});

  final HifzLog log;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final sabak = [
      if (log.sabakPara != null) l.paraNo(log.sabakPara!),
      if (log.sabakFrom != null || log.sabakTo != null)
        '${log.sabakFrom ?? ''} – ${log.sabakTo ?? ''}',
    ].join(' • ');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    Fmt.date(log.date),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                StatusChip(l.word(log.logType)),
              ],
            ),
            const SizedBox(height: 6),
            if (sabak.isNotEmpty) InfoRow(label: l.sabak, value: sabak),
            if (log.sabqi != null) InfoRow(label: l.sabqi, value: log.sabqi),
            if (log.amukhtaPara != null)
              InfoRow(label: l.amukhta, value: log.amukhtaPara),
            InfoRow(label: l.mistakes, value: '${log.mistakes}'),
            if (log.tajweedRating != null)
              InfoRow(
                label: l.tajweed,
                value:
                    '${'★' * log.tajweedRating!}${'☆' * (5 - log.tajweedRating!)}',
              ),
            if (log.ustadName != null)
              InfoRow(label: l.ustad, value: log.ustadName),
            if (log.comment != null)
              InfoRow(label: l.comment, value: log.comment),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- Library card
class _LibraryTab extends StatelessWidget {
  const _LibraryTab({required this.data, required this.onRefresh});

  final CampusData data;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final now = DateTime.now();
    final out = data.library.where((b) => b.isOut).toList();
    final overdue = out.where((b) => b.overdueOn(now)).length;
    final unpaidFine = data.library
        .where((b) => !b.finePaid)
        .fold<num>(0, (sum, b) => sum + b.fine);
    return _Refreshable(
      onRefresh: onRefresh,
      children: [
        StatGrid(
          children: [
            StatTile(
              label: l.booksBorrowed,
              value: '${out.length}',
              caption: l.currentlyWithChild,
              icon: Icons.local_library_outlined,
              color: AppColors.navy,
            ),
            StatTile(
              label: l.overdue,
              value: '$overdue',
              caption: unpaidFine > 0
                  ? l.fineDue(Fmt.money(unpaidFine))
                  : l.noFine,
              icon: Icons.warning_amber_rounded,
              color: overdue > 0 ? AppColors.danger : AppColors.success,
            ),
          ],
        ),
        SectionTitle(l.libraryCard),
        if (data.library.isEmpty)
          Card(
            child: EmptyView(
              title: l.noBooksBorrowed,
              icon: Icons.menu_book_outlined,
            ),
          )
        else
          for (final b in data.library)
            Card(
              child: ListTile(
                leading: Icon(
                  b.isOut
                      ? Icons.menu_book_rounded
                      : Icons.check_circle_outline,
                  color: b.overdueOn(now)
                      ? AppColors.danger
                      : (b.isOut ? AppColors.navy : AppColors.success),
                ),
                title: Text(
                  b.title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  [
                    l.issuedOn(Fmt.date(b.issueDate)),
                    b.returnDate != null
                        ? l.returnedOn(Fmt.date(b.returnDate))
                        : l.dueOn(Fmt.date(b.dueDate)),
                    if (b.fine > 0)
                      '${l.fine}: ${Fmt.money(b.fine)}${b.finePaid ? ' ✓' : ''}',
                  ].join('\n'),
                ),
                isThreeLine: b.fine > 0,
                trailing: StatusChip(
                  b.overdueOn(now) ? l.word('Overdue') : l.word(b.status),
                ),
              ),
            ),
      ],
    );
  }
}

// ---------------------------------------------------------------- Hostel
class _HostelTab extends StatelessWidget {
  const _HostelTab({required this.data, required this.onRefresh});

  final CampusData data;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final h = data.hostel;
    return _Refreshable(
      onRefresh: onRefresh,
      children: [
        if (h == null)
          Card(
            child: EmptyView(
              title: l.notInHostel,
              subtitle: l.notInHostelHint,
              icon: Icons.bed_outlined,
            ),
          )
        else
          SectionCard(
            title: l.hostelRoom,
            icon: Icons.bed_outlined,
            child: Column(
              children: [
                InfoRow(label: l.building, value: h.building),
                InfoRow(label: l.room, value: h.roomNo),
                InfoRow(label: l.seat, value: h.seatNo),
                InfoRow(label: l.since, value: Fmt.date(h.fromDate)),
                if (h.isLillah) InfoRow(label: l.boardingType, value: l.lillah),
              ],
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------- Houses, clubs, ECA, daily log
class _ActivitiesTab extends StatelessWidget {
  const _ActivitiesTab({required this.data, required this.onRefresh});

  final CampusData data;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    if (!data.hasCommunity) {
      return _Refreshable(
        onRefresh: onRefresh,
        children: [
          EmptyView(
            title: l.noActivities,
            subtitle: l.noActivitiesHint,
            icon: Icons.emoji_events_outlined,
          ),
        ],
      );
    }
    return _Refreshable(
      onRefresh: onRefresh,
      children: [
        if (data.houses.isNotEmpty) ...[
          SectionTitle(l.housesClubs),
          for (final h in data.houses)
            Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppColors.surfaceTint,
                  child: Icon(
                    h.kind == 'House'
                        ? Icons.shield_outlined
                        : Icons.groups_2_outlined,
                    color: AppColors.navy,
                  ),
                ),
                title: Text(
                  h.name,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  '${l.word(h.kind)} • ${l.totalPoints(h.points.toString())}',
                ),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${h.myPoints}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        color: AppColors.success,
                      ),
                    ),
                    Text(
                      l.myPoints,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
        if (data.clubSessions.isNotEmpty) ...[
          SectionTitle(l.clubAttendance),
          Card(
            child: Column(
              children: [
                for (final c in data.clubSessions)
                  ListTile(
                    dense: true,
                    title: Text(c.clubName ?? '—'),
                    subtitle: Text([Fmt.date(c.date), ?c.activity].join(' • ')),
                    trailing: StatusChip(l.word(c.status)),
                  ),
              ],
            ),
          ),
        ],
        if (data.dailyLogs.isNotEmpty) ...[
          SectionTitle(l.dailyLog),
          for (final d in data.dailyLogs) _DailyLogCard(log: d),
        ],
      ],
    );
  }
}

class _DailyLogCard extends StatelessWidget {
  const _DailyLogCard({required this.log});

  final DailyLog log;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final photo = PersonAvatar.resolve(log.photoUrl);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (photo != null)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                photo,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const ColoredBox(
                  color: AppColors.surfaceTint,
                  child: Center(child: Icon(Icons.broken_image_outlined)),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        Fmt.date(log.date),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    if (log.mood != null) StatusChip(l.word(log.mood!)),
                  ],
                ),
                if (log.meal != null) InfoRow(label: l.meal, value: log.meal),
                if (log.nap != null) InfoRow(label: l.nap, value: log.nap),
                if (log.activity != null)
                  InfoRow(label: l.activity, value: log.activity),
                if (log.note != null)
                  InfoRow(label: l.comment, value: log.note),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
