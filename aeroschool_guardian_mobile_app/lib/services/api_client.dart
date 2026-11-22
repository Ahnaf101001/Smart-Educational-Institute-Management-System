import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'api_exception.dart';
import 'token_storage.dart';

/// Thin JSON client for the Smart Educational Institute Management System API.
///
/// Every response has the shape `{ success, data, message, code? }`; this
/// client unwraps `data` and turns failures into [ApiException].
class ApiClient {
  ApiClient({required this.tokens, http.Client? client})
    : _http = client ?? http.Client();

  final TokenStorage tokens;
  final http.Client _http;

  /// Called when the server rejects the session (expired, revoked, deactivated).
  void Function()? onUnauthorized;

  /// Called when the server requires the temporary password to be changed.
  void Function()? onPasswordChangeRequired;

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final q = <String, String>{};
    query?.forEach((k, v) {
      if (v != null && v.toString().isNotEmpty) q[k] = v.toString();
    });
    return Uri.parse('${AppConfig.apiBaseUrl}$path')
        .replace(queryParameters: q.isEmpty ? null : q);
  }

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (auth) {
      final token = await tokens.readToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? query,
    bool auth = true,
  }) => _send(
    () async =>
        _http.get(_uri(path, query), headers: await _headers(auth: auth)),
    auth: auth,
  );

  /// Like [get] but returns the whole `{ data, message }` envelope, for endpoints
  /// that explain empty data (e.g. results hidden until fees are cleared).
  Future<({dynamic data, String? message})> getEnvelope(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await _guard(
      () async => _http.get(_uri(path, query), headers: await _headers()),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = _decode(response);
      if (decoded is Map) {
        return (data: decoded['data'], message: decoded['message']?.toString());
      }
      return (data: decoded, message: null);
    }
    throw _toException(response, auth: true);
  }

  Future<dynamic> post(String path, {Object? body, bool auth = true}) => _send(
    () async => _http.post(
      _uri(path),
      headers: await _headers(auth: auth),
      body: jsonEncode(body ?? {}),
    ),
    auth: auth,
  );

  Future<dynamic> delete(String path, {Object? body}) => _send(
    () async => _http.delete(
      _uri(path),
      headers: await _headers(),
      body: jsonEncode(body ?? {}),
    ),
  );

  Future<dynamic> patch(String path, {Object? body}) => _send(
    () async => _http.patch(
      _uri(path),
      headers: await _headers(),
      body: jsonEncode(body ?? {}),
    ),
  );

  /// Downloads a binary file (e.g. a student document) with the session token.
  Future<Uint8List> download(String path) async {
    final response = await _guard(
      () async => _http.get(_uri(path), headers: await _headers()),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.bodyBytes;
    }
    throw _toException(response, auth: true);
  }

  Future<dynamic> _send(
    Future<http.Response> Function() request, {
    bool auth = true,
  }) async {
    final response = await _guard(request);
    if (response.statusCode == 204) return null;
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = _decode(response);
      return decoded is Map && decoded.containsKey('data')
          ? decoded['data']
          : decoded;
    }
    throw _toException(response, auth: auth);
  }

  Future<http.Response> _guard(Future<http.Response> Function() request) async {
    try {
      return await request().timeout(AppConfig.requestTimeout);
    } on TimeoutException {
      throw ApiException(
        'The server is taking too long to respond. Please try again.',
      );
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
        'Cannot reach the school server. Check your internet connection and try again.',
      );
    }
  }

  dynamic _decode(http.Response response) {
    if (response.bodyBytes.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      return null;
    }
  }

  ApiException _toException(http.Response response, {required bool auth}) {
    final decoded = _decode(response);
    final message = decoded is Map && decoded['message'] != null
        ? decoded['message'].toString()
        : 'Request failed (${response.statusCode}).';
    final code = decoded is Map ? decoded['code']?.toString() : null;
    final error = ApiException(
      message,
      statusCode: response.statusCode,
      code: code,
    );
    if (auth && error.isUnauthorized) onUnauthorized?.call();
    if (auth && error.mustChangePassword) onPasswordChangeRequired?.call();
    return error;
  }
}
