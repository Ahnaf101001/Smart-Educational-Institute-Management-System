import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/fees.dart';
import '../../services/guardian_service.dart';
import '../../services/receipt_pdf_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Digital payment receipt with PDF download (one receipt per student).
class ReceiptScreen extends StatelessWidget {
  const ReceiptScreen({super.key, required this.receiptNo});

  final String receiptNo;

  Future<void> _download(BuildContext context, Receipt r) async {
    final pdf = context.read<ReceiptPdfService>();
    try {
      final bytes = await pdf.buildReceipt(r);
      await pdf.share(bytes, 'receipt-${r.receiptNo}.pdf');
    } catch (_) {
      if (context.mounted) {
        showSnack(context, context.l10n.couldNotCreateReceipt, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.receiptTitle(receiptNo))),
      body: AsyncView<Receipt>(
        load: () => service.receipt(receiptNo),
        builder: (context, r, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.schoolName ?? context.l10n.school,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 17,
                        color: AppColors.navy,
                      ),
                    ),
                    if (r.schoolAddress != null)
                      Text(
                        r.schoolAddress!,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    const Divider(height: 24),
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'PAYMENT RECEIPT',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1,
                            ),
                          ),
                        ),
                        StatusChip(r.status ?? 'Valid'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    InfoRow(label: context.l10n.receiptNo, value: r.receiptNo),
                    InfoRow(
                      label: context.l10n.date,
                      value: Fmt.dateTime(r.paidAt),
                    ),
                    InfoRow(
                      label: context.l10n.student,
                      value: '${r.studentName} (${r.studentId})',
                    ),
                    InfoRow(
                      label: context.l10n.classLabel,
                      value: [
                        r.className?.split('-').first,
                        if (r.section != null)
                          context.l10n.sectionName(r.section ?? ''),
                        if (r.roll != null) context.l10n.rollNo('${r.roll}'),
                      ].whereType<String>().join(' • '),
                    ),
                    InfoRow(label: context.l10n.method, value: r.method),
                    if (r.reference != null)
                      InfoRow(
                        label: context.l10n.reference,
                        value: r.reference,
                      ),
                    const Divider(height: 24),
                    for (final l in r.lines)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${l.feeHead}${l.billingMonth != null ? ' (${Fmt.monthLabel(Fmt.month(l.billingMonth!))})' : ''}',
                              ),
                            ),
                            Text(
                              Fmt.money(l.amount),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    const Divider(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            context.l10n.totalPaid2,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        Text(
                          Fmt.money(r.total),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                            color: AppColors.navy,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => _download(context, r),
              icon: const Icon(Icons.download_rounded),
              label: Text(context.l10n.downloadReceiptPdf),
            ),
          ],
        ),
      ),
    );
  }
}
