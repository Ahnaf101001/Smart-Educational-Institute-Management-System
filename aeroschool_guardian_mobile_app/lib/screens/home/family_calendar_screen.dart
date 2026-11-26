import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../l10n/l10n_ext.dart';
import '../../models/academics.dart';
import '../../models/child.dart';
import '../../providers/family_provider.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// One entry on the merged family calendar.
class FamilyCalendarItem {
  FamilyCalendarItem({
    required this.date,
    required this.title,
    required this.kind,
    this.child,
    this.detail,
    this.endDate,
  });

  final DateTime date;
  final DateTime? endDate;
  final String title;
  final String? detail;

  /// `exam`, `homework`, `holiday` or `event`.
  final String kind;

  /// Null for school-wide holidays and events.
  final ChildSummary? child;
}

DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

/// Builds the merged list: every child's exams and homework due dates plus the
/// school's holidays / events (once, not per child), from today for [days] days.
List<FamilyCalendarItem> mergeFamilyCalendar(
  List<(ChildSummary, AcademicsData)> perChild, {
  required DateTime today,
  int days = 60,
}) {
  final start = DateTime(today.year, today.month, today.day);
  final end = start.add(Duration(days: days));
  bool inRange(DateTime? d) =>
      d != null && !d.isBefore(start) && d.isBefore(end);
  final out = <FamilyCalendarItem>[];
  final seenEvents = <String>{};
  for (final (child, data) in perChild) {
    for (final e in data.examRoutine.where((e) => inRange(e.date))) {
      out.add(
        FamilyCalendarItem(
          date: _day(e.date!),
          title: e.subject,
          detail: [
            e.examName,
            if (e.start != null) Fmt.clock(e.start),
          ].join(' • '),
          kind: 'exam',
          child: child,
        ),
      );
    }
    for (final h in data.homework.where(
      (h) => !h.isSubmitted && inRange(h.dueDate),
    )) {
      out.add(
        FamilyCalendarItem(
          date: _day(h.dueDate!),
          title: h.title,
          detail: h.subject,
          kind: 'homework',
          child: child,
        ),
      );
    }
    for (final e in data.events) {
      final s = e.startDate;
      if (s == null) continue;
      final last = e.endDate ?? s;
      if (last.isBefore(start) || !s.isBefore(end)) continue;
      if (!seenEvents.add('${e.title}|${Fmt.date(s)}')) continue;
      out.add(
        FamilyCalendarItem(
          date: s.isBefore(start) ? start : _day(s),
          endDate: e.endDate,
          title: e.title,
          detail: e.hijriLabel,
          kind: e.isHoliday ? 'holiday' : 'event',
        ),
      );
    }
  }
  out.sort((a, b) {
    final c = a.date.compareTo(b.date);
    if (c != 0) return c;
    return (a.child == null ? 0 : 1) - (b.child == null ? 0 : 1);
  });
  return out;
}

/// GA-14 / SB-05: one calendar for the whole family, a colour per child.
class FamilyCalendarScreen extends StatefulWidget {
  const FamilyCalendarScreen({super.key});

  static const palette = [
    Color(0xFF2563EB),
    Color(0xFFDB2777),
    Color(0xFF059669),
    Color(0xFFD97706),
    Color(0xFF7C3AED),
    Color(0xFF0891B2),
  ];

  @override
  State<FamilyCalendarScreen> createState() => _FamilyCalendarScreenState();
}

class _FamilyCalendarScreenState extends State<FamilyCalendarScreen> {
  final Set<String> _hidden = {};

  Future<List<FamilyCalendarItem>> _load(
    GuardianService service,
    List<ChildSummary> children,
  ) async {
    final data = await Future.wait(
      children.map((c) async => (c, await service.academics(c.id))),
    );
    return mergeFamilyCalendar(data, today: DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final service = context.read<GuardianService>();
    final children = context.watch<FamilyProvider>().children;
    final colorOf = {
      for (final (i, c) in children.indexed)
        c.id: FamilyCalendarScreen
            .palette[i % FamilyCalendarScreen.palette.length],
    };
    return Scaffold(
      appBar: AppBar(title: Text(l.familyCalendar)),
      body: children.isEmpty
          ? EmptyView(title: l.noLinkedStudents, icon: Icons.link_off)
          : AsyncView<List<FamilyCalendarItem>>(
              key: ValueKey(children.map((c) => c.id).join(',')),
              load: () => _load(service, children),
              builder: (context, items, reload) {
                final visible = items
                    .where(
                      (i) => i.child == null || !_hidden.contains(i.child!.id),
                    )
                    .toList();
                final byDay = <DateTime, List<FamilyCalendarItem>>{};
                for (final i in visible) {
                  byDay.putIfAbsent(i.date, () => []).add(i);
                }
                return RefreshIndicator(
                  onRefresh: reload,
                  child: StaggeredListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final c in children)
                            FilterChip(
                              avatar: CircleAvatar(
                                backgroundColor: colorOf[c.id],
                              ),
                              label: Text(c.name.split(' ').first),
                              selected: !_hidden.contains(c.id),
                              onSelected: (on) => setState(
                                () => on
                                    ? _hidden.remove(c.id)
                                    : _hidden.add(c.id),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l.next60Days,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                        ),
                      ),
                      if (byDay.isEmpty)
                        Card(
                          child: EmptyView(
                            title: l.nothingScheduled,
                            icon: Icons.event_available_outlined,
                          ),
                        )
                      else
                        for (final day in byDay.entries) ...[
                          SectionTitle(Fmt.date(day.key)),
                          Card(
                            child: Column(
                              children: [
                                for (final item in day.value)
                                  _CalendarTile(
                                    item: item,
                                    color: item.child == null
                                        ? (item.kind == 'holiday'
                                              ? const Color(0xFF7C3AED)
                                              : AppColors.navy)
                                        : colorOf[item.child!.id]!,
                                  ),
                              ],
                            ),
                          ),
                        ],
                    ],
                  ),
                );
              },
            ),
    );
  }
}

class _CalendarTile extends StatelessWidget {
  const _CalendarTile({required this.item, required this.color});

  final FamilyCalendarItem item;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final kind = switch (item.kind) {
      'exam' => l.exam,
      'homework' => l.homeworkDue,
      'holiday' => l.holiday,
      _ => l.event,
    };
    final icon = switch (item.kind) {
      'exam' => Icons.edit_note_rounded,
      'homework' => Icons.menu_book_rounded,
      'holiday' => Icons.beach_access_rounded,
      _ => Icons.event_rounded,
    };
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(width: 4, color: color),
          Expanded(
            child: ListTile(
              leading: Icon(icon, color: color),
              title: Text(
                item.title,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                [
                  item.child?.name ?? l.wholeSchool,
                  kind,
                  if (item.endDate != null && item.endDate != item.date)
                    l.untilDate(Fmt.date(item.endDate)),
                  ?item.detail,
                ].join(' • '),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
