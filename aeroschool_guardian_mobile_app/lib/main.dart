import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'config/app_config.dart';
import 'providers/app_lock_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/family_provider.dart';
import 'providers/locale_provider.dart';
import 'providers/notification_provider.dart';
import 'services/api_client.dart';
import 'services/deep_link_service.dart';
import 'services/push_service.dart';
import 'services/file_service.dart';
import 'services/guardian_service.dart';
import 'services/receipt_pdf_service.dart';
import 'services/token_storage.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final configError = AppConfig.releaseConfigError;
  if (configError != null) {
    runApp(_ConfigErrorApp(message: configError));
    return;
  }
  final tokens = TokenStorage();
  final api = ApiClient(tokens: tokens);
  final guardian = GuardianService(api);
  final deepLinks = DeepLinkService()..init();

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        Provider<GuardianService>.value(value: guardian),
        Provider<FileService>(create: (_) => FileService()),
        Provider<ReceiptPdfService>(create: (_) => ReceiptPdfService()),
        ChangeNotifierProvider<DeepLinkService>.value(value: deepLinks),
        ChangeNotifierProvider(
          create: (_) => LocaleProvider()
            ..load()
            // Keep the account's language preference in sync (used for SMS / notifications).
            ..onChanged = (code) => api
                .patch('/auth/preferences', body: {'preferredLanguage': code})
                .catchError((_) => null),
        ),
        Provider<PushService>(create: (_) => PushService(guardian)),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(api: api, tokens: tokens)..restore(),
        ),
        ChangeNotifierProvider(create: (_) => AppLockProvider()..load()),
        ChangeNotifierProvider(create: (_) => FamilyProvider(guardian)),
        ChangeNotifierProvider(create: (_) => NotificationProvider(guardian)),
      ],
      child: const AeroSchoolGuardianApp(),
    ),
  );
}

/// Shown instead of the app when a release build was made without a valid server address.
class _ConfigErrorApp extends StatelessWidget {
  const _ConfigErrorApp({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: AppConfig.appName,
    debugShowCheckedModeBanner: false,
    home: Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.settings_suggest_outlined, size: 56),
                const SizedBox(height: 16),
                const Text(
                  'App configuration missing',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(message, textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
