import 'package:material_ui/material_ui.dart';

import '../core/theme.dart';
import 'common.dart';

/// AeroSchool brand mark (graduation cap in a rounded tile).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 56, this.light = false});

  final double size;
  final bool light;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: light ? Colors.white : AppColors.navy,
      borderRadius: BorderRadius.circular(size * 0.28),
    ),
    child: Icon(
      Icons.school_rounded,
      size: size * 0.58,
      color: light ? AppColors.navy : Colors.white,
    ),
  );
}

/// School logo from the institution profile, falling back to the brand mark.
class SchoolLogo extends StatelessWidget {
  const SchoolLogo({super.key, this.logoUrl, this.size = 64});

  final String? logoUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = PersonAvatar.resolve(logoUrl);
    if (url == null) return BrandMark(size: size);
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.22),
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => BrandMark(size: size),
      ),
    );
  }
}
