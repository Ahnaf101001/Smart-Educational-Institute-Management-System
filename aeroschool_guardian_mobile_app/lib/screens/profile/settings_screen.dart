import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../core/format.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../l10n/l10n_ext.dart';
import '../../models/campus.dart';
import '../../providers/app_lock_provider.dart';
import '../../services/api_exception.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../../widgets/language_switch.dart';
import '../../widgets/pin_pad.dart';

/// App settings (GA-23 / NF-44 / GA-05v1): language, app lock PIN, signed-in
/// devices and the privacy policy.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  int _devicesVersion = 0;

  Future<void> _setPin() async {
    final pin = await Navigator.push<String>(
      context,
      MaterialPageRoute<String>(builder: (_) => const _SetPinScreen()),
    );
    if (pin == null || !mounted) return;
    await context.read<AppLockProvider>().setPin(pin);
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(context.l10n.appLockOn)));
  }

  Future<void> _disable() async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.turnOffAppLock),
        content: Text(l.turnOffAppLockBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l.turnOff),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await context.read<AppLockProvider>().disable();
  }

  Future<void> _signOutDevice(DeviceSession s) async {
    final messenger = ScaffoldMessenger.of(context);
    final l = context.l10n;
    try {
      await context.read<GuardianService>().signOutSession(s.id);
      messenger.showSnackBar(SnackBar(content: Text(l.deviceSignedOut)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
    if (mounted) setState(() => _devicesVersion++);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lock = context.watch<AppLockProvider>();
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    return Scaffold(
      appBar: AppBar(title: Text(l.settings)),
      body: StaggeredListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          SectionTitle(l.language),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: LanguageSwitch()),
            ),
          ),
          SectionTitle(l.appLock),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  secondary: const Icon(Icons.lock_outline),
                  title: Text(l.appLockPin),
                  subtitle: Text(l.appLockHint),
                  value: lock.enabled,
                  onChanged: (on) => on ? _setPin() : _disable(),
                ),
                if (lock.enabled)
                  ListTile(
                    leading: const Icon(Icons.pin_outlined),
                    title: Text(l.changePin),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: _setPin,
                  ),
              ],
            ),
          ),
          SectionTitle(l.signedInDevices),
          Card(
            child: AsyncView<List<DeviceSession>>(
              key: ValueKey(_devicesVersion),
              load: service.sessions,
              builder: (context, sessions, reload) => Column(
                children: [
                  if (sessions.isEmpty)
                    EmptyView(title: l.noDevices, icon: Icons.devices_outlined),
                  for (final s in sessions)
                    ListTile(
                      leading: Icon(
                        s.label == 'Guardian app'
                            ? Icons.smartphone_rounded
                            : Icons.computer_rounded,
                        color: s.current ? AppColors.success : AppColors.navy,
                      ),
                      title: Text(
                        s.label == 'Guardian app'
                            ? l.guardianAppDevice
                            : s.label,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        [
                          l.lastActive(Fmt.relative(s.lastSeenAt)),
                          if (s.ip != null) s.ip!,
                        ].join(' • '),
                      ),
                      trailing: s.current
                          ? StatusChip(l.thisDevice, color: AppColors.success)
                          : TextButton(
                              onPressed: () => _signOutDevice(s),
                              child: Text(l.signOut),
                            ),
                    ),
                ],
              ),
            ),
          ),
          SectionTitle(l.about),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined),
                  title: Text(l.privacyPolicy),
                  trailing: const Icon(Icons.open_in_new, size: 18),
                  onTap: () => files.openUrl('${AppConfig.webAppUrl}/privacy'),
                ),
                const ListTile(
                  leading: Icon(Icons.info_outline),
                  title: Text(AppConfig.appName),
                  subtitle: Text(AppConfig.versionLabel),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Two-step PIN set-up: enter, then confirm. Pops with the PIN.
class _SetPinScreen extends StatefulWidget {
  const _SetPinScreen();

  @override
  State<_SetPinScreen> createState() => _SetPinScreenState();
}

class _SetPinScreenState extends State<_SetPinScreen> {
  String? _first;
  String? _error;

  void _onPin(String pin) {
    if (_first == null) {
      setState(() {
        _first = pin;
        _error = null;
      });
      return;
    }
    if (pin == _first) {
      Navigator.pop(context, pin);
    } else {
      setState(() {
        _first = null;
        _error = context.l10n.pinMismatch;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.appLockPin)),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _first == null ? l.chooseNewPin : l.confirmPin,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 24),
              PinPad(
                key: ValueKey(_first == null),
                onCompleted: _onPin,
                error: _error,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
