import 'package:material_ui/material_ui.dart';

import '../../core/theme.dart';
import '../../widgets/brand.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
    backgroundColor: AppColors.navy,
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandMark(size: 72, light: true),
          SizedBox(height: 20),
          Text(
            'AeroSchool',
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            'Guardian Mobile App',
            style: TextStyle(color: Color(0xFFBFD3EA)),
          ),
          SizedBox(height: 28),
          SizedBox(
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
