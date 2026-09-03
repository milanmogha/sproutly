import 'dart:async';

import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../../../core/network/auth_api.dart';
import '../../../core/network/socket_service.dart';
import '../../../core/network/teacher_api.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';

/// Direct messages — the teacher's inbox. Tap a row to open the full thread.
/// "New" FAB picks a parent from one of the teacher's class rosters.
class TeacherMessagesScreen extends StatefulWidget {
  const TeacherMessagesScreen({super.key});
  @override
  State<TeacherMessagesScreen> createState() => _TeacherMessagesScreenState();
}

class _TeacherMessagesScreenState extends State<TeacherMessagesScreen> {
  late Future<List<ChatThreadModel>> _future;

  @override
  void initState() {
    super.initState();
    _future = TeacherApi.instance.chatThreads();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      appBar: AppBar(
        automaticallyImplyLeading: true,
        backgroundColor: Neu.bg,
        elevation: 0,
        title: const Text('Messages',
            style: TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.textDark)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNewMessage,
        backgroundColor: AppColors.teacherPrimary,
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
              subtitle: 'Parents and the school office can reach you here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              setState(() {
                _future = TeacherApi.instance.chatThreads();
              });
            },
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              itemCount: threads.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final t = threads[i];
                return _TeacherMessageTile(
                  otherName: t.name,
                  // Marks an office thread apart from a parent one.
                  roleLabel: t.role == 'parent' ? null : t.roleLabel,
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
        .push(neuRoute<void>(
          TeacherChatThreadScreen(
            otherId: t.userId,
            otherName: t.name,
          ),
        ))
        .then((_) {
      if (mounted) {
        setState(() {
          _future = TeacherApi.instance.chatThreads();
        });
      }
    });
  }

  Future<void> _openNewMessage() async {
    // Two kinds of recipient: the parents on the teacher's own rosters, and
    // the school office (admins) — who the teacher raises a query with.
    final classes = await TeacherApi.instance.listMyClasses();
    if (!mounted) return;
    final byId = <String, _ParentChoice>{};
    for (final c in classes) {
      final students = await TeacherApi.instance.getClassStudents(c.id);
      if (!mounted) return;
      for (final s in students) {
        final pid = s.parentUserId;
        if (pid == null || pid.isEmpty) continue;
        byId.putIfAbsent(
            pid,
            () => _ParentChoice(
                  userId: pid,
                  label: 'Parent of ${s.fullName}',
                  studentId: s.id,
                ));
      }
    }

    // Office contacts are a nice-to-have: if the call fails, the parent list
    // still works.
    List<ChatContactModel> office = const [];
    try {
      office = await TeacherApi.instance.chatContacts();
    } catch (_) {}
    if (!mounted) return;

    if (byId.isEmpty && office.isEmpty) {
      AppToast.show(context, 'No one to message yet', type: ToastType.info);
      return;
    }

    final picked = await showAppBottomSheet<_ParentChoice>(
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
                child: Text('New message',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark)),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.only(bottom: 16),
                  children: [
                    if (office.isNotEmpty) const _SheetHeader('School office'),
                    for (final a in office)
                      _PickerRow(
                        label: a.name,
                        subtitle: 'Admin',
                        // An office thread isn't about one child, so it
                        // carries no relatedStudent.
                        choice: _ParentChoice(
                          userId: a.userId,
                          label: a.name,
                          studentId: null,
                        ),
                      ),
                    if (byId.isNotEmpty) const _SheetHeader('Parents'),
                    for (final p in byId.values)
                      _PickerRow(label: p.label, choice: p),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked == null || !mounted) return;
    Navigator.of(context).push(neuRoute<void>(
      TeacherChatThreadScreen(
        otherId: picked.userId,
        otherName: picked.label,
        relatedStudent: picked.studentId,
      ),
    ));
  }

}

/// Someone the teacher can open a thread with. [studentId] is the child the
/// conversation is about — null for the school office, which isn't.
class _ParentChoice {
  const _ParentChoice({
    required this.userId,
    required this.label,
    required this.studentId,
  });
  final String userId;
  final String label;
  final String? studentId;
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
    required this.choice,
    this.subtitle,
  });

  final String label;
  final String? subtitle;
  final _ParentChoice choice;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.teacherPrimary.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(19),
        ),
        alignment: Alignment.center,
        child: Text(
          label.isNotEmpty ? label[0].toUpperCase() : '?',
          style: const TextStyle(
              color: AppColors.teacherPrimary, fontWeight: FontWeight.w700),
        ),
      ),
      title: Text(label,
          style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!, style: const TextStyle(fontSize: 12)),
      onTap: () => Navigator.of(context).pop(choice),
    );
  }
}

class _TeacherMessageTile extends StatelessWidget {
  const _TeacherMessageTile({
    required this.otherName,
    required this.lastMessage,
    required this.unread,
    this.roleLabel,
    this.lastAt,
    required this.onTap,
  });

  final String otherName;

