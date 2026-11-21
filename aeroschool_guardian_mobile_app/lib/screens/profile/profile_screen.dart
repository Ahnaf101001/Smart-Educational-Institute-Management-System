import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/school.dart';
import '../../models/support.dart';
import '../../providers/auth_provider.dart';
import '../../providers/family_provider.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../auth/change_password_screen.dart';
import '../support/complaint_screen.dart';
import '../support/documents_screen.dart';
import '../support/leave_screen.dart';
import 'edit_profile_screen.dart';

typedef _ProfileData = ({GuardianProfile profile, SchoolInfo school});

/// Guardian profile & support (spec §J, workflow §10).
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  int _version = 0;

  Future<_ProfileData> _load(GuardianService s) async {
    final profile = await s.profile();
    final school = await s.school();
    return (profile: profile, school: school);
  }

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    final auth = context.read<AuthProvider>();
    final family = context.watch<FamilyProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: AsyncView<_ProfileData>(
        key: ValueKey(_version),
        load: () => _load(service),
        builder: (context, d, reload) {
          final p = d.profile;
          final s = d.school;
          final child = family.selectedChild;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(children: [
                    PersonAvatar(name: p.name, photoUrl: p.photoUrl, radius: 32),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(p.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                        Text('${p.relation ?? 'Guardian'} • ${family.children.length} ${family.children.length == 1 ? 'child' : 'children'}',
                            style: const TextStyle(color: AppColors.muted)),
                        if (p.lastLoginAt != null) Text('Last login ${Fmt.dateTime(p.lastLoginAt)}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                      ]),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'Contact Information',
                icon: Icons.contact_phone_outlined,
                action: TextButton.icon(
                  onPressed: () async {
                    final saved = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => EditProfileScreen(profile: p)));
                    if (saved == true) setState(() => _version++);
                  },
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Edit'),
                ),
                child: Column(children: [
                  InfoRow(label: 'Login email', value: p.loginEmail),
                  InfoRow(label: 'Registered mobile', value: p.mobile),
                  InfoRow(label: 'Alternate mobile', value: p.altMobile),
                  InfoRow(label: 'Occupation', value: p.occupation),
                  InfoRow(label: 'Emergency contact', value: p.emergencyContact),
                  InfoRow(label: 'Address', value: p.address),
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text('Login email and registered mobile can only be changed by the school office.', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                  ),
                ]),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'Other Guardian Contacts',
                icon: Icons.groups_outlined,
                child: p.otherGuardians.isEmpty
                    ? const Text('No other guardians are linked to your children.', style: TextStyle(color: AppColors.muted))
                    : Column(children: [
                        for (final g in p.otherGuardians)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: PersonAvatar(name: g.name, radius: 18),
                            title: Text(g.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text('${g.relation}${g.children != null ? ' of ${g.children}' : ''}\n${g.mobile}'),
                            isThreeLine: true,
                            trailing: IconButton(icon: const Icon(Icons.call_outlined), onPressed: () => files.call(g.mobile)),
                          ),
                      ]),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'School Contact',
                icon: Icons.apartment_rounded,
                child: Column(children: [
                  InfoRow(label: 'School', value: s.name),
                  InfoRow(label: 'Address', value: s.address),
                  InfoRow(label: 'Phone', value: s.phone, onTap: s.phone == null ? null : () => files.call(s.phone!)),
                  InfoRow(label: 'Email', value: s.email, onTap: s.email == null ? null : () => files.email(s.email!)),
                  if (s.website != null) InfoRow(label: 'Website', value: s.website, onTap: () => files.openUrl(s.website!.startsWith('http') ? s.website! : 'https://${s.website}')),
                  if (s.emergencyContact != null) InfoRow(label: 'Emergency', value: s.emergencyContact, onTap: () => files.call(s.emergencyContact!)),
                  if (s.principalName != null) InfoRow(label: s.principalTitle ?? 'Principal', value: s.principalName),
                ]),
              ),
              const SectionTitle('Support'),
              Card(
                child: Column(children: [
                  if (child != null)
                    ListTile(
                      leading: const Icon(Icons.event_busy_outlined),
                      title: const Text('Leave application'),
                      subtitle: Text('On behalf of ${child.name}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => LeaveScreen(child: child))),
                    ),
                  ListTile(
                    leading: const Icon(Icons.report_problem_outlined),
                    title: const Text('Complaints & feedback'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ComplaintScreen(initialStudentId: child?.id))),
                  ),
                  if (child != null)
                    ListTile(
                      leading: const Icon(Icons.folder_outlined),
                      title: const Text('Download documents'),
                      subtitle: Text(child.name),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => DocumentsScreen(child: child))),
                    ),
                ]),
              ),
              const SectionTitle('Security'),
              Card(
                child: Column(children: [
                  ListTile(
                    leading: const Icon(Icons.password_rounded),
                    title: const Text('Change password'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const ChangePasswordScreen())),
                  ),
                  ListTile(
                    leading: const Icon(Icons.devices_other_outlined),
                    title: const Text('Sign out of all devices'),
                    onTap: () => _confirmLogout(context, auth, allDevices: true),
                  ),
                  ListTile(
                    leading: const Icon(Icons.logout_rounded, color: AppColors.danger),
                    title: const Text('Logout', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700)),
                    onTap: () => _confirmLogout(context, auth),
                  ),
                ]),
              ),
              const SizedBox(height: 16),
              const Center(child: Text(AppConfig.appName, style: TextStyle(color: AppColors.muted, fontSize: 12))),
            ]),
          );
        },
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, AuthProvider auth, {bool allDevices = false}) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(allDevices ? 'Sign out everywhere?' : 'Logout?'),
        content: Text(allDevices ? 'You will be signed out on every phone and browser.' : 'You will need your email and password to sign in again.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Logout')),
        ],
      ),
    );
    if (ok == true) await auth.logout(allDevices: allDevices);
  }
}
