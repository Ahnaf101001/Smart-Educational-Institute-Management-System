import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'providers/auth_provider.dart';
import 'providers/family_provider.dart';
import 'providers/notification_provider.dart';
import 'services/api_client.dart';
import 'services/file_service.dart';
import 'services/guardian_service.dart';
import 'services/receipt_pdf_service.dart';
import 'services/token_storage.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final tokens = TokenStorage();
  final api = ApiClient(tokens: tokens);
  final guardian = GuardianService(api);

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        Provider<GuardianService>.value(value: guardian),
        Provider<FileService>(create: (_) => FileService()),
        Provider<ReceiptPdfService>(create: (_) => ReceiptPdfService()),
        ChangeNotifierProvider(create: (_) => AuthProvider(api: api, tokens: tokens)..restore()),
        ChangeNotifierProvider(create: (_) => FamilyProvider(guardian)),
        ChangeNotifierProvider(create: (_) => NotificationProvider(guardian)),
      ],
      child: const AeroSchoolGuardianApp(),
    ),
  );
}
