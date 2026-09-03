import 'notification_service.dart';
import 'http_school_service.dart';
import 'http_user_service.dart';

/// Bundles every service the app needs so they can be passed once through
/// [ServicesScope] and accessed via `context.services.<x>` from anywhere.
class AppServices {
  AppServices({
    required this.notifications,
    required this.schools,
    required this.users,
  });

  final NotificationService notifications;
  final HttpSchoolService schools;
  final HttpUserService users;
}
