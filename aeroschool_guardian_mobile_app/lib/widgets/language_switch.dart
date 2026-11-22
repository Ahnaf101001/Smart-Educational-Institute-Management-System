import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../providers/locale_provider.dart';

/// English / বাংলা toggle (N2). Used on the login screen and in the profile.
class LanguageSwitch extends StatelessWidget {
  const LanguageSwitch({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final locale = context.watch<LocaleProvider>();
    final current = locale.isBangla ? 'bn' : 'en';
    final l = AppLocalizations.of(context);
    return SegmentedButton<String>(
      showSelectedIcon: false,
      style: compact
          ? const ButtonStyle(visualDensity: VisualDensity.compact)
          : null,
      segments: [
        ButtonSegment(
          value: 'en',
          label: Text(compact ? 'EN' : l.languageEnglish),
        ),
        ButtonSegment(
          value: 'bn',
          label: Text(compact ? 'বাং' : l.languageBangla),
        ),
      ],
      selected: {current},
      onSelectionChanged: (s) => locale.setLanguage(s.first),
    );
  }
}