  /// Shown under the name for non-parent threads (i.e. the school office), so
  /// an admin conversation doesn't read like a parent one.
  final String? roleLabel;
  final String lastMessage;
  final int unread;
  final DateTime? lastAt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return NeuCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.teacherPrimary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(23),
            ),
            alignment: Alignment.center,
            child: Text(
              otherName.isNotEmpty
                  ? otherName[0].toUpperCase()
                  : '?',
              style: const TextStyle(
                  color: AppColors.teacherPrimary,
                  fontWeight: FontWeight.w700),
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
                      child: Text(otherName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                    if (lastAt != null)
                      Text(_rel(lastAt!),
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 11)),
                  ],
                ),
                if (roleLabel != null) ...[
                  const SizedBox(height: 2),
                  Text(roleLabel!,
                      style: const TextStyle(
                          color: AppColors.teacherPrimary,
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 4),
                Text(lastMessage,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        color: unread > 0
                            ? AppColors.textDark
                            : AppColors.textMuted,
                        fontSize: 13,
                        fontWeight: unread > 0
                            ? FontWeight.w600
                            : FontWeight.w400)),
              ],
            ),
          ),
          if (unread > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.teacherPrimary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$unread',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700)),
            ),
          ],
        ],
      ),
    );
  }
}

String _rel(DateTime when) {
  final now = DateTime.now();
  final diff = now.difference(when);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return Formatters.formatShortDate(when);
}

/// Full chat thread for the teacher. Mirrors the parent's `_ChatThreadScreen`.
class TeacherChatThreadScreen extends StatefulWidget {
  const TeacherChatThreadScreen({
    super.key,
    required this.otherId,
    required this.otherName,
    this.relatedStudent,
  });

  final String otherId;
  final String otherName;
  final String? relatedStudent;

  @override
  State<TeacherChatThreadScreen> createState() =>
      _TeacherChatThreadScreenState();
}

class _TeacherChatThreadScreenState extends State<TeacherChatThreadScreen> {
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
      final msgs =
          await TeacherApi.instance.conversation(widget.otherId);
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(msgs);
        _initialLoading = false;
      });
      // Mark incoming unread as read.
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
    // Only process messages relevant to this conversation.
    final relevant = msg.senderId == widget.otherId ||
        msg.senderId == (AuthApi.instance.currentSession?.userId ?? '');
    final otherIsRecipient = msg.recipientId == widget.otherId ||
        msg.recipientId == (AuthApi.instance.currentSession?.userId ?? '');
    if (!relevant || !otherIsRecipient) return;

    setState(() {
      // Avoid duplicates (in case REST sent the same msg already).
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
      relatedStudent: widget.relatedStudent,
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
            Text(widget.otherName,
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: AppColors.textDark)),
            if (_otherTyping)
              const Text('typing…',
                  style: TextStyle(
                      fontSize: 11,
                      color: AppColors.teacherPrimary,
                      fontStyle: FontStyle.italic))
            else if (_otherOnline)
              const Text('online',
                  style: TextStyle(fontSize: 11, color: Colors.green)),
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
                    : ListView.builder(
                        controller: _scrollCtl,
                        reverse: true,
                        physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (_, i) {
                          // Reverse list: newest first in the list.
                          final idx = _messages.length - 1 - i;
                          final m = _messages[idx];
                          final mine = m.senderId == me;
                          return _bubble(m, mine);
                        },
                      ),
          ),
          _sendBar(),
        ],
      ),
    );
  }

  Widget _bubble(MessageModel m, bool mine) {
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: const BoxConstraints(maxWidth: 280),
        decoration: BoxDecoration(
          color: mine ? AppColors.teacherPrimary : AppColors.mutedGray,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4),
            bottomRight: Radius.circular(mine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment:
              mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (m.relatedStudentName != null &&
                m.relatedStudentName!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  'Re: ${m.relatedStudentName!}',
                  style: TextStyle(
                      color: mine
                          ? Colors.white.withValues(alpha: 0.85)
                          : AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600),
                ),
              ),
            Text(m.body,
                style: TextStyle(
                    color: mine ? Colors.white : AppColors.textDark,
                    fontSize: 14)),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (m.createdAt != null)
                  Text(Formatters.formatTime(m.createdAt!),
                      style: TextStyle(
                          color: mine
                              ? Colors.white.withValues(alpha: 0.75)
                              : AppColors.textMuted,
                          fontSize: 10)),
                if (mine && m.read) ...[
                  const SizedBox(width: 4),
                  Icon(Icons.done_all,
                      size: 14,
                      color: Colors.white.withValues(alpha: 0.75)),
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
          16, 8, 16, MediaQuery.of(context).padding.bottom + 8),
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
                    horizontal: 16, vertical: 10),
              ),
            ),
          ),
          const SizedBox(width: 8),
          TintedIconButton(
            icon: Icons.send_rounded,
            color: AppColors.teacherPrimary,
            onTap: _sending ? null : _send,
          ),
        ],
      ),
    );
  }
}
