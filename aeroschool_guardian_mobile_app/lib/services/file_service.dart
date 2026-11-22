import 'dart:typed_data';

import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Saving/sharing downloaded files and launching phone, email, map and
/// payment links.
class FileService {
  Future<void> shareBytes(
    Uint8List bytes, {
    required String fileName,
    String? mimeType,
  }) async {
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile.fromData(bytes, name: fileName, mimeType: mimeType)],
        fileNameOverrides: [fileName],
      ),
    );
  }

  Future<bool> openUrl(String url, {bool external = true}) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return false;
    return launchUrl(
      uri,
      mode: external
          ? LaunchMode.externalApplication
          : LaunchMode.platformDefault,
    );
  }

  Future<bool> call(String phone) =>
      openUrl('tel:${phone.replaceAll(RegExp(r'[^0-9+]'), '')}');
  Future<bool> email(String address) => openUrl('mailto:$address');
  Future<bool> map(double lat, double lng) =>
      openUrl('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
}
