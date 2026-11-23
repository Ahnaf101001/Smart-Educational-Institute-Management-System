import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_exception.dart';
import '../../widgets/async_view.dart';

/// Change password. With [forced] it is the mandatory first-login step that
/// replaces the admin-issued temporary password before the dashboard opens.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, this.forced = false});

  final bool forced;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  static String? validateStrength(String? v) {
    final s = v ?? '';
    if (s.length < 8) return 'Use at least 8 characters.';
    if (!RegExp(r'[A-Za-z]').hasMatch(s) || !RegExp(r'\d').hasMatch(s)) {
      return 'Use both letters and numbers.';
    }
    return null;
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await auth.changePassword(
        currentPassword: _current.text.isEmpty ? null : _current.text,
        newPassword: _next.text,
      );
      if (!mounted) return;
      if (!widget.forced) {
        showSnack(context, context.l10n.passwordChangedSuccessfully);
        Navigator.pop(context);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final askCurrent = !widget.forced || !auth.knowsTemporaryPassword;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.forced
              ? context.l10n.setANewPassword
              : context.l10n.changePassword,
        ),
        automaticallyImplyLeading: !widget.forced,
        actions: [
          if (widget.forced)
            TextButton(
              onPressed: () => auth.logout(),
              child: Text(
                context.l10n.signOut,
                style: const TextStyle(color: Colors.white),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (widget.forced) ...[
                      const Icon(
                        Icons.lock_reset_rounded,
                        size: 56,
                        color: AppColors.navy,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        auth.user != null
                            ? context.l10n.welcomeUser(auth.user!.name)
                            : context.l10n.welcome,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        context.l10n.youSignedInWithA,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.muted),
                      ),
                      const SizedBox(height: 24),
                    ],
                    if (askCurrent) ...[
                      TextFormField(
                        controller: _current,
                        obscureText: _obscure,
                        decoration: InputDecoration(
                          labelText: widget.forced
                              ? context.l10n.temporaryPassword
                              : context.l10n.currentPassword,
                          prefixIcon: const Icon(Icons.key_outlined),
                        ),
                        validator: (v) => (v ?? '').isEmpty
                            ? context.l10n.enterCurrentPassword
                            : null,
                      ),
                      const SizedBox(height: 14),
                    ],
                    TextFormField(
                      controller: _next,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: context.l10n.newPassword,
                        helperText: context.l10n.atLeast8CharactersWith,
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) {
                        final e = validateStrength(v);
                        return e == null ? null : context.l10n.word(e);
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _confirm,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: context.l10n.confirmNewPassword,
                        prefixIcon: const Icon(Icons.lock_outline),
                      ),
                      validator: (v) => v != _next.text
                          ? context.l10n.passwordsDoNotMatch
                          : null,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: AppColors.danger),
                        ),
                      ),
                    const SizedBox(height: 22),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              widget.forced
                                  ? context.l10n.saveAndContinue
                                  : context.l10n.changePassword,
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Password rules shared by the change-password and reset-password screens.
class ChangePasswordScreenValidators {
  ChangePasswordScreenValidators._();

  static String? strength(String? v) {
    final s = v ?? '';
    if (s.length < 8) return 'Use at least 8 characters.';
    if (!RegExp(r'[A-Za-z]').hasMatch(s) || !RegExp(r'\d').hasMatch(s)) {
      return 'Use both letters and numbers.';
    }
    return null;
  }
}
