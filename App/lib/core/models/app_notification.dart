/// A user-facing notification surfaced in the bell-icon dropdown.
///
/// `group` is the relative time bucket the notification lives under
/// (Today / Yesterday / Earlier). `unread` controls the tint and dot.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.icon,
    required this.iconColorValue,
    required this.title,
    required this.body,
    required this.time,
    required this.group,
    required this.unread,
    this.type = 'general',
    this.data = const {},
  });

  final String id;
  final String icon; // icon codepoint name (resolved at render time)
  final int iconColorValue; // ARGB int
  final String title;
  final String body;
  final String time;
  final String group; // "Today", "Yesterday", "Earlier"
  final bool unread;

  /// Backend notification type, e.g. 'profile_change_request'. Drives both the
  /// icon/tint and any tap-through deep-link.
  final String type;

  /// Arbitrary payload the backend attached (e.g. `{studentId}`). Used to route
  /// the user to the relevant screen when the notification is tapped.
  final Map<String, dynamic> data;

  /// The student this notification points at, when one is present.
  String? get studentId => data['studentId'] as String?;

  AppNotification copyWith({bool? unread}) => AppNotification(
        id: id,
        icon: icon,
        iconColorValue: iconColorValue,
        title: title,
        body: body,
        time: time,
        group: group,
        unread: unread ?? this.unread,
        type: type,
        data: data,
      );
}