import 'dart:async';

import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../../core/services/notification_badge.dart';
import '../../core/services/services_scope.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/neu.dart';
import 'notifications_screen.dart';

/// The soft-UI bell used on the parent, teacher and admin home headers, with
/// a live unread badge. Tapping opens [NotificationsScreen] and re-counts on
/// return.
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key, this.color = AppColors.textDark});
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return UnreadBadge(
      child: NeuIconWell(
        icon: Iconsax.notification,
        color: color,
        onTap: () async {
          await Navigator.of(context)
              .push(neuRoute(const NotificationsScreen()));
          NotificationBadge.instance.refresh();
        },
      ),
    );
  }
}

/// Overlays the unread-notification count on [child] and keeps it fresh:
/// counts on mount, again whenever notifications are read/dismissed (the
/// service's change stream) and when the app returns to the foreground.
/// Renders just [child] while the count is 0.
class UnreadBadge extends StatefulWidget {
  const UnreadBadge({super.key, required this.child});
  final Widget child;

  @override
  State<UnreadBadge> createState() => _UnreadBadgeState();
}

class _UnreadBadgeState extends State<UnreadBadge>
    with WidgetsBindingObserver {
  StreamSubscription<void>? _sub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    NotificationBadge.instance.refresh();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The notifications screen mutates through this same shared service, so
    // its change stream covers mark-read, mark-all-read and dismissals.
    _sub ??= context.services.notifications.changes
        .listen((_) => NotificationBadge.instance.refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Notifications may have arrived while the app was backgrounded.
    if (state == AppLifecycleState.resumed) {
      NotificationBadge.instance.refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: NotificationBadge.instance.unread,
      child: widget.child,
      builder: (_, count, child) {
        if (count == 0) return child!;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            child!,
            Positioned(
              top: -3,
              right: -3,
              child: IgnorePointer(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  constraints:
                      const BoxConstraints(minWidth: 17, minHeight: 17),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  child: Text(
                    count > 9 ? '9+' : '$count',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      height: 1,
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
