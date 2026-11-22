import '../core/format.dart';

/// The signed-in account returned by `/auth/login` and `/auth/me`.
class SessionUser {
  SessionUser({
    required this.id,
    required this.name,
    required this.email,
    required this.linkedType,
    required this.linkedId,
    required this.mustChangePassword,
    this.phone,
    this.lastLoginAt,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? linkedType;
  final String? linkedId;
  final bool mustChangePassword;
  final DateTime? lastLoginAt;

  bool get isGuardian =>
      linkedType == 'Guardian' && (linkedId?.isNotEmpty ?? false);

  factory SessionUser.fromJson(Map<String, dynamic> j) => SessionUser(
    id: J.str(j['id']),
    name: J.str(j['name'], 'Guardian'),
    email: J.str(j['email']),
    phone: J.strOrNull(j['phone']),
    linkedType: J.strOrNull(j['linkedType']),
    linkedId: J.strOrNull(j['linkedId']),
    mustChangePassword: J.boolOf(j['mustChangePassword']),
    lastLoginAt: J.date(j['lastLoginAt']),
  );
}
