import 'package:material_ui/material_ui.dart';

import '../../core/motion.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/academics.dart';
import '../../models/child.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Academic management (spec §E): class & subject-wise routine with
/// teachers, homework/assignments with submission status, upcoming class
/// tests, academic calendar and holidays.
class AcademicsScreen extends StatelessWidget {
  const AcademicsScreen({super.key, required this.child, this.initialTab = 0});

  final ChildSummary child;
  final int initialTab;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    return DefaultTabController(
      length: 3,
      initialIndex: initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            context.l10n.titleForChild(context.l10n.academicsTitle, child.name),
          ),
          bottom: TabBar(
            tabs: [
              Tab(text: context.l10n.modRoutine),
              Tab(text: context.l10n.homework),
              Tab(text: context.l10n.modCalendar),
            ],
          ),
        ),
        body: AsyncView<AcademicsData>(
          load: () => service.academics(child.id),
          builder: (context, data, reload) => TabBarView(
            children: [
              _RoutineTab(data: data, onRefresh: reload),
              _HomeworkTab(data: data, onRefresh: reload),
              _CalendarTab(data: data, onRefresh: reload),
            ],
          ),
        ),
      ),
    );
  }
}

const _days = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

class _RoutineTab extends StatefulWidget {
  const _RoutineTab({required this.data, required this.onRefresh});

  final AcademicsData data;
  final Future<void> Function() onRefresh;

  @override
  State<_RoutineTab> createState() => _RoutineTabState();
}

