import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../l10n/app_localizations.dart';

import '../../config/app_config.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/school.dart';
import '../../models/support.dart';
import '../../providers/auth_provider.dart';
import '../../providers/family_provider.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../services/push_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../widgets/language_switch.dart';
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
      appBar: AppBar(title: Text(AppLocalizations.of(context).profileTitle)),
      body: AsyncView<_ProfileData>(
        key: ValueKey(_version),
        load: () => _load(service),
        builder: (context, d, reload) {
          final p = d.profile;
          final s = d.school;
          final child = family.selectedChild;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Row(
                      children: [
                        PersonAvatar(
                          name: p.name,
                          photoUrl: p.photoUrl,
                          radius: 32,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.name,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                '${p.relation ?? 'Guardian'} • ${family.children.length} ${family.children.length == 1 ? 'child' : 'children'}',
                                style: const TextStyle(color: AppColors.muted),
                              ),
                              if (p.lastLoginAt != null)
                                Text(
                                  'Last login ${Fmt.dateTime(p.lastLoginAt)}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 12,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: AppLocalizations.of(context).contactInformation,
                  icon: Icons.contact_phone_outlined,
                  action: TextButton.icon(
                    onPressed: () async {
                      final saved = await Navigator.push<bool>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => EditProfileScreen(profile: p),
                        ),
                      );
                      if (saved == true && mounted) {
                        setState(() => _version++);
                      }
                    },
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: Text(AppLocalizations.of(context).edit),
                  ),
                  child: Column(
                    children: [
                      InfoRow(label: 'Login email', value: p.loginEmail),
                      InfoRow(label: 'Registered mobile', value: p.mobile),
                      InfoRow(label: 'Alternate mobile', value: p.altMobile),
                      InfoRow(label: 'Occupation', value: p.occupation),
                      InfoRow(
                        label: 'Emergency contact',
                        value: p.emergencyContact,
                      ),
                      InfoRow(label: 'Address', value: p.address),
                      const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: Text(
                          'Login email and registered mobile can only be changed by the school office.',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: AppLocalizations.of(context).otherGuardianContacts,
                  icon: Icons.groups_outlined,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (p.otherGuardians.isEmpty)
                        const Text(
                          'No other guardians are linked to your children.',
                          style: TextStyle(color: AppColors.muted),
                        )
                      else
                        for (final g in p.otherGuardians)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: PersonAvatar(name: g.name, radius: 18),
                            title: Text(
                              g.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Text(
                              '${g.relation}${g.children != null ? ' of ${g.children}' : ''}\n${g.mobile}',
                            ),
                            isThreeLine: true,
                            trailing: IconButton(
                              icon: const Icon(Icons.call_outlined),
                              onPressed: () => files.call(g.mobile),
                            ),
                          ),
                      // Workflow §8: only authorised school admins add, link or change guardians.
                      const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: Text(
                          'To add a guardian or change their details, contact the school office.',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: AppLocalizations.of(context).schoolContact,
                  icon: Icons.apartment_rounded,
                  child: Column(
                    children: [
                      InfoRow(label: 'School', value: s.name),
                      InfoRow(label: 'Address', value: s.address),
                      InfoRow(
                        label: 'Phone',
                        value: s.phone,
                        onTap: s.phone == null
                            ? null
                            : () => files.call(s.phone!),
                      ),
                      InfoRow(
                        label: 'Email',
                        value: s.email,
                        onTap: s.email == null
                            ? null
                            : () => files.email(s.email!),
                      ),
                      if (s.website != null)
                        InfoRow(
                          label: 'Website',
                          value: s.website,
                          onTap: () => files.openUrl(
                            s.website!.startsWith('http')
                                ? s.website!
                                : 'https://${s.website}',
                          ),
                        ),
                      if (s.emergencyContact != null)
                        InfoRow(
                          label: 'Emergency',
                          value: s.emergencyContact,
                          onTap: () => files.call(s.emergencyContact!),
                        ),
                      if (s.principalName != null)
                        InfoRow(
                          label: s.principalTitle ?? 'Principal',
                          value: s.principalName,
                        ),
                    ],
                  ),
                ),
                SectionTitle(AppLocalizations.of(context).support),
                Card(
                  child: Column(
                    children: [
                      if (child != null)
                        ListTile(
                          leading: const Icon(Icons.event_busy_outlined),
                          title: Text(
                            AppLocalizations.of(context).leaveApplication,
                          ),
                          subtitle: Text('On behalf of ${child.name}'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => LeaveScreen(child: child),
                            ),
                          ),
                        ),
                      ListTile(
                        leading: const Icon(Icons.report_problem_outlined),
                        title: Text(
                          AppLocalizations.of(context).complaintsFeedback,
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                ComplaintScreen(initialStudentId: child?.id),
                          ),
                        ),
                      ),
                      if (child != null)
                        ListTile(
                          leading: const Icon(Icons.folder_outlined),
                          title: Text(
                            AppLocalizations.of(context).downloadDocuments,
                          ),
                          subtitle: Text(child.name),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => DocumentsScreen(child: child),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                SectionTitle(AppLocalizations.of(context).language),
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(12),
                    child: Center(child: LanguageSwitch()),
                  ),
                ),
                SectionTitle(AppLocalizations.of(context).security),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.password_rounded),
                        title: Text(
                          AppLocalizations.of(context).changePassword,
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute<void>(
                            builder: (_) => const ChangePasswordScreen(),
                          ),
                        ),
                      ),
                      ListTile(
                        leading: const Icon(Icons.devices_other_outlined),
                        title: Text(
                          AppLocalizations.of(context).signOutAllDevices,
                        ),
                        onTap: () =>
                            _confirmLogout(context, auth, allDevices: true),
                      ),
                      ListTile(
                        leading: const Icon(
                          Icons.logout_rounded,
                          color: AppColors.danger,
                        ),
                        title: Text(
                          AppLocalizations.of(context).logout,
                          style: const TextStyle(
                            color: AppColors.danger,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        onTap: () => _confirmLogout(context, auth),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Center(
                  child: Text(
                    AppConfig.appName,
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ),
                const Center(
                  child: Text(
                    AppConfig.versionLabel,
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmLogout(
    BuildContext context,
    AuthProvider auth, {
    bool allDevices = false,
  }) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          allDevices
              ? AppLocalizations.of(context).logoutAllTitle
              : AppLocalizations.of(context).logoutTitle,
        ),
        content: Text(
          allDevices
              ? AppLocalizations.of(context).logoutAllBody
              : AppLocalizations.of(context).logoutBody,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(AppLocalizations.of(context).cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(AppLocalizations.of(context).logout),
          ),
        ],
      ),
    );
    if (ok != true) return;
    // Stop push to this phone before the session ends (shared phones get no stale alerts).
    if (context.mounted) await context.read<PushService>().stop();
    await auth.logout(allDevices: allDevices);
  }
}
