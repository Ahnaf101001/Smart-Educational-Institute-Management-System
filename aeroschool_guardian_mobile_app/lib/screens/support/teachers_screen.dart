import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/support.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../providers/family_provider.dart';
import 'messages_screen.dart';

/// Child-wise teacher information. Phone numbers appear only when the school
/// shares them (permission-based contact).
class TeachersScreen extends StatelessWidget {
  const TeachersScreen({super.key, required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    final guardianId =
        context.read<FamilyProvider>().overview?.guardianId ?? '';
    return Scaffold(
      appBar: AppBar(
        title: Text(
          context.l10n.titleForChild(context.l10n.modTeachers, child.name),
        ),
      ),
      body: AsyncView<StudentExtras>(
        load: () => service.extras(child.id),
        builder: (context, x, reload) => RefreshIndicator(
          onRefresh: reload,
          child: x.teachers.isEmpty
              ? ListView(
                  children: [
                    EmptyView(
                      title: context.l10n.teachersNotAssignedYet,
                      icon: Icons.co_present_outlined,
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: x.teachers.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final t = x.teachers[i];
                    return Card(
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        leading: PersonAvatar(name: t.name),
                        // Wrap: the "Class teacher" chip moves under long names on narrow screens.
                        title: Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              t.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            if (t.isClassTeacher)
                              StatusChip(
                                context.l10n.classTeacher2,
                                color: AppColors.navy,
                              ),
                          ],
                        ),
                        subtitle: Text(
                          [
                            t.designation,
                            t.subject,
                          ].whereType<String>().join(' • '),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              tooltip: context.l10n.message,
                              icon: const Icon(
                                Icons.chat_bubble_outline,
                                color: AppColors.navy,
                              ),
                              onPressed: () => Navigator.push(
                                context,
                                MaterialPageRoute<void>(
                                  builder: (_) => ConversationScreen(
                                    teacherId: t.id,
                                    teacherName: t.name,
                                    studentId: child.id,
                                    studentName: child.name,
                                    threadKey: threadKeyFor(
                                      guardianId,
                                      t.id,
                                      child.id,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            // Phone shown only when the school allows it (permission-based contact).
                            if (t.phone != null)
                              IconButton(
                                tooltip: context.l10n.call,
                                icon: const Icon(
                                  Icons.call_outlined,
                                  color: AppColors.success,
                                ),
                                onPressed: () => files.call(t.phone!),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
