// A sign-out while data is still loading must never leave the previous
// guardian's data in memory, and must never block the next guardian's load.
import 'dart:async';
import 'dart:convert';

import 'package:aeroschool_guardian_mobile_app/providers/family_provider.dart';
import 'package:aeroschool_guardian_mobile_app/providers/notification_provider.dart';
import 'package:aeroschool_guardian_mobile_app/services/api_client.dart';
import 'package:aeroschool_guardian_mobile_app/services/guardian_service.dart';
import 'package:aeroschool_guardian_mobile_app/services/token_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Map<String, dynamic> homeFor(String guardian, String child) => {
  'guardian': {'id': guardian, 'name': guardian},
  'children': [
    {'id': child, 'name': child},
  ],
  'notices': <Object>[],
};

http.Response ok(Object? data) => http.Response.bytes(
  utf8.encode(jsonEncode({'success': true, 'data': data})),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('a late overview from the previous guardian is discarded', () async {
    var account = 'A';
    final gate = Completer<void>();
    final client = MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/sync-state')) return ok({'version': 'v-$account'});
      if (path.endsWith('/home')) {
        final who = account;
        if (who == 'A') await gate.future; // guardian A's request is slow
        return ok(homeFor('G-$who', 'STU-$who'));
      }
      return ok(null);
    });
    final family = FamilyProvider(
      GuardianService(ApiClient(tokens: TokenStorage(), client: client)),
    );

    final slow = family.load(); // guardian A, still in flight
    family.clear(); // A signs out
    account = 'B';
    await family.load(); // guardian B signs in on the same phone
    expect(family.children.single.id, 'STU-B');

    gate.complete(); // A's response finally arrives
    await slow;
    expect(family.children.single.id, 'STU-B');
    expect(family.loading, isFalse);
  });

  test('unexpected data never escapes the provider as an exception', () async {
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/home')) return ok(['not', 'a', 'map']);
      return ok(null);
    });
    final family = FamilyProvider(
      GuardianService(ApiClient(tokens: TokenStorage(), client: client)),
    );
    await family.load();
    expect(family.loading, isFalse);
  });

  test('late unread count from the previous guardian is ignored', () async {
    final gate = Completer<void>();
    var calls = 0;
    final client = MockClient((request) async {
      calls++;
      if (calls == 1) await gate.future;
      return ok({'unread': calls == 1 ? 9 : 0});
    });
    final notifications = NotificationProvider(
      GuardianService(ApiClient(tokens: TokenStorage(), client: client)),
    );
    final slow = notifications.refreshCount();
    notifications.clear();
    gate.complete();
    await slow;
    expect(notifications.unread, 0);
  });
}
