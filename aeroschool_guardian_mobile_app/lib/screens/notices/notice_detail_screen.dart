import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/family.dart';
import '../../services/file_service.dart';
import '../../widgets/common.dart';

class NoticeDetailScreen extends StatelessWidget {
  const NoticeDetailScreen({super.key, required this.notice});

  final Notice notice;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(context.l10n.schoolNotice)),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    if (notice.category != null)
                      StatusChip(notice.category!, color: AppColors.info),
                    if (notice.isUrgent)
                      StatusChip(
                        context.l10n.important,
                        color: AppColors.danger,
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  notice.title,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  Fmt.dateTime(notice.createdAt),
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                const Divider(height: 28),
                SelectableText(
                  notice.message,
                  style: const TextStyle(height: 1.5),
                ),
                if (notice.attachmentUrl != null) ...[
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: () => context.read<FileService>().openUrl(
                      PersonAvatar.resolve(notice.attachmentUrl)!,
                    ),
                    icon: const Icon(Icons.attach_file),
                    label: Text(context.l10n.openAttachment),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
