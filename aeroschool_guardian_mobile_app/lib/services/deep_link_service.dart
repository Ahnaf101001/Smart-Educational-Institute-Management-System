import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

/// Handles `aeroschool://` deep links:
/// * `aeroschool://payment-return?status=success&id=<txn uuid>` – sent by the backend
///   after bKash / Nagad / SSLCommerz (or the sandbox) so the app verifies the payment
///   automatically (Workflow v2 §7).
/// * `aeroschool://reset-password?token=<token>` – opens the in-app password reset
///   (Workflow §6), with the website page as fallback.
class DeepLinkService extends ChangeNotifier {
  DeepLinkService({AppLinks? appLinks})
    : _appLinks = kIsWeb ? null : (appLinks ?? AppLinks());

  static const String scheme = 'aeroschool';
  static const String paymentReturnUrl = '$scheme://payment-return';

  final AppLinks? _appLinks;
  StreamSubscription<Uri>? _sub;

  Uri? _paymentReturn;
  String? _resetToken;

  /// Latest payment-return link (cleared by [takePaymentReturn]).
  Uri? get paymentReturn => _paymentReturn;

  /// Pending password-reset token from a link (cleared by [takeResetToken]).
  String? get resetToken => _resetToken;

  Future<void> init() async {
    final links = _appLinks;
    if (links == null) return;
    try {
      final initial = await links.getInitialLink();
      if (initial != null) handle(initial);
    } catch (_) {}
    _sub = links.uriLinkStream.listen(handle, onError: (_) {});
  }

  @visibleForTesting
  void handle(Uri uri) {
    if (uri.scheme != scheme) return;
    final target = uri.host.isNotEmpty
        ? uri.host
        : (uri.pathSegments.isNotEmpty ? uri.pathSegments.first : '');
    if (target == 'payment-return') {
      _paymentReturn = uri;
      notifyListeners();
    } else if (target == 'reset-password') {
      final token = uri.queryParameters['token'];
      if (token != null && token.isNotEmpty) {
        _resetToken = token;
        notifyListeners();
      }
    }
  }

  Uri? takePaymentReturn() {
    final u = _paymentReturn;
    _paymentReturn = null;
    return u;
  }

  String? takeResetToken() {
    final t = _resetToken;
    _resetToken = null;
    return t;
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
