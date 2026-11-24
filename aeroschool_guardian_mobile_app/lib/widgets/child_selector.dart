import 'package:material_ui/material_ui.dart';

import '../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';

import '../core/theme.dart';
import '../models/child.dart';
import '../providers/family_provider.dart';
import 'common.dart';

/// "SELECT YOUR CHILD – Rahim – Class 8 ▾": switching the child changes the
/// whole dashboard (Guardian App spec §3, workflow §5).
class ChildSelector extends StatelessWidget {
  const ChildSelector({super.key, this.dark = false});

  final bool dark;

  @override
  Widget build(BuildContext context) {
    final family = context.watch<FamilyProvider>();
    final child = family.selectedChild;
    if (child == null) return const SizedBox.shrink();
    final fg = dark ? Colors.white : AppColors.navy;
    return Material(
      color: dark
          ? Colors.white.withValues(alpha: 0.12)
          : AppColors.surfaceTint,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: family.children.length < 2
            ? null
            : () => showChildPicker(context),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              PersonAvatar(
                name: child.name,
                photoUrl: child.photoUrl,
                radius: 16,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.selectYourChild,
                      style: TextStyle(
                        fontSize: 10,
                        letterSpacing: 1,
                        color: fg.withValues(alpha: 0.7),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '${child.name} – ${child.classLine}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: fg, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
              if (family.children.length > 1)
                Icon(Icons.expand_more_rounded, color: fg),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> showChildPicker(BuildContext context) async {
  final family = context.read<FamilyProvider>();
  final picked = await showModalBottomSheet<ChildSummary>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(
              AppLocalizations.of(sheetContext).myChildrenTitle,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
            ),
          ),
          for (final c in family.children)
            ListTile(
              leading: PersonAvatar(name: c.name, photoUrl: c.photoUrl),
              title: Text(
                c.name,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(c.classLine),
              trailing: c.id == family.selectedChild?.id
                  ? const Icon(Icons.check_circle, color: AppColors.success)
                  : null,
              onTap: () => Navigator.pop(sheetContext, c),
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
  if (picked != null) family.selectChild(picked.id);
}
