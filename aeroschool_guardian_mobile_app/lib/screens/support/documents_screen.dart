import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/support.dart';
import '../../services/api_exception.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../fees/fees_screen.dart';

typedef _Docs = ({
  List<StudentDocument> documents,
  List<IssuedCertificate> certificates,
});

/// Download documents uploaded by the school for this student, and see
/// issued certificates. Receipts and marksheets download from Fees / Results.
class DocumentsScreen extends StatelessWidget {
  const DocumentsScreen({super.key, required this.child});

  final ChildSummary child;

  Future<void> _download(BuildContext context, StudentDocument d) async {
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    showSnack(context, 'Downloading ${d.fileName}…');
    try {
      final bytes = await service.downloadDocument(child.id, d.id);
      await files.shareBytes(bytes, fileName: d.fileName, mimeType: d.mimeType);
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    } catch (_) {
      if (context.mounted) {
        showSnack(context, 'Could not save the file.', error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    return Scaffold(
      appBar: AppBar(title: Text('Documents – ${child.name}')),
      body: AsyncView<_Docs>(
        load: () => service.documents(child.id),
        builder: (context, d, reload) => RefreshIndicator(
          onRefresh: reload,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const SectionTitle('Student Documents'),
              Card(
                child: d.documents.isEmpty
                    ? const EmptyView(
                        title: 'No documents shared yet',
                        icon: Icons.folder_open_outlined,
                      )
                    : Column(
                        children: [
                          for (final doc in d.documents)
                            ListTile(
                              leading: Icon(
                                (doc.mimeType ?? '').contains('pdf')
                                    ? Icons.picture_as_pdf_outlined
                                    : Icons.insert_drive_file_outlined,
                                color: AppColors.navy,
                              ),
                              title: Text(
                                doc.type,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              subtitle: Text(
                                [
                                  doc.fileName,
                                  doc.sizeLabel,
                                  Fmt.date(doc.createdAt),
                                ].where((s) => s.isNotEmpty).join(' • '),
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.download_rounded),
                                onPressed: () => _download(context, doc),
                              ),
                            ),
                        ],
                      ),
              ),
              const SectionTitle('Issued Certificates'),
              Card(
                child: d.certificates.isEmpty
                    ? const EmptyView(
                        title: 'No certificates issued',
                        icon: Icons.workspace_premium_outlined,
                      )
                    : Column(
                        children: [
                          for (final c in d.certificates)
                            ListTile(
                              leading: const Icon(
                                Icons.workspace_premium_outlined,
                                color: AppColors.success,
                              ),
                              title: Text(
                                c.type,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              subtitle: Text(
                                'Issued ${Fmt.date(c.issuedAt)} • Collect the signed copy from the school office',
                              ),
                            ),
                        ],
                      ),
              ),
              const SectionTitle('Other downloads'),
              Card(
                child: ListTile(
                  leading: const Icon(
                    Icons.receipt_long_outlined,
                    color: AppColors.navy,
                  ),
                  title: const Text('Fee receipts'),
                  subtitle: const Text('Download from Fees → Payment History'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => FeesScreen(child: child),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
