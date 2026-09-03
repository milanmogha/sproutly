import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax/iconsax.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/auth_api.dart';
import '../../../core/network/parent_api.dart';
import '../../../core/network/socket_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';
import '../../shared/confirm_logout.dart';
import '../../shared/privacy_policy_screen.dart';
import 'parent_student_profile.dart';

/// More-tab grid + nested sub-screens (Communication, Transport, Gallery, etc.)
class ParentMoreScreen extends StatelessWidget {
  const ParentMoreScreen({super.key});

  static const _tiles = [
    _MoreTile(
      label: 'Profile',
      emoji: '👤',
      color: AppColors.parentPrimary,
      tint: AppColors.parentTint,
    ),
    _MoreTile(
      label: 'Communication',
      emoji: '💬',
      color: AppColors.parentPrimary,
      tint: AppColors.parentTint,
    ),
    _MoreTile(
      label: 'Gallery',
      emoji: '📸',
      color: AppColors.info,
      tint: Color(0xFFE6F7FF),
    ),
    _MoreTile(
      label: 'Events',
      emoji: '🎉',
      color: AppColors.warning,
      tint: Color(0xFFFFF6D9),
    ),
    _MoreTile(
      label: 'Transport',
      emoji: '🚌',
      color: AppColors.danger,
      tint: Color(0xFFFFE4E1),
    ),
    _MoreTile(
      label: 'Daycare',
      emoji: '🧸',
      color: AppColors.success,
      tint: Color(0xFFE8FFE3),
    ),
    _MoreTile(
      label: 'Leave',
      emoji: '🌴',
      color: AppColors.info,
      tint: Color(0xFFE6F7FF),
    ),
    _MoreTile(
      label: 'Achievements',
      emoji: '🏆',
      color: AppColors.warning,
      tint: Color(0xFFFFF6D9),
    ),
    _MoreTile(
      label: 'Settings',
      emoji: '⚙️',
      color: AppColors.textMuted,
      tint: AppColors.mutedGray,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text(
          'More',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.textDark,
          ),
        ),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        physics: const BouncingScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.05,
        ),
        itemCount: _tiles.length,
        itemBuilder: (_, i) {
          final t = _tiles[i];
          return _MoreCard(
                tile: t,
                onTap: () {
                  switch (t.label) {
                    case 'Profile':
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ParentStudentProfileScreen(),
                        ),
                      );
                      break;
                    case 'Communication':
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ParentCommunicationScreen(),
                        ),
                      );
                      break;
                    case 'Transport':
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const _TransportScreen(),
                        ),
                      );
                      break;
                    case 'Gallery':
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const _GalleryScreen(),
                        ),
                      );
                      break;
                    case 'Events':
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ParentEventsScreen(),
                        ),
                      );
                      break;
                    case 'Leave':
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const _LeaveScreen()),
                      );
                      break;
                    case 'Achievements':
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const _AchievementsScreen(),
                        ),
                      );
                      break;
                    case 'Daycare':
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const _DaycareScreen(),
                        ),
                      );
                      break;
                    case 'Settings':
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const _SettingsScreen(),
                        ),
                      );
                      break;
                  }
                },
              )
              .animate(delay: Duration(milliseconds: 30 * i))
              .fadeIn(duration: 280.ms)
              .slideY(begin: 0.05);
        },
      ),
    );
  }
}

class _MoreTile {
  const _MoreTile({
    required this.label,
    required this.emoji,
    required this.color,
    required this.tint,
  });
  final String label;
  final String emoji;
  final Color color;
  final Color tint;
}

