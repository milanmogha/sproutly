import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import '../models/app_notification.dart';

/// Backend-agnostic surface for fetching / mutating notifications.
/// Satisfied by [HttpNotificationService] for every role.
abstract class NotificationService {
  Stream<void> get changes;
  Future<List<AppNotification>> fetchAll();
  Future<void> markRead(String id);
  Future<void> markAllRead();
  Future<void> dismiss(String id);
  Future<void> dismissRead();
}

/// Resolves a stored icon name to a Flutter [IconData] for rendering.
IconData iconDataForName(String name) {
  switch (name) {
    case 'tick_circle':
      return Icons.check_circle_rounded;
    case 'message':
      return Iconsax.message;
    case 'book':
      return Icons.menu_book_rounded;
    case 'calendar':
      return Icons.calendar_month_rounded;
    default:
      return Icons.notifications_rounded;
  }
}