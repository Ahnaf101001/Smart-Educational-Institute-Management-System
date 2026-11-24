import 'package:material_ui/material_ui.dart';

import '../config/app_config.dart';
import '../l10n/l10n_ext.dart';
import '../core/format.dart';
import '../core/theme.dart';

/// Card with a title row and optional trailing action.
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.title,
    required this.child,
    this.icon,
    this.action,
    this.padding = const EdgeInsets.all(16),
  });

  final String title;
  final Widget child;
  final IconData? icon;
  final Widget? action;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 20, color: AppColors.navy),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ),
              ?action,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    ),
  );
}

/// Compact metric tile used on dashboards.
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color = AppColors.navy,
    this.caption,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String? caption;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            if (caption != null)
              Text(
                caption!,
                style: const TextStyle(color: AppColors.muted, fontSize: 11),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
    ),
  );
}

/// Two-column grid of [StatTile]s that adapts to narrow screens.
class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final columns = c.maxWidth > 720 ? 4 : 2;
      final width = (c.maxWidth - (columns - 1) * 10) / columns;
      return Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [for (final w in children) SizedBox(width: width, child: w)],
      );
    },
  );
}

class InfoRow extends StatelessWidget {
  const InfoRow({
    super.key,
    required this.label,
    required this.value,
    this.onTap,
    this.trailing,
  });

  final String label;
  final String? value;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              (value == null || value!.isEmpty) ? '—' : value!,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: onTap != null ? AppColors.blue : null,
              ),
            ),
          ),
          ?trailing,
        ],
      ),
    ),
  );
}

/// Coloured status pill (Present/Absent/Late, Paid/Due, Pending/Approved…).
class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.color});

  final String label;
  final Color? color;

  static Color colorFor(String status) {
    final s = status.toLowerCase();
    if ([
      'present',
      'paid',
      'approved',
      'submitted',
      'reviewed',
      'pass',
      'resolved',
      'active',
      'valid',
      'success',
      'linked',
      'issued',
    ].any(s.contains)) {
      return AppColors.success;
    }
    if ([
      'absent',
      'overdue',
      'rejected',
      'fail',
      'cancelled',
      'not submitted',
      'inactive',
    ].any(s.contains)) {
      return AppColors.danger;
    }
    if ([
      'late',
      'partial',
      'pending',
      'due',
      'open',
      'early',
    ].any(s.contains)) {
      return AppColors.warning;
    }
    if (s.contains('leave') || s.contains('holiday')) {
      return const Color(0xFF7C3AED);
    }
    return AppColors.info;
  }

  @override
  Widget build(BuildContext context) {
    final c = color ?? colorFor(label);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        context.l10n.word(label),
        style: TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }
}

/// Student/guardian photo with initials fallback. Relative upload URLs are
/// resolved against the API server.
class PersonAvatar extends StatelessWidget {
  const PersonAvatar({
    super.key,
    required this.name,
    this.photoUrl,
    this.radius = 22,
  });

  final String name;
  final String? photoUrl;
  final double radius;

  static String? resolve(String? url) {
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('http')) return url;
    // Web uploads are stored as "/api/backend/public/files/<name>" (Next.js proxy path).
    final path = url.replaceFirst('/api/backend/', '/api/v1/');
    return '${AppConfig.apiOrigin}$path';
  }

  @override
  Widget build(BuildContext context) {
    final url = resolve(photoUrl);
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.surfaceTint,
      foregroundImage: url == null ? null : NetworkImage(url),
      child: Text(
        Fmt.initials(name),
        style: TextStyle(
          color: AppColors.navy,
          fontWeight: FontWeight.w800,
          fontSize: radius * 0.7,
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 18, 2, 8),
    child: Row(
      children: [
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: AppColors.navy,
            ),
          ),
        ),
        ?trailing,
      ],
    ),
  );
}

/// Notice shown when the school has disabled a view for this guardian.
class AccessNotice extends StatelessWidget {
  const AccessNotice({
    super.key,
    required this.message,
    this.icon = Icons.lock_outline,
  });

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Card(
    color: const Color(0xFFFFF7ED),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Icon(icon, color: AppColors.warning),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Color(0xFF9A3412)),
            ),
          ),
        ],
      ),
    ),
  );
}
