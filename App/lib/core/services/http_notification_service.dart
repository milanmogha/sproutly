import 'dart:async';

import '../models/app_notification.dart';
import '../network/dio_client.dart';
import 'notification_service.dart';

/// Real-backend notifications, shared by every role (GET /notifications/me
/// is scoped to the signed-in user).
class HttpNotificationService implements NotificationService {
  final _changes = StreamController<void>.broadcast();

  @override
  Stream<void> get changes => _changes.stream;

  @override
  Future<List<AppNotification>> fetchAll() async {
    final res = await DioClient.instance.dio
        .get<Map<String, dynamic>>('/notifications/me');
    final raw = DioClient.unwrap<dynamic>(res);
    return (raw as List<dynamic>? ?? [])
        .map((e) => _fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> markRead(String id) async {
    await DioClient.instance.dio.patch<dynamic>('/notifications/$id/read');
    _changes.add(null);
  }

  @override
  Future<void> markAllRead() async {
    await DioClient.instance.dio.patch<dynamic>('/notifications/read-all');
    _changes.add(null);
  }

  @override
  Future<void> dismiss(String id) async {
    await DioClient.instance.dio.delete<dynamic>('/notifications/$id');
    _changes.add(null);
  }

  @override
  Future<void> dismissRead() async {
    await DioClient.instance.dio.delete<dynamic>('/notifications/clear-read');
    _changes.add(null);
  }

  static AppNotification _fromJson(Map<String, dynamic> j) {
    final type = j['type'] as String? ?? '';
    final (icon, color) = _style(type);
    final created = DateTime.tryParse(
      (j['createdAt'] ?? j['sentAt'] ?? '') as String,
    )?.toLocal();
    final (time, group) = _when(created);
    return AppNotification(
      id: j['_id'] as String? ?? '',
      icon: icon,
      iconColorValue: color,
      title: j['title'] as String? ?? '',
      body: j['body'] as String? ?? '',
      time: time,
      group: group,
      unread: !(j['read'] as bool? ?? false),
      type: type,
      data: j['data'] is Map<String, dynamic>
          ? j['data'] as Map<String, dynamic>
          : const {},
    );
  }

  /// Icon + tint by notification type (icon names resolved by
  /// [iconDataForName]).
  static (String, int) _style(String type) {
    if (type.contains('attendance')) return ('tick_circle', 0xFF22C78E);
    if (type.contains('message') ||
        type.contains('circular') ||
        type.contains('profile')) {
      return ('message', 0xFF3B82F6);
    }
    if (type.contains('homework') || type.contains('academic')) {
      return ('book', 0xFFF59E0B);
    }
    if (type.contains('ptm') || type.contains('event') ||
        type.contains('leave')) {
      return ('calendar', 0xFF013E37);
    }
    return ('bell', 0xFF6B7280);
  }

  /// Relative time label + Today/Yesterday/Earlier bucket.
  static (String, String) _when(DateTime? d) {
    if (d == null) return ('', 'Earlier');
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    if (day == today) {
      final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
      final m = d.minute.toString().padLeft(2, '0');
      return ('$h:$m ${d.hour < 12 ? 'AM' : 'PM'}', 'Today');
    }
    if (day == today.subtract(const Duration(days: 1))) {
      return ('Yesterday', 'Yesterday');
    }
    return ('${today.difference(day).inDays}d ago', 'Earlier');
  }
}
