import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/student.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Student information (spec §C): profile, ID/roll, class & section, photo,
/// admission info, date of birth, blood group, class teacher and emergency contact.
class StudentProfileScreen extends StatelessWidget {
  const StudentProfileScreen({super.key, required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    return Scaffold(
      appBar: AppBar(title: Text(child.name)),
      body: AsyncView<StudentProfile>(
        load: () => service.studentProfile(child.id),
        builder: (context, p, reload) => RefreshIndicator(
          onRefresh: reload,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    children: [
                      PersonAvatar(
                        name: p.name,
                        photoUrl: p.photoUrl,
                        radius: 44,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        p.name,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (p.nameBn != null)
                        Text(
                          p.nameBn!,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        alignment: WrapAlignment.center,
                        children: [
                          StatusChip('ID ${p.id}', color: AppColors.navy),
                          if (p.roll != null)
                            StatusChip('Roll ${p.roll}', color: AppColors.blue),
                          if (p.status != null) StatusChip(p.status!),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'Academic',
                icon: Icons.school_outlined,
                child: Column(
                  children: [
                    InfoRow(
                      label: 'Class',
                      value: p.className.split('-').first,
                    ),
                    InfoRow(label: 'Section', value: p.section),
                    InfoRow(label: 'Shift', value: p.shift),
                    if (p.groupName != null)
                      InfoRow(label: 'Group', value: p.groupName),
                    if (p.version != null)
                      InfoRow(label: 'Version', value: p.version),
                    InfoRow(label: 'Session', value: p.sessionName),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'Admission Information',
                icon: Icons.how_to_reg_outlined,
                child: Column(
                  children: [
                    InfoRow(
                      label: 'Admission date',
                      value: p.admissionDate == null
                          ? null
                          : Fmt.date(p.admissionDate),
                    ),
                    InfoRow(label: 'Previous school', value: p.previousSchool),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'Personal',
                icon: Icons.person_outline,
                child: Column(
                  children: [
                    InfoRow(
                      label: 'Date of birth',
                      value: p.dateOfBirth == null
                          ? null
                          : Fmt.date(p.dateOfBirth),
                    ),
                    InfoRow(label: 'Gender', value: p.gender),
                    if (p.bloodGroup != null)
                      InfoRow(label: 'Blood group', value: p.bloodGroup),
                    InfoRow(label: 'Religion', value: p.religion),
                    InfoRow(label: 'Nationality', value: p.nationality),
                    InfoRow(label: 'Address', value: p.address),
                    if (p.allergies != null)
                      InfoRow(label: 'Allergies', value: p.allergies),
                    if (p.medicalNotes != null)
                      InfoRow(label: 'Medical notes', value: p.medicalNotes),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'Assigned Class Teacher',
                icon: Icons.co_present_outlined,
                child: p.classTeacher == null
                    ? const Text(
                        'Not assigned yet',
                        style: TextStyle(color: AppColors.muted),
                      )
                    : Column(
                        children: [
                          InfoRow(label: 'Name', value: p.classTeacher),
                          if (p.classTeacherPhone != null)
                            InfoRow(
                              label: 'Phone',
                              value: p.classTeacherPhone,
                              onTap: () => files.call(p.classTeacherPhone!),
                            ),
                          if (p.classTeacherEmail != null)
                            InfoRow(
                              label: 'Email',
                              value: p.classTeacherEmail,
                              onTap: () => files.email(p.classTeacherEmail!),
                            ),
                        ],
                      ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'Emergency Contact',
                icon: Icons.emergency_outlined,
                child: Column(
                  children: [
                    if (p.emergencyName != null) ...[
                      InfoRow(
                        label: 'Name',
                        value:
                            '${p.emergencyName} (${p.emergencyRelation ?? 'Guardian'})',
                      ),
                      InfoRow(
                        label: 'Mobile',
                        value: p.emergencyMobile,
                        onTap: p.emergencyMobile == null
                            ? null
                            : () => files.call(p.emergencyMobile!),
                      ),
                    ],
                    if (p.guardians.isNotEmpty) const Divider(height: 20),
                    for (final g in p.guardians)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: PersonAvatar(name: g.name, radius: 18),
                        title: Text(
                          g.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: Text(
                          '${g.relation}${g.isPrimary ? ' • Primary' : ''} • ${g.mobile}',
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.call_outlined),
                          onPressed: () => files.call(g.mobile),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
