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

/// Online marksheet: subject-wise marks, grade/GPA, position and a PDF download.
class ResultDetailScreen extends StatelessWidget {
  const ResultDetailScreen({
    super.key,
    required this.child,
    required this.result,
  });

  final ChildSummary child;
  final ExamResult result;

  Future<void> _download(BuildContext context) async {
    final pdf = context.read<ReceiptPdfService>();
    final service = context.read<GuardianService>();
    try {
      final school = await service.school().catchError(
        (_) => SchoolInfo.empty(),
      );
      final bytes = await pdf.buildMarksheet(
        studentName: child.name,
        classLine: child.classLine,
        schoolName: school.name,
        result: result,
      );
      await pdf.share(
        bytes,
        'marksheet-${child.id}-${result.examName.replaceAll(' ', '_')}.pdf',
      );
    } catch (_) {
      if (context.mounted) {
        showSnack(context, context.l10n.couldNotCreateMarksheet, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = result;
    return Scaffold(
      appBar: AppBar(
        title: Text(r.examName),
        actions: [
          IconButton(
            tooltip: context.l10n.downloadMarksheet,
            onPressed: () => _download(context),
            icon: const Icon(Icons.download_rounded),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  Text(
                    child.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                    ),
                  ),
                  Text(
                    child.classLine,
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _Big(
                        label: 'GPA',
                        value: r.gpa?.toStringAsFixed(2) ?? '—',
                      ),
                      _Big(label: context.l10n.grade, value: r.grade ?? '—'),
                      _Big(
                        label: context.l10n.percentage,
                        value: Fmt.percent(r.percentage),
                      ),
                      if (r.classPosition != null)
                        _Big(
                          label: context.l10n.position,
                          value: '${r.classPosition}',
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  StatusChip(r.status ?? 'Pass'),
                ],
              ),
            ),
          ),
          SectionTitle(context.l10n.subjectWiseMarks),
          Card(
            child: Column(
              children: [
                for (final s in r.subjects)
                  ListTile(
                    title: Text(
                      s.subject +
                          (s.isFourth ? context.l10n.fourthSubject : ''),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      s.absent
                          ? context.l10n.word('Absent')
                          : '${s.obtained} / ${s.fullMarks}${s.point != null ? context.l10n.pointValue(s.point!.toStringAsFixed(2)) : ''}',
                    ),
                    trailing: StatusChip(
                      s.grade,
                      color: s.passed ? AppColors.success : AppColors.danger,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SectionCard(
            title: context.l10n.summary,
            icon: Icons.summarize_outlined,
            child: Column(
              children: [
                InfoRow(
                  label: context.l10n.totalMarks,
                  value: '${r.totalMarks ?? '—'} / ${r.maxMarks ?? '—'}',
                ),
                InfoRow(
                  label: context.l10n.failedSubjects,
                  value: '${r.failedSubjects}',
                ),
                if (r.sectionPosition != null)
                  InfoRow(
                    label: context.l10n.sectionPosition,
                    value: '${r.sectionPosition}',
                  ),
                InfoRow(
                  label: context.l10n.published,
                  value: Fmt.date(r.publishedAt),
                ),
                if (r.teacherComment != null)
                  InfoRow(
                    label: context.l10n.teacherComment,
                    value: r.teacherComment,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => _download(context),
            icon: const Icon(Icons.picture_as_pdf_outlined),
            label: Text(context.l10n.downloadMarksheetPdf),
          ),
        ],
      ),
    );
  }
}

class _Big extends StatelessWidget {
  const _Big({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.navy,
          ),
        ),
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: AppColors.muted),
        ),
      ],
    ),
  );
}
