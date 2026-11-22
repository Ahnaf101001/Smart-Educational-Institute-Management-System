import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_exception.dart';
import 'change_password_screen.dart';

/// Opened from the `aeroschool://reset-password?token=…` link in the reset email
/// (Workflow §6 steps 4–6): set a new password, then sign in with it.
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.token});

  final String token;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AuthProvider>().resetPassword(
        widget.token,
        _next.text,
      );
      if (mounted) setState(() => _done = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Reset password')),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: _done
                ? Column(
                    children: [
                      const Icon(
                        Icons.check_circle_outline_rounded,
                        size: 64,
                        color: AppColors.success,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Your password has been changed.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Sign in with your new password.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted),
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Go to login'),
                      ),
                    ],
                  )
                : Form(
                    key: _form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Choose a new password for your guardian account.',
                          style: TextStyle(color: AppColors.muted),
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: _next,
                          obscureText: _obscure,
                          decoration: InputDecoration(
                            labelText: 'New password',
                            helperText: 'At least 8 characters with letters and numbers',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                            ),
                          ),
                          validator: ChangePasswordScreenValidators.strength,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _confirm,
                          obscureText: _obscure,
                          decoration: const InputDecoration(
                            labelText: 'Confirm new password',
                            prefixIcon: Icon(Icons.lock_outline),
                          ),
                          validator: (v) => v != _next.text
                              ? 'Passwords do not match.'
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
                        const SizedBox(height: 20),
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
                              : const Text('Save new password'),
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
