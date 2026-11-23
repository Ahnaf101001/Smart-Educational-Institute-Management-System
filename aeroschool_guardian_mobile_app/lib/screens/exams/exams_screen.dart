import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/academics.dart';
import '../../models/child.dart';
import '../../models/school.dart';
import '../../services/guardian_service.dart';
import '../../services/receipt_pdf_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import 'result_detail_screen.dart';

typedef _ExamData = ({
  List<ExamScheduleItem> schedule,
  List<ExamResult> results,
  String? message,
});

/// Exam & result management (spec §F): exam schedule/routine, subject-wise
/// marks, results, grade/GPA, online marksheet, progress report, previous
/// results and class position.
class ExamsScreen extends StatelessWidget {
  const ExamsScreen({super.key, required this.child, this.initialTab = 0});

  final ChildSummary child;
  final int initialTab;

  Future<_ExamData> _load(GuardianService s) async {
    final results = await s.results(child.id);
    final academics = await s.academics(child.id);
    return (
      schedule: academics.examRoutine,
      results: results.results,
      message: results.message,
    );
  }

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    return DefaultTabController(
      length: 3,
      initialIndex: initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            context.l10n.titleForChild(context.l10n.examsTitle, child.name),
          ),
          bottom: TabBar(
            tabs: [
              Tab(text: context.l10n.scheduleTab),
              Tab(text: context.l10n.resultsTab),
              Tab(text: context.l10n.progressTab),
            ],
          ),
        ),
        body: AsyncView<_ExamData>(
          load: () => _load(service),
          builder: (context, d, reload) => TabBarView(
            children: [
              _ScheduleTab(items: d.schedule, onRefresh: reload),
              _ResultsTab(
                child: child,
                results: d.results,
                message: d.message,
                onRefresh: reload,
              ),
              _ProgressTab(
                child: child,
                results: d.results,
                message: d.message,
                onRefresh: reload,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScheduleTab extends StatelessWidget {
  const _ScheduleTab({required this.items, required this.onRefresh});

  final List<ExamScheduleItem> items;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final byExam = <String, List<ExamScheduleItem>>{};
    for (final i in items) {
      byExam.putIfAbsent(i.examName, () => []).add(i);
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (items.isEmpty)
            Card(
              child: EmptyView(
                title: context.l10n.noUpcomingExamsScheduled,
                icon: Icons.event_available_outlined,
              ),
            ),
          for (final e in byExam.entries) ...[
            SectionTitle(e.key),
            Card(
              child: Column(
                children: [
                  for (final s in e.value)
                    ListTile(
                      leading: const Icon(
                        Icons.edit_calendar_outlined,
                        color: AppColors.navy,
                      ),
                      title: Text(
                        s.subject,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        [
                          Fmt.date(s.date),
                          if (s.start != null)
                            '${Fmt.clock(s.start)}${s.end != null ? ' – ${Fmt.clock(s.end)}' : ''}',
                          if (s.room != null) context.l10n.roomNo(s.room ?? ''),
                        ].join(' • '),
                      ),
                      trailing: s.fullMarks == null
                          ? null
                          : Text(
                              '${s.fullMarks} marks',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                              ),
                            ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ResultsTab extends StatelessWidget {
  const _ResultsTab({
    required this.child,
    required this.results,
    required this.message,
    required this.onRefresh,
  });

  final ChildSummary child;
  final List<ExamResult> results;
  final String? message;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: onRefresh,
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (message != null) ...[
          AccessNotice(message: message!),
          const SizedBox(height: 12),
        ],
        if (results.isEmpty && message == null)
          Card(
            child: EmptyView(
              title: context.l10n.noResultsPublishedYet,
              icon: Icons.emoji_events_outlined,
            ),
          ),
        for (final r in results)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => ResultDetailScreen(child: child, result: r),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color:
                              (r.passed ? AppColors.success : AppColors.danger)
                                  .withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          r.grade ?? '-',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: r.passed
                                ? AppColors.success
                                : AppColors.danger,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              r.examName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'GPA ${r.gpa?.toStringAsFixed(2) ?? '—'} • ${Fmt.percent(r.percentage)}${r.classPosition != null ? ' • Position ${r.classPosition}' : ''}',
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              context.l10n.publishedOn(Fmt.date(r.publishedAt)),
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );
}

class _ProgressTab extends StatelessWidget {
  const _ProgressTab({
    required this.child,
    required this.results,
    required this.message,
    required this.onRefresh,
  });

  final ChildSummary child;

  final List<ExamResult> results;
  final String? message;
  final Future<void> Function() onRefresh;

  Future<void> _download(BuildContext context, List<ExamResult> ordered) async {
    final pdf = context.read<ReceiptPdfService>();
    final service = context.read<GuardianService>();
    try {
      final school = await service.school().catchError(
        (_) => SchoolInfo.empty(),
      );
      final bytes = await pdf.buildProgressReport(
        studentName: child.name,
        classLine: child.classLine,
        schoolName: school.name,
        results: ordered,
      );
      await pdf.share(bytes, 'progress-report-${child.id}.pdf');
    } catch (_) {
      if (context.mounted) {
        showSnack(
          context,
          context.l10n.couldNotCreateProgressReport,
          error: true,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ordered = [...results]
      ..sort(
        (a, b) => (a.publishedAt ?? DateTime(2000)).compareTo(
          b.publishedAt ?? DateTime(2000),
        ),
      );
    // Subject averages across all published exams.
    final subjectTotals = <String, List<num>>{};
    for (final r in ordered) {
      for (final s in r.subjects) {
        if (s.fullMarks > 0) {
          subjectTotals
              .putIfAbsent(s.subject, () => [])
              .add(s.obtained / s.fullMarks * 100);
        }
      }
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (message != null) ...[
            AccessNotice(message: message!),
            const SizedBox(height: 12),
          ],
          if (ordered.isNotEmpty) ...[
            FilledButton.icon(
              onPressed: () => _download(context, ordered),
              icon: const Icon(Icons.picture_as_pdf_outlined),
              label: Text(context.l10n.downloadProgressReportPdf),
            ),
            const SizedBox(height: 12),
          ],
          if (ordered.isEmpty)
            Card(
              child: EmptyView(
                title: context.l10n.progressReportAppearsAfterThe,
                icon: Icons.insights_outlined,
              ),
            )
          else ...[
            SectionCard(
              title: context.l10n.examWiseProgress,
              icon: Icons.show_chart,
              child: Column(
                children: [
                  for (final r in ordered)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  r.examName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              Text(
                                '${Fmt.percent(r.percentage)} • GPA ${r.gpa?.toStringAsFixed(2) ?? '—'}',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: LinearProgressIndicator(
                              value: ((r.percentage ?? 0) / 100)
                                  .clamp(0, 1)
                                  .toDouble(),
                              minHeight: 8,
                              backgroundColor: AppColors.surfaceTint,
                              color: r.passed
                                  ? AppColors.blue
                                  : AppColors.danger,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SectionCard(
              title: context.l10n.subjectWiseAverage,
              icon: Icons.subject,
              child: Column(
                children: [
                  for (final e in subjectTotals.entries)
                    InfoRow(
                      label: e.key,
                      value: Fmt.percent(
                        e.value.reduce((a, b) => a + b) / e.value.length,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
