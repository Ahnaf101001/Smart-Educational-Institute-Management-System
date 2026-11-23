import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import '../../core/theme.dart';
import '../../widgets/brand.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.navy,
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const BrandMark(size: 72, light: true),
          const SizedBox(height: 20),
          const Text(
            'AeroSchool',
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            context.l10n.guardianMobileApp,
            style: const TextStyle(color: Color(0xFFBFD3EA)),
          ),
          const SizedBox(height: 28),
          const SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(
              color: Colors.white,
              strokeWidth: 2.5,
            ),
          ),
        ],
      ),
    ),
  );
}
