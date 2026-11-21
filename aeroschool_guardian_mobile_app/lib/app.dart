import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import 'config/app_config.dart';
import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/family_provider.dart';
import 'providers/notification_provider.dart';
import 'screens/auth/change_password_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/splash_screen.dart';
import 'screens/home/home_shell.dart';

final GlobalKey<ScaffoldMessengerState> rootMessengerKey = GlobalKey<ScaffoldMessengerState>();

class AeroSchoolGuardianApp extends StatelessWidget {
  const AeroSchoolGuardianApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: AppConfig.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        scaffoldMessengerKey: rootMessengerKey,
        home: const AuthGate(),
      );
}

/// Routes by session state: login → (forced password change) → dashboard.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  AuthStatus? _last;

  @override
  Widget build(BuildContext context) {
    final status = context.watch<AuthProvider>().status;
    if (status != _last) {
      _last = status;
      WidgetsBinding.instance.addPostFrameCallback((_) => _onStatusChanged(status));
    }
    switch (status) {
      case AuthStatus.checking:
        return const SplashScreen();
      case AuthStatus.signedOut:
        return const LoginScreen();
      case AuthStatus.mustChangePassword:
        return const ChangePasswordScreen(forced: true);
      case AuthStatus.signedIn:
        return const HomeShell();
    }
  }

  void _onStatusChanged(AuthStatus status) {
    if (!mounted) return;
    final family = context.read<FamilyProvider>();
    final notifications = context.read<NotificationProvider>();
    // Pop any pushed screens so the new root is visible.
    Navigator.of(context).popUntil((route) => route.isFirst);
    if (status == AuthStatus.signedIn) {
      family.load();
      notifications.onNewNotifications = (n) => rootMessengerKey.currentState?.showSnackBar(
            SnackBar(
              behavior: SnackBarBehavior.floating,
              content: Text(n == 1 ? 'You have a new notification' : 'You have $n new notifications'),
            ),
          );
      notifications.startPolling();
    } else {
      family.clear();
      notifications.clear();
    }
  }
}
