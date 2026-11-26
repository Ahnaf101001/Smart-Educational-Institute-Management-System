import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../l10n/l10n_ext.dart';
import '../providers/app_lock_provider.dart';
import '../providers/auth_provider.dart';
import 'brand.dart';
import 'pin_pad.dart';

/// Covers the whole app (including pushed screens) with the PIN screen while
/// the app lock is engaged for a signed-in guardian.
class AppLockGate extends StatelessWidget {
  const AppLockGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final lock = context.watch<AppLockProvider>();
    final signedIn =
        context.watch<AuthProvider>().status == AuthStatus.signedIn;
    final show = signedIn && lock.locked;
    return Stack(
      children: [
        // Keep the app underneath alive but hidden from screen readers while locked.
        ExcludeSemantics(excluding: show, child: child),
        if (show) const Positioned.fill(child: _LockScreen()),
      ],
    );
  }
}

class _LockScreen extends StatefulWidget {
  const _LockScreen();

  @override
  State<_LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<_LockScreen> {
  String? _error;

  void _submit(String pin) {
    final lock = context.read<AppLockProvider>();
    if (lock.unlock(pin)) return;
    setState(() {
      _error = lock.tooManyAttempts
          ? context.l10n.pinTooManyAttempts
          : context.l10n.pinWrong(
              AppLockProvider.maxAttempts - lock.failedAttempts,
            );
    });
  }

  Future<void> _signOut() async {
    final lock = context.read<AppLockProvider>();
    await context.read<AuthProvider>().logout();
    await lock.disable();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lock = context.watch<AppLockProvider>();
    return Material(
      color: AppColors.background,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const BrandMark(size: 56),
                const SizedBox(height: 16),
                Text(
                  l.enterPin,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  l.appLockedHint,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 24),
                PinPad(
                  onCompleted: _submit,
                  error: _error,
                  enabled: !lock.tooManyAttempts,
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: _signOut,
                  child: Text(l.forgotPinSignOut),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
