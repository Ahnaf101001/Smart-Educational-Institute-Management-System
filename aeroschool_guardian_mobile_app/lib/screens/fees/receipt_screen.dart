import 'package:material_ui/material_ui.dart';
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
        showSnack(context, 'Could not create the receipt PDF.', error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    return Scaffold(
      appBar: AppBar(title: Text('Receipt $receiptNo')),
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
                      r.schoolName ?? 'School',
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
                    InfoRow(label: 'Receipt no.', value: r.receiptNo),
                    InfoRow(label: 'Date', value: Fmt.dateTime(r.paidAt)),
                    InfoRow(
                      label: 'Student',
                      value: '${r.studentName} (${r.studentId})',
                    ),
                    InfoRow(
                      label: 'Class',
                      value: [
                        r.className?.split('-').first,
                        if (r.section != null) 'Section ${r.section}',
                        if (r.roll != null) 'Roll ${r.roll}',
                      ].whereType<String>().join(' • '),
                    ),
                    InfoRow(label: 'Method', value: r.method),
                    if (r.reference != null)
                      InfoRow(label: 'Reference', value: r.reference),
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
                        const Expanded(
                          child: Text(
                            'Total paid',
                            style: TextStyle(fontWeight: FontWeight.w800),
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
              label: const Text('Download receipt (PDF)'),
            ),
          ],
        ),
      ),
    );
  }
}
