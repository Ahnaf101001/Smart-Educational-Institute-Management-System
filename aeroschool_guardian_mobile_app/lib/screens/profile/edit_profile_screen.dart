import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../models/support.dart';
import '../../services/api_exception.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';

/// Contact information & address management, plus notification preferences.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key, required this.profile});

  final GuardianProfile profile;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _form = GlobalKey<FormState>();
  late final _alt = TextEditingController(text: widget.profile.altMobile ?? '');
  late final _occupation = TextEditingController(
    text: widget.profile.occupation ?? '',
  );
  late final _emergency = TextEditingController(
    text: widget.profile.emergencyContact ?? '',
  );
  late final _address = TextEditingController(
    text: widget.profile.address ?? '',
  );
  late final Map<String, bool> _prefs = {
    for (final k in _prefLabels.keys) k: widget.profile.pref(k),
  };
  bool _busy = false;

  static const _prefLabels = {
    'attendance': 'Attendance alerts',
    'exam': 'Exam notifications',
    'result': 'Result notifications',
    'fee': 'Fee payment reminders',
    'homework': 'Homework notifications',
    'transport': 'Transport alerts',
    'notice': 'School notices & events',
    'sms': 'Also send by SMS (if enabled)',
    'email': 'Also send by email (if enabled)',
  };

  @override
  void dispose() {
    _alt.dispose();
    _occupation.dispose();
    _emergency.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await context.read<GuardianService>().updateProfile({
        'altMobile': _alt.text.trim(),
        'occupation': _occupation.text.trim(),
        'emergencyContact': _emergency.text.trim(),
        'address': _address.text.trim(),
        'notificationPrefs': _prefs,
      });
      if (!mounted) return;
      showSnack(context, context.l10n.profileUpdated);
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(context.l10n.editProfile)),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextFormField(
            controller: _alt,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: context.l10n.alternateMobile,
              hintText: '01XXXXXXXXX',
              prefixIcon: const Icon(Icons.phone_android),
            ),
            validator: (v) {
              final s = (v ?? '').replaceAll(RegExp(r'\D'), '');
              if (s.isEmpty) return null;
              return RegExp(r'^01[3-9]\d{8}$').hasMatch(s)
                  ? null
                  : context.l10n.enterValidBdMobile;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _occupation,
            decoration: InputDecoration(
              labelText: context.l10n.occupation,
              prefixIcon: const Icon(Icons.work_outline),
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _emergency,
            decoration: InputDecoration(
              labelText: context.l10n.emergencyContact2,
              prefixIcon: const Icon(Icons.emergency_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _address,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: context.l10n.address,
              prefixIcon: const Icon(Icons.home_outlined),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            context.l10n.notificationPreferences,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: AppColors.navy,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            context.l10n.turningATypeOffStops,
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 6),
          Card(
            child: Column(
              children: [
                for (final e in _prefLabels.entries)
                  SwitchListTile(
                    title: Text(context.l10n.word(e.value)),
                    value: _prefs[e.key] ?? true,
                    onChanged: (v) => setState(() => _prefs[e.key] = v),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: _busy
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      color: Colors.white,
                    ),
                  )
                : Text(context.l10n.saveChanges),
          ),
        ],
      ),
    ),
  );
}
