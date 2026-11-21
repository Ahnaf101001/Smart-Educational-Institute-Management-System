import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../core/format.dart';
import '../models/academics.dart';
import '../models/fees.dart';

/// Builds downloadable PDFs: the digital fee receipt and the online marksheet.
/// Each receipt covers one student only (fees are never mixed between children).
class ReceiptPdfService {
  static const PdfColor _navy = PdfColor.fromInt(0xFF113F6C);

  static String _plain(num v) => 'BDT ${v.round()}';

  Future<Uint8List> buildReceipt(Receipt r) async {
    final doc = pw.Document(title: 'Receipt ${r.receiptNo}', author: r.schoolName ?? 'AeroSchool');
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a5,
        margin: const pw.EdgeInsets.all(24),
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(12),
              decoration: const pw.BoxDecoration(color: _navy, borderRadius: pw.BorderRadius.all(pw.Radius.circular(6))),
              child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Text(r.schoolName ?? 'School', style: pw.TextStyle(color: PdfColors.white, fontSize: 15, fontWeight: pw.FontWeight.bold)),
                if (r.schoolAddress != null) pw.Text(r.schoolAddress!, style: const pw.TextStyle(color: PdfColors.white, fontSize: 9)),
                if (r.schoolPhone != null) pw.Text('Phone: ${r.schoolPhone}', style: const pw.TextStyle(color: PdfColors.white, fontSize: 9)),
              ]),
            ),
            pw.SizedBox(height: 12),
            pw.Text('PAYMENT RECEIPT', style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: _navy)),
            pw.SizedBox(height: 8),
            _kv('Receipt no.', r.receiptNo),
            _kv('Date', Fmt.dateTime(r.paidAt)),
            _kv('Student', '${r.studentName} (${r.studentId})'),
            _kv('Class', [r.className, if (r.section != null) 'Section ${r.section}', if (r.roll != null) 'Roll ${r.roll}'].whereType<String>().join(' • ')),
            _kv('Payment method', r.method ?? '—'),
            if (r.reference != null) _kv('Reference', r.reference!),
            if (r.status != null && r.status != 'Valid') _kv('Status', r.status!),
            pw.SizedBox(height: 10),
            pw.TableHelper.fromTextArray(
              headers: ['Fee', 'Month', 'Amount'],
              data: r.lines
                  .map((l) => [l.feeHead, l.billingMonth == null ? '—' : Fmt.monthLabel(Fmt.month(l.billingMonth!)), _plain(l.amount)])
                  .toList(),
              headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.white, fontSize: 9),
              headerDecoration: const pw.BoxDecoration(color: _navy),
              cellStyle: const pw.TextStyle(fontSize: 9),
              cellAlignments: {2: pw.Alignment.centerRight},
            ),
            pw.SizedBox(height: 8),
            pw.Align(
              alignment: pw.Alignment.centerRight,
              child: pw.Text('Total paid: ${_plain(r.total)}', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            ),
            pw.Spacer(),
            pw.Divider(color: PdfColors.grey400),
            pw.Text('This is a computer-generated receipt from the AeroSchool Guardian Mobile App.', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
          ],
        ),
      ),
    );
    return doc.save();
  }

  Future<Uint8List> buildMarksheet({required String studentName, required String classLine, required String schoolName, required ExamResult result}) async {
    final doc = pw.Document(title: '${result.examName} – $studentName');
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (context) => pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text(schoolName, style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _navy)),
          pw.Text('Academic Transcript – ${result.examName}', style: const pw.TextStyle(fontSize: 12)),
          pw.SizedBox(height: 12),
          _kv('Student', studentName),
          _kv('Class', classLine),
          if (result.publishedAt != null) _kv('Published', Fmt.date(result.publishedAt)),
          pw.SizedBox(height: 12),
          pw.TableHelper.fromTextArray(
            headers: ['Subject', 'Full marks', 'Obtained', 'Grade', 'Point'],
            data: result.subjects
                .map((s) => [
                      s.subject + (s.isFourth ? ' (4th)' : ''),
                      s.fullMarks.toString(),
                      s.absent ? 'Absent' : s.obtained.toString(),
                      s.grade,
                      s.point?.toStringAsFixed(2) ?? '—',
                    ])
                .toList(),
            headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.white, fontSize: 10),
            headerDecoration: const pw.BoxDecoration(color: _navy),
            cellStyle: const pw.TextStyle(fontSize: 10),
          ),
          pw.SizedBox(height: 12),
          _kv('Total', '${result.totalMarks ?? '—'} / ${result.maxMarks ?? '—'}'),
          _kv('Percentage', Fmt.percent(result.percentage)),
          _kv('GPA', result.gpa?.toStringAsFixed(2) ?? '—'),
          _kv('Grade', result.grade ?? '—'),
          _kv('Status', result.status ?? '—'),
          if (result.classPosition != null) _kv('Class position', '${result.classPosition}'),
          if (result.teacherComment != null) _kv('Teacher comment', result.teacherComment!),
        ]),
      ),
    );
    return doc.save();
  }

  /// Opens the platform share/save sheet (or a browser download on web).
  Future<void> share(Uint8List bytes, String fileName) => Printing.sharePdf(bytes: bytes, filename: fileName);

  static pw.Widget _kv(String k, String v) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 2),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.SizedBox(width: 95, child: pw.Text(k, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700))),
          pw.Expanded(child: pw.Text(v, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold))),
        ]),
      );
}
