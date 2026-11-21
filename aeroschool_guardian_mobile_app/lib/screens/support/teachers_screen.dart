import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/support.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Child-wise teacher information. Phone numbers appear only when the school
/// shares them (permission-based contact).
class TeachersScreen extends StatelessWidget {
  const TeachersScreen({super.key, required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    return Scaffold(
      appBar: AppBar(title: Text('Teachers – ${child.name}')),
      body: AsyncView<StudentExtras>(
        load: () => service.extras(child.id),
        builder: (context, x, reload) => RefreshIndicator(
          onRefresh: reload,
          child: x.teachers.isEmpty
              ? ListView(children: const [EmptyView(title: 'Teachers not assigned yet', icon: Icons.co_present_outlined)])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: x.teachers.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final t = x.teachers[i];
                    return Card(
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        leading: PersonAvatar(name: t.name),
                        title: Row(children: [
                          Flexible(child: Text(t.name, style: const TextStyle(fontWeight: FontWeight.w800))),
                          if (t.isClassTeacher) ...[const SizedBox(width: 6), const StatusChip('Class teacher', color: AppColors.navy)],
                        ]),
                        subtitle: Text([t.designation, t.subject].whereType<String>().join(' • ')),
                        trailing: t.phone == null
                            ? null
                            : IconButton(icon: const Icon(Icons.call_outlined, color: AppColors.success), onPressed: () => files.call(t.phone!)),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
