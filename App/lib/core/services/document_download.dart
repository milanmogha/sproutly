import 'dart:io';

import 'package:dio/dio.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../network/dio_client.dart';

/// How a download ended, so callers can say something useful.
enum DownloadOutcome {
  /// Saved and handed to a viewer.
  opened,

  /// Saved, but the device has nothing that opens a PDF.
  savedOnly,
  notAllowed,
  failed,
}

/// Fetches a document the API streams and opens it on the device.
///
/// Goes through Dio rather than a browser hand-off because these endpoints
/// need the bearer token; a plain URL would arrive unauthenticated. Files land
/// in the app's own documents directory, which needs no storage permission on
/// any supported Android version.
class DocumentDownload {
  const DocumentDownload._();

  /// Downloads [path] and opens it. [fallbackName] is used only when the
  /// server doesn't name the file itself.
  static Future<DownloadOutcome> open({
    required String path,
    required String fallbackName,
  }) async {
    try {
      final res = await DioClient.instance.dio.get<List<int>>(
        path,
        options: Options(
          responseType: ResponseType.bytes,
          // Let a 4xx come back as a response so it can be told apart from a
          // network failure, rather than surfacing as a generic error.
          validateStatus: (code) => code != null && code < 500,
        ),
      );

      if (res.statusCode == 403) return DownloadOutcome.notAllowed;
      if (res.statusCode != 200 || res.data == null) {
        return DownloadOutcome.failed;
      }

      final name = _fileName(res.headers.value('content-disposition')) ??
          fallbackName;
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/$name');
      await file.writeAsBytes(res.data!, flush: true);

      final result = await OpenFilex.open(file.path);
      return result.type == ResultType.done
          ? DownloadOutcome.opened
          : DownloadOutcome.savedOnly;
    } catch (_) {
      return DownloadOutcome.failed;
    }
  }

  /// Reads `attachment; filename="Fee-Receipt-INV-1.pdf"`.
  static String? _fileName(String? contentDisposition) {
    if (contentDisposition == null) return null;
    final match =
        RegExp(r'filename="?([^";]+)"?', caseSensitive: false)
            .firstMatch(contentDisposition);
    final name = match?.group(1)?.trim();
    if (name == null || name.isEmpty) return null;
    // Never let a server-supplied name escape the directory it is written to.
    return name.replaceAll(RegExp(r'[\\/]+'), '_');
  }
}
