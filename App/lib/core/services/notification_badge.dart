import 'package:flutter/foundation.dart';

import 'http_notification_service.dart';

/// App-wide unread-notification count backing the bell badges on every role's
/// home screen. A singleton so non-widget code (the push service, say) can
/// nudge it without a BuildContext.
class NotificationBadge {
  NotificationBadge._();
  static final NotificationBadge instance = NotificationBadge._();

  /// Unread notifications for the signed-in user. Listen via
  /// [ValueListenableBuilder]; 0 means no badge.
  final ValueNotifier<int> unread = ValueNotifier<int>(0);

  // Stateless HTTP wrapper — /notifications/me is scoped by the auth token,
  // so a private instance counts for whoever is signed in.
  final _service = HttpNotificationService();

  /// Re-counts unread from the backend. Cheap to call often; on failure (not
  /// signed in, offline) the last known count is kept.
  Future<void> refresh() async {
    try {
      final items = await _service.fetchAll();
      unread.value = items.where((n) => n.unread).length;
    } catch (_) {
      // Keep the previous count rather than flickering the badge away.
    }
  }
}