class _RoutineTabState extends State<_RoutineTab> {
  late String _day = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ][DateTime.now().weekday - 1];
  bool _bySubject = false;

  @override
  Widget build(BuildContext context) {
    final routine = widget.data.routine;
    final daySlots = routine.where((r) => r.day == _day).toList();
    final subjects = <String, List<RoutineEntry>>{};
    for (final r in routine.where((r) => !r.isBreak)) {
      subjects.putIfAbsent(r.subject, () => []).add(r);
    }
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: StaggeredListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<bool>(
            segments: [
              ButtonSegment(value: false, label: Text(context.l10n.daily)),
              ButtonSegment(value: true, label: Text(context.l10n.bySubject)),
            ],
            showSelectedIcon: false,
            selected: {_bySubject},
            onSelectionChanged: (s) => setState(() => _bySubject = s.first),
          ),
          const SizedBox(height: 12),
          if (routine.isEmpty)
            Card(
              child: EmptyView(
                title: context.l10n.classRoutineNotPublishedYet,
                icon: Icons.schedule,
              ),
            )
          else if (!_bySubject) ...[
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final d in _days)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(context.l10n.dayShort(d)),
                        selected: d == _day,
                        onSelected: (_) => setState(() => _day = d),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: daySlots.isEmpty
                  ? EmptyView(
                      title: context.l10n.noClassesOnDay(
                        context.l10n.word(_day),
                      ),
                      icon: Icons.weekend_outlined,
                    )
                  : Column(
                      children: [
                        for (final r in daySlots)
                          ListTile(
                            leading: SizedBox(
                              width: 64,
                              child: Text(
                                r.start == null
                                    ? (r.period ?? '')
                                    : '${Fmt.clock(r.start)}\n${Fmt.clock(r.end)}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            title: Text(
                              r.subject,
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: r.isBreak ? AppColors.muted : null,
                              ),
                            ),
                            subtitle: r.isBreak
                                ? null
                                : Text(
                                    [
                                      r.teacher,
                                      if (r.room != null)
                                        context.l10n.roomNo(r.room ?? ''),
                                    ].whereType<String>().join(' • '),
                                  ),
                          ),
                      ],
                    ),
            ),
          ] else
            for (final e in subjects.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SectionCard(
                  title: e.key,
                  icon: Icons.book_outlined,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (e.value.first.teacher != null)
                        Text(
                          context.l10n.teacherLabel(
                            e.value.first.teacher ?? '',
                          ),
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final r in e.value)
                            Chip(
                              label: Text(
                                '${r.day.substring(0, 3)} ${Fmt.clock(r.start)}',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

class _HomeworkTab extends StatefulWidget {
  const _HomeworkTab({required this.data, required this.onRefresh});

  final AcademicsData data;
  final Future<void> Function() onRefresh;

  @override
  State<_HomeworkTab> createState() => _HomeworkTabState();
}

class _HomeworkTabState extends State<_HomeworkTab> {
  String _filter = 'Pending';

  @override
  Widget build(BuildContext context) {
    final all = widget.data.homework;
    final list = switch (_filter) {
      'Pending' => all.where((h) => h.isPending).toList(),
      'Submitted' => all.where((h) => h.isSubmitted).toList(),
      'Overdue' => all.where((h) => h.isOverdue).toList(),
      _ => all,
    };
    final tests = all.where((h) => h.isClassTest && !h.isSubmitted).toList();
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: StaggeredListView(
        padding: const EdgeInsets.all(16),
        children: [
          Wrap(
            spacing: 6,
            children: [
              for (final f in const ['Pending', 'Submitted', 'Overdue', 'All'])
                ChoiceChip(
                  label: Text(context.l10n.word(f)),
                  selected: _filter == f,
                  onSelected: (_) => setState(() => _filter = f),
                ),
            ],
          ),
          if (tests.isNotEmpty) ...[
            SectionTitle(context.l10n.upcomingClassTests),
            for (final t in tests) _HomeworkCard(hw: t),
          ],
          SectionTitle(context.l10n.homeworkAssignmentsCount('${list.length}')),
          if (list.isEmpty)
            Card(
              child: EmptyView(
                title: context.l10n.noFilterHomework(
                  context.l10n.word(_filter).toLowerCase(),
                ),
                icon: Icons.task_alt,
              ),
            )
          else
            for (final h in list) _HomeworkCard(hw: h),
        ],
      ),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({required this.hw});

  final Homework hw;

  @override
  Widget build(BuildContext context) => Pressable(child: _card(context));

  Widget _card(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _details(context),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      hw.title,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  StatusChip(hw.isOverdue ? 'Overdue' : hw.submissionStatus),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                [hw.kind, hw.subject].whereType<String>().join(' • '),
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.event, size: 15, color: AppColors.muted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      context.l10n.dueOn(Fmt.date(hw.dueDate)),
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                  if (hw.totalMarks != null)
                    Flexible(
                      child: Text(
                        context.l10n.marksOf(
                          '${hw.submissionMarks ?? '—'}',
                          '${hw.totalMarks}',
                        ),
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );

  void _details(BuildContext context) {
    final files = context.read<FileService>();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                hw.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              InfoRow(label: context.l10n.type, value: hw.kind),
              InfoRow(label: context.l10n.subject, value: hw.subject),
              InfoRow(
                label: context.l10n.assigned,
                value: Fmt.date(hw.assignedDate),
              ),
              InfoRow(label: context.l10n.dueDate, value: Fmt.date(hw.dueDate)),
              InfoRow(
                label: context.l10n.submission,
                value: hw.submissionStatus,
              ),
              if (hw.submittedAt != null)
                InfoRow(
                  label: context.l10n.submittedOn,
                  value: Fmt.dateTime(hw.submittedAt),
                ),
              if (hw.totalMarks != null)
                InfoRow(
                  label: context.l10n.marks,
                  value: '${hw.submissionMarks ?? '—'} / ${hw.totalMarks}',
                ),
              if (hw.submissionRemarks != null)
                InfoRow(
                  label: context.l10n.teacherRemarks,
                  value: hw.submissionRemarks,
                ),
              if (hw.description != null) ...[
                const Divider(height: 24),
                Text(
                  context.l10n.assignmentDetails,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                SelectableText(hw.description!),
              ],
              if (hw.attachmentUrl != null) ...[
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () =>
                      files.openUrl(PersonAvatar.resolve(hw.attachmentUrl)!),
                  icon: const Icon(Icons.attach_file),
                  label: Text(context.l10n.openAttachment),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CalendarTab extends StatelessWidget {
  const _CalendarTab({required this.data, required this.onRefresh});

  final AcademicsData data;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day);
    final upcoming = data.events
        .where(
          (e) => (e.endDate ?? e.startDate ?? start).isAfter(
            start.subtract(const Duration(days: 1)),
          ),
        )
        .toList();
    final holidays = upcoming.where((e) => e.isHoliday).toList();
    final others = upcoming.where((e) => !e.isHoliday).toList();
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: StaggeredListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionTitle(context.l10n.holidays),
          Card(
            child: holidays.isEmpty
                ? EmptyView(
                    title: context.l10n.noUpcomingHolidays,
                    icon: Icons.beach_access_outlined,
                  )
                : Column(
                    children: [for (final e in holidays) _EventTile(event: e)],
                  ),
          ),
          SectionTitle(context.l10n.academicCalendar),
          Card(
            child: others.isEmpty
                ? EmptyView(
                    title: context.l10n.noUpcomingEvents,
                    icon: Icons.event_outlined,
                  )
                : Column(
                    children: [for (final e in others) _EventTile(event: e)],
                  ),
          ),
        ],
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});

  final AcademicEvent event;

  @override
  Widget build(BuildContext context) {
    final range = event.endDate != null && event.endDate != event.startDate
        ? '${Fmt.date(event.startDate)} – ${Fmt.date(event.endDate)}'
        : Fmt.date(event.startDate);
    return ListTile(
      leading: Icon(
        event.isHoliday ? Icons.beach_access_rounded : Icons.event_rounded,
        color: event.isHoliday ? const Color(0xFF7C3AED) : AppColors.navy,
      ),
      title: Text(
        event.title,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        [
          range,
          event.hijriLabel,
          event.description,
        ].whereType<String>().join('\n'),
      ),
      trailing: StatusChip(event.type),
      isThreeLine: event.description != null,
    );
  }
}
