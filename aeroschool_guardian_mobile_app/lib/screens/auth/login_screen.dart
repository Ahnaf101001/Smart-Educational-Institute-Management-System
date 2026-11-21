import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../models/school.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_exception.dart';
import '../../services/file_service.dart';
import '../../services/token_storage.dart';
import '../../widgets/async_view.dart';
import '../../widgets/brand.dart';
import 'forgot_password_screen.dart';

/// Login screen (workflow §2): school logo, AeroSchool branding, email,
/// password with show/hide, remember me, forgot password, login and
/// contact school. Guardians cannot sign up – accounts come from the school.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _remember = true;
  bool _busy = false;
  String? _error;
  bool _inactive = false;
  SchoolInfo? _school;

  @override
  void initState() {
    super.initState();
    _prefill();
    final auth = context.read<AuthProvider>();
    auth.service.publicSchool().then((s) {
      if (mounted) setState(() => _school = s);
    }).catchError((_) {});
    final msg = auth.takeSessionMessage();
    if (msg != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) showSnack(context, msg);
      });
    }
  }

  Future<void> _prefill() async {
    final saved = await TokenStorage().readRememberedLogin();
    if (!mounted) return;
    setState(() {
      _remember = saved.remember;
      if (saved.email != null) _email.text = saved.email!;
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _inactive = false;
    });
    try {
      await context.read<AuthProvider>().login(_email.text, _password.text, rememberMe: _remember);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _inactive = e.isAccountInactive;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _contactSchool() {
    final s = _school;
    final files = context.read<FileService>();
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s?.name ?? 'Contact School', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
            if (s?.address != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(s!.address!, style: const TextStyle(color: AppColors.muted))),
            const SizedBox(height: 12),
            const Text('Guardian accounts are created by the school. Contact the office for login details or if your account is inactive.'),
            const SizedBox(height: 8),
            if (s?.phone != null)
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.call), title: Text(s!.phone!), onTap: () => files.call(s.phone!)),
            if (s?.email != null)
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.email_outlined), title: Text(s!.email!), onTap: () => files.email(s.email!)),
            if (s == null || (s.phone == null && s.email == null)) const Text('Please visit the school office.', style: TextStyle(color: AppColors.muted)),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Center(child: SchoolLogo(logoUrl: _school?.logoUrl, size: 76)),
                  const SizedBox(height: 14),
                  Text(_school?.name ?? 'Your School', textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  const Text('AEROSCHOOL • GUARDIAN APP', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, letterSpacing: 1.6, fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 28),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email, AutofillHints.username],
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Email address', prefixIcon: Icon(Icons.alternate_email)),
                    validator: (v) {
                      final s = (v ?? '').trim();
                      if (s.isEmpty) return 'Enter your login email.';
                      if (!s.contains('@') && !RegExp(r'^\+?\d{10,14}$').hasMatch(s)) return 'Enter a valid email address.';
                      return null;
                    },
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _password,
                    obscureText: _obscure,
                    autofillHints: const [AutofillHints.password],
                    onFieldSubmitted: (_) => _submit(),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        tooltip: _obscure ? 'Show password' : 'Hide password',
                        icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) => (v ?? '').length < 6 ? 'Enter your password.' : null,
                  ),
                  const SizedBox(height: 6),
                  Row(children: [
                    Checkbox(value: _remember, onChanged: (v) => setState(() => _remember = v ?? true)),
                    const Text('Remember me'),
                    const Spacer(),
                    TextButton(
                      onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ForgotPasswordScreen(initialEmail: _email.text))),
                      child: const Text('Forgot password?'),
                    ),
                  ]),
                  if (_error != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10)),
                      child: Row(children: [
                        Icon(_inactive ? Icons.support_agent : Icons.error_outline, color: AppColors.danger),
                        const SizedBox(width: 10),
                        Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.danger))),
                      ]),
                    ),
                    if (_inactive) TextButton(onPressed: _contactSchool, child: const Text('Contact school')),
                  ],
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                        : const Text('Login'),
                  ),
                  const SizedBox(height: 18),
                  OutlinedButton.icon(onPressed: _contactSchool, icon: const Icon(Icons.support_agent), label: const Text('Contact School')),
                  const SizedBox(height: 18),
                  const Text(
                    'Guardian accounts are created by the school.\nYou cannot register from this app.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
