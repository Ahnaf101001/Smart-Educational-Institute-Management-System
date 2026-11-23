import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_exception.dart';

/// Forgot password (workflow §6): enter the login email; the server emails a
/// secure, single-use reset link. Nobody – not even the admin – can see the
/// existing password.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.initialEmail = ''});

  final String initialEmail;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _email = TextEditingController(
    text: widget.initialEmail,
  );
  bool _busy = false;
  String? _done;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final msg = await context.read<AuthProvider>().forgotPassword(
        _email.text,
      );
      if (mounted) setState(() => _done = msg);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(context.l10n.forgotPassword)),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: _done != null
                ? Column(
                    children: [
                      const Icon(
                        Icons.mark_email_read_outlined,
                        size: 64,
                        color: AppColors.success,
                      ),
                      const SizedBox(height: 16),
                      Text(_done!, textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      Text(
                        context.l10n.openTheLinkInThe,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.muted),
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: () => Navigator.pop(context),
                        child: Text(context.l10n.backToLogin),
                      ),
                    ],
                  )
                : Form(
                    key: _form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          context.l10n.enterYourLoginEmailWe,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(
                            labelText: context.l10n.loginEmail2,
                            prefixIcon: const Icon(Icons.alternate_email),
                          ),
                          validator: (v) => (v ?? '').trim().contains('@')
                              ? null
                              : context.l10n.loginInvalidEmail,
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
                              : Text(context.l10n.sendResetLink),
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