class _MoreCard extends StatelessWidget {
  const _MoreCard({required this.tile, required this.onTap});
  final _MoreTile tile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return NeuCard(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(tile.emoji, style: const TextStyle(fontSize: 36)),
          const SizedBox(height: 8),
          Text(
            tile.label,
            style: TextStyle(
              color: tile.color,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ============== Sub-screens ==============

/// Messages / Circulars / PTM. Public, and openable on a given tab, so a
/// tapped circular notification can land straight on the Circulars list.
class ParentCommunicationScreen extends StatelessWidget {
  const ParentCommunicationScreen({super.key, this.initialTab = 0});

  /// 0 = Messages, 1 = Circulars, 2 = PTM.
  final int initialTab;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      initialIndex: initialTab,
      child: Scaffold(
        backgroundColor: Neu.bg,
        appBar: AppBar(
          automaticallyImplyLeading: true,
          backgroundColor: Neu.bg,
          elevation: 0,
          title: const Text('Communication'),
          bottom: const TabBar(
            indicatorColor: AppColors.parentPrimary,
            labelColor: AppColors.parentPrimary,
            unselectedLabelColor: AppColors.textMuted,
            tabs: [
              Tab(text: 'Messages'),
              Tab(text: 'Circulars'),
              Tab(text: 'PTM'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [_MessagesTab(), _CircularsList(), _PtmList()],
        ),
      ),
    );
  }
}

// ── Messages tab ─────────────────────────────────────────────

/// Inbox of conversations between the parent and the people they have
/// messaged (typically the class teacher). Each row is one other party;
/// tap to open the full thread screen.
class _MessagesTab extends StatefulWidget {
  const _MessagesTab();

  @override
  State<_MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<_MessagesTab> {
  late Future<List<ChatThreadModel>> _future;

  SocketService get _socket => SocketService.instance;

  @override
  void initState() {
    super.initState();
    _future = ParentApi.instance.chatThreads();

    // Keep the thread list live while the parent sits on it: an incoming
    // message should bump its thread without a manual pull-to-refresh.
    _socket.connect();
    _socket.onNewMessage = (_) => _reload();
  }

  @override
  void dispose() {
    _socket.onNewMessage = null;
    super.dispose();
  }

  void _reload() {
    if (!mounted) return;
    setState(() {
      _future = ParentApi.instance.chatThreads();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNewMessage,
        backgroundColor: AppColors.parentPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Iconsax.message_add),
        label: const Text('New'),
      ),
      body: FutureBuilder<List<ChatThreadModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final threads = snap.data ?? const <ChatThreadModel>[];
          if (threads.isEmpty) {
            return const EmptyState(
              emoji: '💬',
              title: 'No messages yet',
              subtitle:
                  "Message your child's teacher or the school office.",
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              setState(() {
                _future = ParentApi.instance.chatThreads();
              });
            },
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              itemCount: threads.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final t = threads[i];
                return _MessageThreadTile(
                  otherName: t.name,
                  otherId: t.userId,
                  // Tells an office thread apart from the class teacher's.
                  roleLabel: t.role == 'teacher' ? null : t.roleLabel,
                  lastMessage: t.lastMessage,
                  lastAt: t.lastAt,
                  unread: t.unread,
                  onTap: () => _openThread(t),
                );
              },
            ),
          );
        },
      ),
    );
  }

  void _openThread(ChatThreadModel t) {
    Navigator.of(context)
        .push(
          neuRoute<void>(
            ParentChatThreadScreen(
              otherId: t.userId,
              otherName: t.name,
              accent: AppColors.parentPrimary,
            ),
          ),
        )
        .then((_) {
          if (!mounted) return;
          _reload();
          // The thread screen took over the socket callback while open;
          // reclaim it so the list keeps updating live.
          _socket.onNewMessage = (_) => _reload();
        });
  }

  /// Two people a parent can write to: their child's class teacher (about that
  /// child) and the school office (for anything the teacher can't settle).
  Future<void> _openNewMessage() async {
    final child = ParentApi.instance.selectedChild.value;

    // The class teacher is only reachable once a child is selected and that
    // child has a class with a teacher on it. The office always is.
    ({String id, String name})? teacher;
    if (child != null && (child.classId ?? '').isNotEmpty) {
      final klass = await ParentApi.instance.getClass(child.classId!);
      if (!mounted) return;
      if (klass != null && klass.hasTeacher) {
        teacher = (
          id: klass.classTeacherId!,
          name: klass.classTeacherName ?? 'Class teacher',
        );
      }
    }

    List<ChatContactModel> office = const [];
    try {
      office = await ParentApi.instance.chatContacts();
    } catch (_) {}
    if (!mounted) return;

    if (teacher == null && office.isEmpty) {
      AppToast.show(
        context,
        'No one to message yet',
        type: ToastType.info,
      );
      return;
    }

    final picked = await showAppBottomSheet<({String id, String name, bool isTeacher})>(
      context: context,
      child: SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.7,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(24, 8, 24, 12),
                child: Text(
                  'New message',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.only(bottom: 16),
                  children: [
                    if (teacher != null) ...[
                      const _SheetHeader('Class teacher'),
                      _PickerRow(
                        label: teacher.name,
                        subtitle: child == null
                            ? null
                            : 'About ${child.fullName}',
                        onTap: () => Navigator.of(context).pop((
                          id: teacher!.id,
                          name: teacher.name,
                          isTeacher: true,
                        )),
                      ),
                    ],
                    if (office.isNotEmpty) const _SheetHeader('School office'),
                    for (final a in office)
                      _PickerRow(
                        label: a.name,
                        subtitle: 'Admin',
                        onTap: () => Navigator.of(context).pop((
                          id: a.userId,
                          name: a.name,
                          isTeacher: false,
                        )),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked == null || !mounted) return;

    await Navigator.of(context).push(
      neuRoute<void>(
        ParentChatThreadScreen(
          otherId: picked.id,
          otherName: picked.name,
          accent: AppColors.parentPrimary,
          // Only a teacher thread is scoped to one child; an office query
          // isn't necessarily about a specific student.
          hint: picked.isTeacher && child != null
              ? 'Re: ${child.fullName}'
              : null,
        ),
      ),
    );
    if (!mounted) return;
    _reload();
    _socket.onNewMessage = (_) => _reload();
  }
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 4),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          color: AppColors.textMuted,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _PickerRow extends StatelessWidget {
  const _PickerRow({
    required this.label,
    required this.onTap,
    this.subtitle,
  });

  final String label;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.parentPrimary.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(19),
        ),
        alignment: Alignment.center,
        child: Text(
          label.isNotEmpty ? label[0].toUpperCase() : '?',
          style: const TextStyle(
            color: AppColors.parentPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!, style: const TextStyle(fontSize: 12)),
      onTap: onTap,
    );
  }
}

class _MessageThreadTile extends StatelessWidget {
  const _MessageThreadTile({
    required this.otherName,
    required this.otherId,
    required this.lastMessage,
    required this.unread,
    this.roleLabel,
    this.lastAt,
    required this.onTap,
  });

  final String otherName;
  final String otherId;

  /// Shown under the name for non-teacher threads (the school office), so an
  /// office conversation doesn't read like the class teacher's.
  final String? roleLabel;
  final String lastMessage;
  final int unread;
  final DateTime? lastAt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initials = _initials(otherName);
    return NeuCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.parentPrimary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(23),
            ),
            alignment: Alignment.center,
            child: Text(
              initials,
              style: const TextStyle(
                color: AppColors.parentPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        otherName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    if (lastAt != null)
                      Text(
                        _relative(lastAt!),
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
                if (roleLabel != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    roleLabel!,
                    style: const TextStyle(
                      color: AppColors.parentPrimary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: 4),
                Text(
                  lastMessage,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: unread > 0
                        ? AppColors.textDark
                        : AppColors.textMuted,
                    fontSize: 13,
                    fontWeight: unread > 0 ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
          if (unread > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.parentPrimary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$unread',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) return '?';
  if (parts.length == 1) return parts.first[0].toUpperCase();
  return (parts.first[0] + parts.last[0]).toUpperCase();
}

String _relative(DateTime when) {
  final now = DateTime.now();
  final diff = now.difference(when);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return Formatters.formatShortDate(when);
}

/// Full chat thread with one other party — real-time over Socket.IO, same
/// as the teacher/admin chat screens (live messages, typing indicator,
/// online presence, read receipts).
/// One parent↔teacher or parent↔office conversation. Public so a tapped
/// "new message" notification can open the thread directly.
class ParentChatThreadScreen extends StatefulWidget {
  const ParentChatThreadScreen({
    super.key,
    required this.otherId,
    required this.otherName,
    this.accent = AppColors.parentPrimary,
    this.hint,
  });

  final String otherId;
  final String otherName;
  final Color accent;
  final String? hint;

  @override
  State<ParentChatThreadScreen> createState() => _ParentChatThreadScreenState();
}

class _ParentChatThreadScreenState extends State<ParentChatThreadScreen> {
  final _ctl = TextEditingController();
  final _scrollCtl = ScrollController();
  final _messages = <MessageModel>[];
  bool _initialLoading = true;
  bool _sending = false;

  /// Whether the other party is currently typing.
  bool _otherTyping = false;
  Timer? _typingDebounce;

  /// Whether the other party is online (via Socket.IO presence).
  bool _otherOnline = false;

  SocketService get _socket => SocketService.instance;

  @override
  void initState() {
    super.initState();
    _loadHistory();
    _connectSocket();
  }

  Future<void> _loadHistory() async {
    try {
      final msgs = await ParentApi.instance.conversation(widget.otherId);
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(msgs);
        _initialLoading = false;
      });
      // Mark incoming unread as read (sends read receipts to the sender).
      for (final m in msgs) {
        if (!m.read && m.senderId == widget.otherId) {
          _socket.markRead(m.id);
        }
      }
    } catch (_) {
      if (mounted) setState(() => _initialLoading = false);
    }
  }

  void _connectSocket() {
    _socket.connect();
    _socket.onNewMessage = _onSocketMessage;
    _socket.onTyping = _onSocketTyping;

    // Check if the other party is already online.
    if (_socket.onlineUsers.contains(widget.otherId)) {
      _otherOnline = true;
    }
    _socket.onUserOnline = (uid) {
      if (uid == widget.otherId && mounted) {
        setState(() => _otherOnline = true);
      }
    };
    _socket.onUserOffline = (uid) {
      if (uid == widget.otherId && mounted) {
        setState(() => _otherOnline = false);
      }
    };
  }

  void _onSocketMessage(MessageModel msg) {
    if (!mounted) return;
    final me = AuthApi.instance.currentSession?.userId ?? '';
    // Only process messages belonging to this conversation.
    final inThread =
        (msg.senderId == widget.otherId && msg.recipientId == me) ||
        (msg.senderId == me && msg.recipientId == widget.otherId);
    if (!inThread) {
      // A live message from someone else while this thread is open.
      AppToast.show(
        context,
        'New message from ${msg.senderName ?? 'someone'}',
        type: ToastType.info,
      );
      return;
    }

    setState(() {
      // Avoid duplicates (in case the same msg arrived already).
      if (!_messages.any((m) => m.id == msg.id)) {
        _messages.add(msg);
      }
    });

    // Auto-mark incoming as read and send receipt.
    if (msg.senderId == widget.otherId) {
      _socket.markRead(msg.id);
    }

    WidgetsBinding.instance.addPostFrameCallback((_) => _jumpToBottom());
  }

  void _onSocketTyping(String userId, bool isTyping) {
    if (userId != widget.otherId || !mounted) return;
    setState(() => _otherTyping = isTyping);
  }

  @override
  void dispose() {
    _socket.onNewMessage = null;
    _socket.onMessageSent = null;
    _socket.onTyping = null;
    _socket.onUserOnline = null;
    _socket.onUserOffline = null;
    _ctl.dispose();
    _scrollCtl.dispose();
    _typingDebounce?.cancel();
    super.dispose();
  }

  void _onTextChanged(String text) {
    _typingDebounce?.cancel();
    _socket.sendTyping(recipientId: widget.otherId, isTyping: true);
    _typingDebounce = Timer(const Duration(seconds: 2), () {
      _socket.sendTyping(recipientId: widget.otherId, isTyping: false);
    });
  }

  void _send() {
    final text = _ctl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    _socket.sendTyping(recipientId: widget.otherId, isTyping: false);

    // Optimistic UI: add a pending message immediately.
    final optimistic = MessageModel(
      id: 'pending_${DateTime.now().millisecondsSinceEpoch}',
      senderId: AuthApi.instance.currentSession?.userId ?? '',
      recipientId: widget.otherId,
      body: text,
      senderName: 'You',
      createdAt: DateTime.now(),
    );
    setState(() {
      _messages.add(optimistic);
      _ctl.clear();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _jumpToBottom());

    // Send via Socket.IO (persists on server, relays to recipient).
    _socket.sendMessage(
      recipientId: widget.otherId,
      body: text,
      relatedStudent: ParentApi.instance.selectedChild.value?.id,
    );

    // Replace the optimistic message with the real one when confirmed.
    _socket.onMessageSent = (msg) {
      if (!mounted) return;
      setState(() {
        final idx = _messages.indexWhere((m) => m.id == optimistic.id);
        if (idx >= 0) {
          _messages[idx] = msg;
        } else if (!_messages.any((m) => m.id == msg.id)) {
          _messages.add(msg);
        }
        _sending = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _jumpToBottom());
    };

    // Fallback: if no confirmation within 10s, remove the optimistic msg.
    Future.delayed(const Duration(seconds: 10), () {
      if (!mounted) return;
      setState(() {
        _messages.removeWhere((m) => m.id == optimistic.id);
        _sending = false;
      });
    });
  }

  void _jumpToBottom() {
    if (!_scrollCtl.hasClients) return;
    _scrollCtl.animateTo(
      _scrollCtl.position.minScrollExtent,
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final me = AuthApi.instance.currentSession?.userId ?? '';
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.otherName,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: AppColors.textDark,
              ),
            ),
            if (_otherTyping)
              Text(
                'typing…',
                style: TextStyle(
                  fontSize: 11,
                  color: widget.accent,
                  fontStyle: FontStyle.italic,
                ),
              )
            else if (_otherOnline)
              const Text(
                'online',
                style: TextStyle(fontSize: 11, color: Colors.green),
              )
            else if (widget.hint != null)
              Text(
                widget.hint!,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                ),
              ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _initialLoading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? const EmptyState(
                        emoji: '💬',
                        title: 'Say hello',
                        subtitle: 'Send your first message below.',
                      )
                    : RefreshIndicator(
                        onRefresh: _loadHistory,
                        child: ListView.builder(
                          controller: _scrollCtl,
                          reverse: true,
                          physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics(),
                          ),
                          padding: const EdgeInsets.all(16),
                          itemCount: _messages.length,
                          itemBuilder: (_, i) {
                            // Reverse list: newest first in the list.
                            final idx = _messages.length - 1 - i;
                            final m = _messages[idx];
                            final mine = m.senderId == me;
                            return _chatBubble(m, mine);
                          },
                        ),
                      ),
          ),
          _sendBar(),
        ],
      ),
    );
  }

  Widget _chatBubble(MessageModel m, bool mine) {
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: const BoxConstraints(maxWidth: 280),
        decoration: BoxDecoration(
          color: mine ? widget.accent : AppColors.mutedGray,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4),
            bottomRight: Radius.circular(mine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: mine
              ? CrossAxisAlignment.end
              : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              m.body,
              style: TextStyle(
                color: mine ? Colors.white : AppColors.textDark,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (m.createdAt != null)
                  Text(
                    Formatters.formatTime(m.createdAt!),
                    style: TextStyle(
                      color: mine
                          ? Colors.white.withValues(alpha: 0.75)
                          : AppColors.textMuted,
                      fontSize: 10,
                    ),
                  ),
                if (mine && m.read) ...[
                  const SizedBox(width: 4),
                  Icon(
                    Icons.done_all,
                    size: 14,
                    color: Colors.white.withValues(alpha: 0.75),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sendBar() {
    return Container(
      color: Neu.surface,
      padding: EdgeInsets.fromLTRB(
        16,
        8,
        16,
        MediaQuery.of(context).padding.bottom + 8,
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _ctl,
              enabled: !_sending,
              minLines: 1,
              maxLines: 4,
              textInputAction: TextInputAction.send,
              onChanged: _onTextChanged,
              onSubmitted: (_) => _send(),
              decoration: InputDecoration(
                hintText: 'Type a message',
                filled: true,
                fillColor: Neu.well,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          TintedIconButton(
            icon: Icons.send_rounded,
            color: widget.accent,
            onTap: _sending ? null : _send,
          ),
        ],
      ),
    );
  }
}

class _CircularsList extends StatefulWidget {
  const _CircularsList();
  @override
  State<_CircularsList> createState() => _CircularsListState();
}

class _CircularsListState extends State<_CircularsList> {
  late Future<List<CircularModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = ParentApi.instance.getCirculars();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CircularModel>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final items = snap.data ?? const <CircularModel>[];
        if (items.isEmpty) {
          return const EmptyState(
            emoji: '📣',
            title: 'No circulars yet',
            subtitle: 'School notices will appear here.',
          );
        }
        return RefreshIndicator(
          onRefresh: () async {
            setState(() {
              _future = ParentApi.instance.getCirculars();
            });
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.all(20),
            children: [
              for (final c in items)
                _CircularCard(
                  title: c.pinned ? '📌 ${c.title}' : c.title,
                  body: c.body,
                  date: c.publishedAt == null
                      ? ''
                      : Formatters.formatShortDate(c.publishedAt!),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _CircularCard extends StatelessWidget {
  const _CircularCard({
    required this.title,
    required this.body,
    required this.date,
  });
  final String title;
  final String body;
  final String date;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: NeuCard(
        onTap: () => _showCircular(context),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ),
                Text(
                  date,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              body,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCircular(BuildContext context) {
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              date.toUpperCase(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              body,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Acknowledge',
              fullWidth: true,
              onPressed: () {
                Navigator.of(context).pop();
                AppToast.show(context, 'Acknowledged', type: ToastType.success);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _PtmList extends StatefulWidget {
  const _PtmList();
  @override
  State<_PtmList> createState() => _PtmListState();
}

/// Parent-facing PTM list — read-only by design.
///
/// The school calls parent-teacher meetings; a parent doesn't request one. So
/// there's no composer here: the parent sees the meetings a teacher has called
/// (they're also notified), and accepts or declines them. Accepting/declining
/// is *responding* to the school's request, not raising one.
class _PtmListState extends State<_PtmList> {
  late Future<List<PtmModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = ParentApi.instance.myPtmRequests();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        setState(() {
          _future = ParentApi.instance.myPtmRequests();
        });
      },
      child: FutureBuilder<List<PtmModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snap.data ?? const <PtmModel>[];
          if (items.isEmpty) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              children: const [
                SizedBox(height: 80),
                EmptyState(
                  emoji: '📅',
                  title: 'No meetings yet',
                  subtitle:
                      "You'll be notified when the school schedules a "
                      'parent-teacher meeting.',
                ),
              ],
            );
          }
          final myId = ParentApi.instance.session?.userId;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.all(20),
            children: [
              NeuCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Parent-teacher meetings',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                  for (final p in items) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (p.incomingFor(myId))
                                      const Text(
                                        'From teacher',
                                        style: TextStyle(
                                          color: AppColors.info,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    Text(
                                      p.reason,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                      ),
                                    ),
                                    if (p.preferredSlots.isNotEmpty &&
                                        p.incomingFor(myId))
                                      Text(
                                        'Suggested: ${p.preferredSlots.join(', ')}',
                                        style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                    if (p.scheduledAt != null)
                                      Text(
                                        'Scheduled ${Formatters.formatDate(p.scheduledAt!)}',
                                        style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                    if (p.responseNote != null)
                                      Text(
                                        p.responseNote!,
                                        style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              StatusChip(
                                label: _statusLabel(p.status),
                                type: _statusChip(p.status),
                              ),
                            ],
                          ),
                          // No Accept/Decline: the school decides a meeting,
                          // the parent is told the outcome. A request still
                          // awaiting the admin's decision says so.
                          if (p.status == 'requested')
                            const Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Text(
                                'Awaiting confirmation from the school',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  static String _statusLabel(String s) => switch (s) {
    'scheduled' => 'Scheduled',
    'declined' => 'Declined',
    'completed' => 'Completed',
    'cancelled' => 'Cancelled',
    _ => 'Requested',
  };

  static ChipType _statusChip(String s) => switch (s) {
    'scheduled' => ChipType.success,
    'declined' || 'cancelled' => ChipType.danger,
    'completed' => ChipType.neutral,
    _ => ChipType.warning,
  };

}

class _TransportScreen extends StatefulWidget {
  const _TransportScreen();
  @override
  State<_TransportScreen> createState() => _TransportScreenState();
}

class _TransportScreenState extends State<_TransportScreen> {
  TransportInfo? _info;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final info = await ParentApi.instance.getMyTransport();
      if (!mounted) return;
      setState(() {
        _info = info;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Transport'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? EmptyState(
              emoji: '🚌',
              title: 'Could not load transport info',
              subtitle: _error!,
              ctaLabel: 'Retry',
              onCta: _load,
            )
          : _info == null
          ? const EmptyState(
              emoji: '🚌',
              title: 'No transport assigned',
              subtitle: 'Contact the school office to set up transport.',
            )
          : _buildContent(context),
    );
  }

  Widget _buildContent(BuildContext context) {
    final info = _info!;
    final title = info.title ?? 'School Transport';
    final route = info.routeName;
    final vehicle = info.vehicleNumber;
    final driver = info.driverName;
    final phone = info.driverPhone;
    final notes = info.notes;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.all(20),
        children: [
          NeuCard(
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.parentPrimary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.directions_bus_filled_rounded,
                    color: AppColors.parentPrimary,
                    size: 30,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      if (route != null && route.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          route,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                      if (vehicle != null && vehicle.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          vehicle,
                          style: const TextStyle(
                            fontWeight: FontWeight.w500,
                            color: AppColors.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                      if (driver != null && driver.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Driver: $driver',
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (phone != null && phone.isNotEmpty)
                  TintedIconButton(
                    icon: Icons.phone_rounded,
                    color: AppColors.parentPrimary,
                    onTap: () => _callDriver(context, phone),
                  ),
              ],
            ),
          ),
          if (notes != null && notes.isNotEmpty) ...[
            const SizedBox(height: 16),
            NeuCard(
              child: Text(
                notes,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _callDriver(BuildContext context, String phone) async {
    // Open the phone dialer prefilled with the driver's number.
    final uri = Uri(scheme: 'tel', path: phone.replaceAll(' ', ''));
    try {
      final ok = await launchUrl(uri);
      if (!ok && context.mounted) {
        AppToast.show(context, 'Could not open the dialer',
            type: ToastType.error);
      }
    } catch (_) {
      if (context.mounted) {
        AppToast.show(context, 'Could not open the dialer',
            type: ToastType.error);
      }
    }
  }
}

class _GalleryScreen extends StatefulWidget {
  const _GalleryScreen();
  @override
  State<_GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<_GalleryScreen> {
  late Future<List<GalleryItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = ParentApi.instance.listGallery();
  }

  void _reload() {
    setState(() {
      _future = ParentApi.instance.listGallery();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Gallery'),
      ),
      body: FutureBuilder<List<GalleryItem>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '📸',
              title: 'Could not load gallery',
              subtitle: '${snap.error}',
              ctaLabel: 'Retry',
              onCta: _reload,
            );
          }
          final items = snap.data ?? const <GalleryItem>[];
          if (items.isEmpty) {
            return const EmptyState(
              emoji: '📸',
              title: 'No photos yet',
              subtitle: 'Photos shared by teachers will appear here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: GridView.builder(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final item = items[i];
                return GestureDetector(
                  onTap: () => _openDetail(context, item),
                  child: NeuBox(
                    radius: 12,
                    child: _GalleryThumbnail(item: item),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  void _openDetail(BuildContext context, GalleryItem item) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => _GalleryDetailScreen(item: item)));
  }
}

/// Renders a gallery thumbnail. When the backend stores a real URL in
/// `metadata['url']` we show the image; otherwise we show a placeholder.
class _GalleryThumbnail extends StatelessWidget {
  const _GalleryThumbnail({required this.item});
  final GalleryItem item;

  @override
  Widget build(BuildContext context) {
    final url = item.resolvedThumbnailUrl ?? item.resolvedUrl;
    if (url != null && url.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          url,
          fit: BoxFit.cover,
          errorBuilder: (_, e, s) => _placeholder(item),
        ),
      );
    }
    return _placeholder(item);
  }

  Widget _placeholder(GalleryItem item) {
    final emoji = item.mediaType == 'video' ? '🎬' : '🖼️';
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 28)),
          if (item.title != null && item.title!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                item.title!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Full-screen gallery detail with title, notes, and date.
class _GalleryDetailScreen extends StatelessWidget {
  const _GalleryDetailScreen({required this.item});
  final GalleryItem item;

  @override
  Widget build(BuildContext context) {
    final url = item.resolvedUrl;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          item.title ?? 'Photo',
          style: const TextStyle(color: Colors.white),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: url != null && url.isNotEmpty
                  ? ZoomableImage(url: url)
                  : const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('🖼️', style: TextStyle(fontSize: 80)),
                        SizedBox(height: 12),
                        Text(
                          'Image not available',
                          style: TextStyle(color: Colors.white54, fontSize: 14),
                        ),
                      ],
                    ),
            ),
          ),
          if (item.notes != null && item.notes!.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.black87,
              child: Text(
                item.notes!,
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ),
          if (item.createdAt != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                Formatters.formatDate(item.createdAt!),
                style: const TextStyle(color: Colors.white38, fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }
}

class ParentEventsScreen extends StatefulWidget {
  const ParentEventsScreen({super.key});
  @override
  State<ParentEventsScreen> createState() => _ParentEventsScreenState();
}

class _ParentEventsScreenState extends State<ParentEventsScreen> {
  late Future<List<EventModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = ParentApi.instance.getEvents();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Events'),
      ),
      body: FutureBuilder<List<EventModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final events = (snap.data ?? const <EventModel>[])
              .where((e) => e.audience != 'teachers')
              .toList();
          if (events.isEmpty) {
            return const EmptyState(
              emoji: '🎉',
              title: 'No upcoming events',
              subtitle: 'School events will appear here.',
            );
          }
          const colors = [
            AppColors.warning,
            AppColors.info,
            AppColors.success,
            AppColors.parentPrimary,
          ];
          return RefreshIndicator(
            onRefresh: () async {
              setState(() {
                _future = ParentApi.instance.getEvents();
              });
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.all(20),
              children: [
                for (int i = 0; i < events.length; i++)
                  _eventCard(context, events[i], colors[i % colors.length]),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _eventCard(BuildContext context, EventModel e, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: NeuCard(
        onTap: () => _openDetail(context, e),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.20),
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: const Text('🎉', style: TextStyle(fontSize: 28)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    e.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    e.startDate == null
                        ? ''
                        : Formatters.formatDate(e.startDate!),
                    style: TextStyle(
                      color: color,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openDetail(BuildContext context, EventModel e) {
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              e.title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              [
                if (e.startDate != null) Formatters.formatDate(e.startDate!),
                if (e.venue != null) e.venue!,
              ].join(' · '),
              style: const TextStyle(color: AppColors.textMuted),
            ),
            const SizedBox(height: 12),
            Text(
              e.description ?? 'Join us — more details from the school soon.',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 14,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LeaveScreen extends StatefulWidget {
  const _LeaveScreen();
  @override
  State<_LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<_LeaveScreen> {
  DateTime? _from;
  DateTime? _to;
  String _reason = '';
  String _type = 'sick';
  final _reasonController = TextEditingController();
  late Future<List<LeaveModel>> _future;

  static const _types = ['sick', 'casual', 'vacation', 'other'];

  @override
  void initState() {
    super.initState();
    _future = ParentApi.instance.myLeaves();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDate(BuildContext context, bool isFrom) async {
    final initial = isFrom
        ? (_from ?? DateTime.now())
        : (_to ?? _from ?? DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2026, 1, 1),
      lastDate: DateTime(2027, 12, 31),
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _from = picked;
        } else {
          _to = picked;
        }
      });
    }
  }

  Future<void> _editReason(BuildContext context) async {
    _reasonController.text = _reason;
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Reason'),
        content: SingleChildScrollView(
          child: TextField(
            controller: _reasonController,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Family function / sick / travel…',
              border: OutlineInputBorder(),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              setState(() => _reason = _reasonController.text.trim());
              Navigator.of(context).pop();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  String _format(DateTime? d) {
    if (d == null) return 'Select date';
    return '${d.day.toString().padLeft(2, '0')} ${_month(d.month)} ${d.year}';
  }

  String _month(int m) {
    const names = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return names[m - 1];
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = _from != null && _to != null && _reason.isNotEmpty;
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Leave Application'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          NeuCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Apply for leave',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _types
                      .map(
                        (t) => NeuChip(
                          label: t[0].toUpperCase() + t.substring(1),
                          selected: _type == t,
                          accent: AppColors.parentPrimary,
                          onTap: () => setState(() => _type = t),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 12),
                _LeaveField(
                  label: 'From date',
                  value: _format(_from),
                  onTap: () => _pickDate(context, true),
                ),
                const SizedBox(height: 12),
                _LeaveField(
                  label: 'To date',
                  value: _format(_to),
                  onTap: () => _pickDate(context, false),
                ),
                const SizedBox(height: 12),
                _LeaveField(
                  label: 'Reason',
                  value: _reason.isEmpty ? 'Tap to add reason' : _reason,
                  valueColor: _reason.isEmpty
                      ? AppColors.textMuted
                      : AppColors.textDark,
                  onTap: () => _editReason(context),
                ),
                const SizedBox(height: 16),
                PrimaryButton(
                  label: 'Submit',
                  onPressed: canSubmit ? _submit : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<LeaveModel>>(
            future: _future,
            builder: (context, snap) {
              final items = snap.data ?? const <LeaveModel>[];
              if (items.isEmpty) return const SizedBox.shrink();
              return NeuCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'My leave requests',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final l in items)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${_format(l.fromDate)} → ${_format(l.toDate)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  if (l.reason != null)
                                    Text(
                                      l.reason!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 12,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            StatusChip(
                              label: _statusLabel(l.status),
                              type: _statusChip(l.status),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  static String _statusLabel(String s) => switch (s) {
    'approved' => 'Approved',
    'rejected' => 'Rejected',
    'cancelled' => 'Cancelled',
    _ => 'Pending',
  };

  static ChipType _statusChip(String s) => switch (s) {
    'approved' => ChipType.success,
    'rejected' || 'cancelled' => ChipType.danger,
    _ => ChipType.warning,
  };

  Future<void> _submit() async {
    final child = ParentApi.instance.selectedChild.value;
    String fmt(DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    try {
      await ParentApi.instance.applyLeave(
        studentId: child?.id,
        type: _type,
        fromDate: fmt(_from!),
        toDate: fmt(_to!),
        reason: _reason,
      );
      if (!mounted) return;
      setState(() {
        _from = null;
        _to = null;
        _reason = '';
        _future = ParentApi.instance.myLeaves();
      });
      AppToast.show(
        context,
        'Leave request submitted',
        type: ToastType.success,
      );
    } catch (e) {
      if (!mounted) return;
      AppToast.show(
        context,
        'Could not submit leave: $e',
        type: ToastType.error,
      );
    }
  }
}

class _LeaveField extends StatelessWidget {
  const _LeaveField({
    required this.label,
    required this.value,
    required this.onTap,
    this.valueColor = AppColors.textDark,
  });
  final String label;
  final String value;
  final Color valueColor;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
        const SizedBox(height: 4),
        GestureDetector(
          onTap: onTap,
          child: NeuBox(
            inset: true,
            radius: 12,
            child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.centerLeft,
              child: Text(value, style: TextStyle(color: valueColor)),
            ),
          ),
        ),
      ],
    );
  }
}

class _AchievementsScreen extends StatefulWidget {
  const _AchievementsScreen();
  @override
  State<_AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends State<_AchievementsScreen> {
  late Future<List<MilestoneModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<List<MilestoneModel>> _fetch() {
    final child = ParentApi.instance.selectedChild.value;
    if (child == null) return Future.error('No child selected');
    return ParentApi.instance.getStudentMilestones(child.id);
  }

  void _reload() {
    setState(() {
      _future = _fetch();
    });
  }

  static String _categoryEmoji(String category) => switch (category) {
    'cognitive' => '🧠',
    'social' => '🤝',
    'emotional' => '❤️',
    'physical' => '🏃',
    'language' => '🗣️',
    'creative' => '🎨',
    _ => '⭐',
  };

  static Color _statusColor(String status) => switch (status) {
    'achieved' => AppColors.parentPrimary,
    'emerging' => AppColors.warning,
    _ => AppColors.textMuted,
  };

  void _openDetail(MilestoneModel m) {
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              _categoryEmoji(m.category),
              style: const TextStyle(fontSize: 56),
            ),
            const SizedBox(height: 8),
            Text(
              m.title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 7),
              decoration: BoxDecoration(
                color: _statusColor(m.status).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadii.chip),
              ),
              child: Text(
                m.status == 'achieved'
                    ? 'Achieved'
                    : m.status == 'emerging'
                    ? 'Emerging'
                    : 'Not started',
                style: TextStyle(
                  color: _statusColor(m.status),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
            if (m.notes != null && m.notes!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                m.notes!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textMuted, height: 1.4),
              ),
            ],
            if (m.achievedDate != null) ...[
              const SizedBox(height: 8),
              Text(
                'Achieved on ${Formatters.formatShortDate(m.achievedDate!)}',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 13,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Achievements'),
      ),
      body: FutureBuilder<List<MilestoneModel>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '🏆',
              title: 'Could not load achievements',
              subtitle: '${snap.error}',
              ctaLabel: 'Retry',
              onCta: _reload,
            );
          }
          final items = snap.data ?? const <MilestoneModel>[];
          if (items.isEmpty) {
            return const EmptyState(
              emoji: '🏆',
              title: 'No achievements yet',
              subtitle:
                  'Milestones and awards will appear here as your child progresses.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: GridView.builder(
              padding: const EdgeInsets.all(20),
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.95,
              ),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final m = items[i];
                final color = _statusColor(m.status);
                return NeuCard(
                  onTap: () => _openDetail(m),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _categoryEmoji(m.category),
                        style: const TextStyle(fontSize: 44),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        m.title,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                      if (m.achieved && m.achievedDate != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          Formatters.formatShortDate(m.achievedDate!),
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _DaycareScreen extends StatefulWidget {
  const _DaycareScreen();
  @override
  State<_DaycareScreen> createState() => _DaycareScreenState();
}

class _DaycareScreenState extends State<_DaycareScreen> {
  late Future<DiaryModel> _future;
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<DiaryModel> _fetch() {
    final child = ParentApi.instance.selectedChild.value;
    if (child == null) return Future.error('No child selected');
    final d = _selectedDate;
    final date =
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    return ParentApi.instance.getDiary(child.id, date: date);
  }

  void _reload() {
    setState(() {
      _future = _fetch();
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2025, 1, 1),
      lastDate: DateTime.now(),
    );
    if (picked != null && mounted) {
      setState(() {
        _selectedDate = picked;
        _future = _fetch();
      });
    }
  }

  String get _dateLabel {
    final now = DateTime.now();
    final sel = _selectedDate;
    if (sel.year == now.year && sel.month == now.month && sel.day == now.day) {
      return 'Today';
    }
    final yesterday = now.subtract(const Duration(days: 1));
    if (sel.year == yesterday.year &&
        sel.month == yesterday.month &&
        sel.day == yesterday.day) {
      return 'Yesterday';
    }
    return Formatters.formatShortDate(sel);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Daycare'),
        actions: [
          IconButton(
            icon: const Icon(Iconsax.calendar),
            onPressed: _pickDate,
            tooltip: 'Choose date',
          ),
        ],
      ),
      body: FutureBuilder<DiaryModel>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EmptyState(
              emoji: '🧸',
              title: 'Could not load daycare log',
              subtitle: '${snap.error}',
              ctaLabel: 'Retry',
              onCta: _reload,
            );
          }
          final diary = snap.data!;
          final entries = diary.entries;
          if (entries.isEmpty) {
            return EmptyState(
              emoji: '🧸',
              title: 'No daycare activity',
              subtitle: 'Nothing logged for $_dateLabel.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.all(20),
              children: [
                _DateHeader(label: _dateLabel, onTap: _pickDate),
                const SizedBox(height: 12),
                _DaycareSummary(entries: entries),
                const SizedBox(height: 16),
                const Text(
                  'Timeline',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 8),
                for (final e in entries) _DaycareTimelineTile(entry: e),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 16,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(
            Iconsax.arrow_down_1,
            size: 14,
            color: AppColors.textMuted,
          ),
        ],
      ),
    );
  }
}

class _DaycareSummary extends StatelessWidget {
  const _DaycareSummary({required this.entries});
  final List<DiaryEntry> entries;
  @override
  Widget build(BuildContext context) {
    final meals = entries.where((e) => e.kind == 'meal').length;
    final naps = entries.where((e) => e.kind == 'nap').length;
    final activities = entries.where((e) => e.kind == 'activity').length;
    final health = entries.where((e) => e.kind == 'health').length;
    final mood = entries.where((e) => e.kind == 'observation').length;

    return NeuCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _SummaryItem(emoji: '🍽️', label: 'Meals', value: meals),
          _SummaryItem(emoji: '😴', label: 'Naps', value: naps),
          _SummaryItem(emoji: '🎯', label: 'Play', value: activities),
          _SummaryItem(emoji: '❤️', label: 'Health', value: health),
          _SummaryItem(emoji: '😊', label: 'Mood', value: mood),
        ],
      ),
    );
  }
}

class _SummaryItem extends StatelessWidget {
  const _SummaryItem({
    required this.emoji,
    required this.label,
    required this.value,
  });
  final String emoji;
  final String label;
  final int value;
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(emoji, style: const TextStyle(fontSize: 22)),
        const SizedBox(height: 2),
        Text(
          '$value',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: value > 0 ? AppColors.parentPrimary : AppColors.textMuted,
            fontSize: 16,
          ),
        ),
        Text(
          label,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
        ),
      ],
    );
  }
}

class _DaycareTimelineTile extends StatelessWidget {
  const _DaycareTimelineTile({required this.entry});
  final DiaryEntry entry;

  static const _icons = <String, IconData>{
    'meal': Iconsax.cup,
    'nap': Iconsax.moon,
    'activity': Iconsax.star,
    'health': Iconsax.heart,
    'observation': Iconsax.emoji_happy,
  };

  static const _colors = <String, Color>{
    'meal': AppColors.warning,
    'nap': AppColors.info,
    'activity': AppColors.success,
    'health': AppColors.danger,
    'observation': AppColors.parentPrimary,
  };

  @override
  Widget build(BuildContext context) {
    final icon = _icons[entry.kind] ?? Iconsax.info_circle;
    final color = _colors[entry.kind] ?? AppColors.textMuted;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              Container(
                width: 2,
                height: 40,
                color: AppColors.mutedGray.withValues(alpha: 0.5),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: NeuCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  if (entry.subtitle != null && entry.subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      entry.subtitle!,
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  if (entry.when != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      Formatters.formatTime(entry.when!),
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsScreen extends StatelessWidget {
  const _SettingsScreen();
  @override
  Widget build(BuildContext context) {
    return const _ParentSettingsScreen();
  }
}

class _ParentSettingsScreen extends StatelessWidget {
  const _ParentSettingsScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Settings'),
        iconTheme: const IconThemeData(color: AppColors.textDark),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _ProfileRow(
            name: () {
              final email = AuthApi.instance.currentSession?.email ?? '';
              if (email.isEmpty) return 'Parent';
              return email.split('@').first.replaceAll('.', ' ');
            }(),
            role: UserRole.parent,
          ),
          const SizedBox(height: 16),
          _SettingsTile(
            icon: Iconsax.user,
            label: 'Edit profile',
            onTap: () => _openEditProfile(context),
          ),
          _SettingsTile(
            icon: Iconsax.global,
            label: 'Change language',
            trailing: 'English',
            onTap: () => _openLanguage(context),
          ),
          _SettingsTile(
            icon: Iconsax.notification,
            label: 'Notifications',
            trailing: 'On',
            onTap: () => _openNotifications(context),
          ),
          _SettingsTile(
            icon: Iconsax.shield_tick,
            label: 'Privacy & security',
            onTap: () => _openPrivacy(context),
          ),
          _SettingsTile(
            icon: Iconsax.info_circle,
            label: 'Help & FAQ',
            onTap: () => _openHelp(context),
          ),
          _SettingsTile(
            icon: Iconsax.information,
            label: 'About Sproutly',
            onTap: () => _openAbout(context),
          ),
          _SettingsTile(
            icon: Iconsax.logout,
            label: 'Logout',
            color: AppColors.danger,
            onTap: () => confirmLogout(context),
          ),
        ],
      ),
    );
  }

  void _openEditProfile(BuildContext context) {
    final session = AuthApi.instance.currentSession;
    final name = TextEditingController();
    final phone = TextEditingController();
    final email = session?.email ?? '';

    showAppBottomSheet<void>(
      context: context,
      scrollable: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Edit profile',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: name,
              decoration: const InputDecoration(
                labelText: 'Name',
                hintText: 'Enter your name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: TextEditingController(text: email),
              readOnly: true,
              decoration: InputDecoration(
                labelText: 'Email',
                border: const OutlineInputBorder(),
                filled: true,
                fillColor: AppColors.textMuted.withValues(alpha: 0.08),
                suffixIcon: const Icon(
                  Iconsax.lock,
                  size: 16,
                  color: AppColors.textMuted,
                ),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Phone',
                hintText: '+91 9876543210',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Save',
              fullWidth: true,
              onPressed: () async {
                try {
                  await ParentApi.instance.updateMyProfile(
                    name: name.text.isNotEmpty ? name.text.trim() : null,
                    phone: phone.text.isNotEmpty ? phone.text.trim() : null,
                  );
                  if (!context.mounted) return;
                  Navigator.of(context).pop();
                  AppToast.show(
                    context,
                    'Profile updated',
                    type: ToastType.success,
                  );
                } catch (e) {
                  if (!context.mounted) return;
                  AppToast.show(
                    context,
                    'Failed to update profile',
                    type: ToastType.error,
                  );
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  void _openLanguage(BuildContext context) {
    const langs = ['English', 'हिंदी', 'தமிழ்', 'বাংলা', 'मराठी'];
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Change language',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 8),
            for (final l in langs)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(l),
                onTap: () {
                  Navigator.of(context).pop();
                  AppToast.show(
                    context,
                    'Language: $l',
                    type: ToastType.success,
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  void _openNotifications(BuildContext context) {
    showAppBottomSheet<void>(
      context: context,
      child: const _NotificationPrefsSheet(),
    );
  }

  void _openPrivacy(BuildContext context) {
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Privacy & security',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your data is encrypted in transit and at rest. '
              'You can request a download of all your data from the school office.',
              style: TextStyle(height: 1.4),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Change password',
              fullWidth: true,
              onPressed: () {
                Navigator.of(context).pop();
                AppToast.show(
                  context,
                  'Password reset link sent',
                  type: ToastType.success,
                );
              },
            ),
            const SizedBox(height: 10),
            SecondaryButton(
              label: 'View Privacy Policy',
              color: AppColors.parentPrimary,
              onPressed: () {
                Navigator.of(context).pop();
                Navigator.of(context).push(
                  neuRoute(
                    const PrivacyPolicyScreen(accent: AppColors.parentPrimary),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _openHelp(BuildContext context) {
    const faqs = [
      ('How do I pay fees?', 'Go to Fees → select pending invoice → Pay now.'),
      (
        'How do I mark my child absent?',
        'Apply via More → Leave Application at least one day prior.',
      ),
      (
        'How do I see the daily diary?',
        'The diary appears on the Home screen under "Today\'s diary".',
      ),
      (
        'How do I change my phone number?',
        'Settings → Edit profile → update phone and Save.',
      ),
    ];
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Help & FAQ',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 8),
            for (final f in faqs) ...[
              const SizedBox(height: 8),
              Text(
                f.$1,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                f.$2,
                style: const TextStyle(color: AppColors.textMuted, height: 1.4),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _openAbout(BuildContext context) {
    showAppBottomSheet<void>(
      context: context,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'About Sproutly',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark,
              ),
            ),
            const SizedBox(height: 8),
            const Text('Version 1.0.0'),
            const SizedBox(height: 8),
            const Text(
              'Sproutly is a complete pre-school management app for '
              'parents, teachers, and administrators.',
              style: TextStyle(height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

/// P7: the four reminder opt-ins from the workflow diagram, loaded from and
/// persisted to the backend (GET/PATCH /users/me/notification-prefs).
class _NotificationPrefsSheet extends StatefulWidget {
  const _NotificationPrefsSheet();
  @override
  State<_NotificationPrefsSheet> createState() =>
      _NotificationPrefsSheetState();
}

class _NotificationPrefsSheetState extends State<_NotificationPrefsSheet> {
  static const _items = [
    ('feeReminders', 'Fee reminders', 'Due dates and pending invoices'),
    ('attendanceAlerts', 'Attendance alerts', 'Absences and check-in/out'),
    (
      'homeworkNotifications',
      'Homework notifications',
      'New homework and due dates',
    ),
    ('eventReminders', 'Event reminders', 'School events and holidays'),
  ];

  Map<String, bool>? _prefs;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await ParentApi.instance.getNotificationPrefs();
      if (mounted) {
        setState(() {
          _prefs = p;
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load preferences');
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ParentApi.instance.updateNotificationPrefs(_prefs!);
      if (!mounted) return;
      Navigator.of(context).pop();
      AppToast.show(
        context,
        'Notification settings saved',
        type: ToastType.success,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppToast.show(context, 'Could not save. Try again.',
          type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Notifications',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Choose which reminders you receive.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 8),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppColors.textMuted),
                ),
              ),
            )
          else if (_prefs == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child:
                    CircularProgressIndicator(color: AppColors.parentPrimary),
              ),
            )
          else ...[
            for (final (key, title, sub) in _items)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                subtitle: Text(
                  sub,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
                value: _prefs![key] ?? true,
                activeThumbColor: AppColors.parentPrimary,
                onChanged: (v) => setState(() => _prefs![key] = v),
              ),
            const SizedBox(height: 8),
            PrimaryButton(
              label: _saving ? 'Saving…' : 'Save',
              fullWidth: true,
              onPressed: _saving ? null : _save,
            ),
          ],
        ],
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({required this.name, required this.role});
  final String name;
  final UserRole role;
  @override
  Widget build(BuildContext context) {
    final accent = AppColors.parentPrimary;
    return NeuCard(
      padding: const EdgeInsets.all(20),
      radius: 24,
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.20),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
            ),
            child: Text(
              name.split(' ').first[0],
              style: TextStyle(
                color: accent,
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    role.label,
                    style: TextStyle(
                      color: accent,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.label,
    this.trailing,
    this.color,
    this.onTap,
  });
  final IconData icon;
  final String label;
  final String? trailing;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textDark;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        gradient: Neu.convex,
        borderRadius: BorderRadius.circular(16),
        boxShadow: Neu.raisedShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 4,
          ),
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: c, size: 20),
          ),
          title: Text(
            label,
            style: TextStyle(color: c, fontWeight: FontWeight.w600),
          ),
          trailing: trailing != null
              ? Text(
                  trailing!,
                  style: const TextStyle(color: AppColors.textMuted),
                )
              : const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textMuted,
                ),
          onTap: onTap,
        ),
      ),
    );
  }
}
