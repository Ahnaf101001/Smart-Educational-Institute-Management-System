import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../core/validators.dart';
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
  // Errors stay hidden until the first submit; after that each field re-checks as it is edited,
  // so a corrected field clears its message straight away.
  bool _showErrors = false;
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

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) {
      setState(() => _showErrors = true);
      return;
    }
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
                autovalidateMode: _showErrors
                    ? AutovalidateMode.onUserInteraction
                    : AutovalidateMode.disabled,
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
                      validator: (v) =>
                          Validators.passwordStrength(v, context.l10n),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _confirm,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: context.l10n.confirmNewPassword,
                        prefixIcon: const Icon(Icons.lock_outline),
                      ),
                      validator: (v) => Validators.passwordsMatch(
                        v,
                        _next.text,
                        context.l10n,
                      ),
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          context.l10n.word(_error!),
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
