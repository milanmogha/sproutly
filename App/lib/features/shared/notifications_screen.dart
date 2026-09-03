import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import '../../core/models/app_notification.dart';
import '../../core/services/notification_service.dart';
import '../../core/services/services_scope.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/atoms.dart';
import '../../routing/notification_router.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  NotificationService? _service;
  StreamSubscription<void>? _sub;
  List<AppNotification> _items = const [];
  bool _loading = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_service == null) {
      _service = context.services.notifications;
      _sub = _service!.changes.listen((_) => _refresh());
      _refresh();
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    final svc = _service;
    if (svc == null) return;
    try {
      final items = await svc.fetchAll();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markRead(AppNotification n) async {
    if (!n.unread) return;
    setState(() {
      _items = [
        for (final item in _items)
          if (item.id == n.id) item.copyWith(unread: false) else item,
      ];
    });
    try {
      await _service?.markRead(n.id);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _items = [
          for (final item in _items)
            if (item.id == n.id) item.copyWith(unread: true) else item,
        ];
      });
    }
  }

  /// Marks the notification read, then opens whatever it points at — the chat
  /// thread, the circular, the student's profile, the right tab. The
  /// type → destination map lives in `notification_router.dart` because it is
  /// role-dependent.
  Future<void> _onTap(AppNotification n) async {
    await _markRead(n);
    if (!mounted) return;
    await openNotification(context, n);
  }

  Future<void> _markAll() async {
    if (!_items.any((n) => n.unread)) return;
    final backup = List<AppNotification>.from(_items);
    setState(() {
      _items = [for (final n in _items) n.copyWith(unread: false)];
    });
    try {
      await _service?.markAllRead();
    } catch (_) {
      if (!mounted) return;
      setState(() => _items = backup);
      AppToast.show(context, 'Could not mark notifications as read',
          type: ToastType.error);
    }
  }

  Future<void> _dismiss(AppNotification n) async {
    await _service?.dismiss(n.id);
  }

  Future<void> _clearRead() async {
    final readIds = _items.where((n) => !n.unread).map((n) => n.id).toSet();
    if (readIds.isEmpty) return;
    final backup = List<AppNotification>.from(_items);
    setState(() {
      _items = _items.where((n) => n.unread).toList();
    });
    try {
      await _service?.dismissRead();
    } catch (_) {
      if (!mounted) return;
      setState(() => _items = backup);
      AppToast.show(context, 'Could not clear notifications',
          type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Group by relative bucket.
    final groups = <String, List<AppNotification>>{};
    for (final n in _items) {
      groups.putIfAbsent(n.group, () => []).add(n);
    }
    final groupKeys = groups.keys.toList();

    return Scaffold(
      backgroundColor: AppColors.softWhite,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: AppColors.softWhite,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Notifications',
            style: TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.textDark)),
        iconTheme: const IconThemeData(color: AppColors.textDark),
        actions: [
          TextButton(
            onPressed:
                _items.any((n) => n.unread) ? _markAll : null,
            child: const Text(
              'Mark all read',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          TextButton(
            onPressed:
                _items.any((n) => !n.unread) ? _clearRead : null,
            child: Text(
              'Clear',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: _items.any((n) => !n.unread)
                    ? AppColors.danger
                    : null,
              ),
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? const _EmptyNotifs()
              : RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics()),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  itemCount: groupKeys.length,
                  itemBuilder: (_, gi) {
                    final label = groupKeys[gi];
                    final items = groups[label]!;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding:
                              const EdgeInsets.fromLTRB(4, 12, 4, 8),
                          child: Text(label,
                              style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                  letterSpacing: 0.4)),
                        ),
                        for (int i = 0; i < items.length; i++)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _NotifTile(
                              item: items[i],
                              onTap: () => _onTap(items[i]),
                              onDismissed: () => _dismiss(items[i]),
                            )
                                .animate(delay: Duration(milliseconds: 40 * i))
                                .fadeIn(duration: 280.ms)
                                .slideY(begin: 0.05),
                          ),
                      ],
                    );
                  },
                )),
    );
  }
}

class _EmptyNotifs extends StatelessWidget {
  const _EmptyNotifs();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🔔', style: TextStyle(fontSize: 64)),
            const SizedBox(height: 12),
            const Text(
              'All caught up',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'No notifications right now.',
              style: TextStyle(
                color: AppColors.textMuted.withValues(alpha: 0.9),
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotifTile extends StatelessWidget {
  const _NotifTile({
    required this.item,
    required this.onTap,
    required this.onDismissed,
  });
  final AppNotification item;
  final VoidCallback onTap;
  final Future<void> Function() onDismissed;

  @override
  Widget build(BuildContext context) {
    final tint = item.unread
        ? Color(item.iconColorValue).withValues(alpha: 0.08)
        : Colors.white;
    final iconColor = Color(item.iconColorValue);
    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Icon(Iconsax.trash, color: Colors.white),
      ),
      onDismissed: (_) => onDismissed(),
      child: Material(
        color: tint,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: AppShadows.card,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    iconDataForName(item.icon),
                    color: iconColor,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(item.title,
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark)),
                          ),
                          Text(item.time,
                              style: const TextStyle(
                                  color: AppColors.textMuted, fontSize: 11)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(item.body,
                          style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textMuted,
                              height: 1.4)),
                    ],
                  ),
                ),
                if (item.unread) ...[
                  const SizedBox(width: 8),
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(top: 6),
                    decoration: BoxDecoration(
                      color: iconColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
