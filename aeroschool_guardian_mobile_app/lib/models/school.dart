import '../core/format.dart';

/// Institution contact and branding (from `institute_profile`).
class SchoolInfo {
  SchoolInfo({
    required this.name,
    this.nameBn,
    this.address,
    this.phone,
    this.email,
    this.website,
    this.logoUrl,
    this.principalName,
    this.principalTitle,
    this.emergencyContact,
    this.motto,
  });

  final String name;
  final String? nameBn;
  final String? address;
  final String? phone;
  final String? email;
  final String? website;
  final String? logoUrl;
  final String? principalName;
  final String? principalTitle;
  final String? emergencyContact;
  final String? motto;

  factory SchoolInfo.fromJson(Map<String, dynamic> j) => SchoolInfo(
        name: J.str(j['name'], 'School'),
        nameBn: J.strOrNull(j['nameBn']),
        address: J.strOrNull(j['address']),
        phone: J.strOrNull(j['phone']),
        email: J.strOrNull(j['email']),
        website: J.strOrNull(j['website']),
        logoUrl: J.strOrNull(j['logoUrl']),
        principalName: J.strOrNull(j['principalName']),
        principalTitle: J.strOrNull(j['principalTitle']),
        emergencyContact: J.strOrNull(j['emergencyContact']),
        motto: J.strOrNull(j['motto']),
      );

  static SchoolInfo empty() => SchoolInfo(name: 'School');
}
