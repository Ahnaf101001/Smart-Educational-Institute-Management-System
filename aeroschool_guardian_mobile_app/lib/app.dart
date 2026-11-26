import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import 'config/app_config.dart';
import 'core/theme.dart';
import 'l10n/app_localizations.dart';
import 'providers/auth_provider.dart';
import 'providers/locale_provider.dart';
import 'providers/family_provider.dart';
import 'providers/notification_provider.dart';
import 'screens/auth/change_password_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/auth/splash_screen.dart';
import 'screens/home/home_shell.dart';
import 'services/deep_link_service.dart';
import 'services/push_service.dart';

final GlobalKey<ScaffoldMessengerState> rootMessengerKey =
    GlobalKey<ScaffoldMessengerState>();
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

class AeroSchoolGuardianApp extends StatelessWidget {
  const AeroSchoolGuardianApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: AppConfig.appName,
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light(),
    scaffoldMessengerKey: rootMessengerKey,
    navigatorKey: rootNavigatorKey,
    // English / Bangla (N2). App strings come from the generated AppLocalizations; Material,
    // Cupertino and widget strings from material_ui's own global delegates.
    locale: context.watch<LocaleProvider>().locale,
    supportedLocales: LocaleProvider.supported,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      ...GlobalMaterialLocalizations.delegates,
    ],
    home: const AuthGate(),
  );
}

/// Routes by session state: login → (forced password change) → dashboard.
/// Also handles password-reset deep links and push notification taps.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  AuthStatus? _last;
  DeepLinkService? _links;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final links = context.read<DeepLinkService>();
    if (!identical(links, _links)) {
      _links?.removeListener(_onDeepLink);
      _links = links..addListener(_onDeepLink);
      WidgetsBinding.instance.addPostFrameCallback((_) => _onDeepLink());
    }
  }

  @override
  void dispose() {
    _links?.removeListener(_onDeepLink);
    super.dispose();
  }

  // Password reset link (Workflow §6): open the in-app reset screen.
  void _onDeepLink() {
    final token = _links?.resetToken;
    if (token == null || !mounted) return;
    _links!.takeResetToken();
    rootNavigatorKey.currentState?.push(
      MaterialPageRoute<void>(
        builder: (_) => ResetPasswordScreen(token: token),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = context.watch<AuthProvider>().status;
    if (status != _last) {
      _last = status;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _onStatusChanged(status),
      );
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
    final push = context.read<PushService>();
    // Pop any pushed screens so the new root is visible.
    rootNavigatorKey.currentState?.popUntil((route) => route.isFirst);
    if (status == AuthStatus.signedIn) {
      family.load();
      notifications.onNewNotifications = (n) =>
          rootMessengerKey.currentState?.showSnackBar(
            SnackBar(
              behavior: SnackBarBehavior.floating,
              content: Text(
                n == 1
                    ? 'You have a new notification'
                    : 'You have $n new notifications',
              ),
            ),
          );
      // Live sync: every poll also re-checks the family overview; a change
      // reloads open screens (core/live_sync.dart).
      notifications.onTick = () => family.load(silent: true);
      notifications.startPolling();
      // Background push (H7): refresh on foreground pushes, open Alerts when a push is tapped.
      push.onForegroundMessage = (m) {
        notifications.refreshCount();
        family.load(silent: true);
        final title = m.notification?.title;
        if (title != null) {
          rootMessengerKey.currentState?.showSnackBar(
            SnackBar(behavior: SnackBarBehavior.floating, content: Text(title)),
          );
        }
      };
      push.onNotificationTap = (_) {
        rootNavigatorKey.currentState?.popUntil((route) => route.isFirst);
        HomeShell.requestedTab.value = HomeShell.alertsTab;
      };
      push.start();
    } else {
      family.clear();
      notifications.clear();
    }
  }
}
