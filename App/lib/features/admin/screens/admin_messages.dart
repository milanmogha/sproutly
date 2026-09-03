import 'dart:async';

import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

import '../../../core/network/admin_api.dart';
import '../../../core/network/auth_api.dart';
import '../../../core/network/socket_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/atoms.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/neu.dart';

/// The admin's query inbox — every 1:1 thread with a teacher or a parent.
///
/// Each conversation is private between the admin and that one person:
/// admin↔teacher and admin↔parent are separate threads, and neither shows the
/// teacher↔parent chat, which the admin is not part of.
///
/// Rendered as a tab inside `AdminCommunicationScreen`, so it has no Scaffold
/// of its own — the parent screen owns the app bar.
class AdminMessagesTab extends StatefulWidget {
  const AdminMessagesTab({super.key});

  @override
  State<AdminMessagesTab> createState() => _AdminMessagesTabState();
}

class _AdminMessagesTabState extends State<AdminMessagesTab> {
  late Future<List<ChatThreadModel>> _future;

  SocketService get _socket => SocketService.instance;

  @override
  void initState() {
    super.initState();
    _future = AdminApi.instance.chatThreads();

    // Keep the thread list live while the admin sits on it: an incoming
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
      _future = AdminApi.instance.chatThreads();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Neu.bg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNewChat,
        backgroundColor: AppColors.adminPrimary,
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
              title: 'No queries yet',
              subtitle:
                  'Teachers and parents can reach the office here. '
                  'Tap New to start a chat.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              itemCount: threads.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _ThreadTile(
                thread: threads[i],
                onTap: () => _openThread(
                  threads[i].userId,
                  threads[i].name,
                  threads[i].roleLabel,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _openThread(
    String otherId,
    String otherName,
    String roleLabel,
  ) async {
    await Navigator.of(context).push(
      neuRoute<void>(
        AdminChatThreadScreen(
          otherId: otherId,
          otherName: otherName,
          otherRole: roleLabel,
        ),
      ),
    );
    // Unread counts change while the thread is open — refresh on the way back.
    _reload();
  }

  /// Picks whom to write to. Contacts come back role-tagged, so the sheet is
  /// grouped: teachers first, then parents.
  Future<void> _openNewChat() async {
    List<ChatContactModel> contacts;
    try {
      contacts = await AdminApi.instance.chatContacts();
    } catch (_) {
      if (!mounted) return;
      AppToast.show(
        context,
        'Could not load contacts',
        type: ToastType.error,
      );
      return;
    }
    if (!mounted) return;
    if (contacts.isEmpty) {
      AppToast.show(
        context,
        'No teachers or parents with accounts yet',
        type: ToastType.info,
      );
      return;
    }

    final teachers = contacts.where((c) => c.role == 'teacher').toList();
    final parents = contacts.where((c) => c.role == 'parent').toList();

    final picked = await showAppBottomSheet<ChatContactModel>(
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
                    if (teachers.isNotEmpty) const _SheetHeader('Teachers'),
                    for (final c in teachers) _ContactRow(contact: c),
                    if (parents.isNotEmpty) const _SheetHeader('Parents'),
                    for (final c in parents) _ContactRow(contact: c),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked == null || !mounted) return;

    await _openThread(picked.userId, picked.name, picked.roleLabel);
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

class _ContactRow extends StatelessWidget {
  const _ContactRow({required this.contact});
  final ChatContactModel contact;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: _Avatar(name: contact.name),
      title: Text(
        contact.name,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: contact.email == null
          ? null
          : Text(
              contact.email!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12),
            ),
      onTap: () => Navigator.of(context).pop(contact),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.size = 38});
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.adminPrimary.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(size / 2),
      ),
      alignment: Alignment.center,
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: const TextStyle(
          color: AppColors.adminPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ThreadTile extends StatelessWidget {
  const _ThreadTile({required this.thread, required this.onTap});

  final ChatThreadModel thread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unread = thread.unread > 0;
    return NeuCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          _Avatar(name: thread.name, size: 46),
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
                        thread.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    if (thread.lastAt != null)
                      Text(
                        _rel(thread.lastAt!),
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                // The role tag is what tells the admin whether this query is
                // from a teacher or a parent at a glance.
                Text(
                  thread.roleLabel,
                  style: const TextStyle(
                    color: AppColors.adminPrimary,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  thread.lastMessage,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: unread ? AppColors.textDark : AppColors.textMuted,
                    fontSize: 13,
                    fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
          if (unread) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.adminPrimary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${thread.unread}',
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

String _rel(DateTime when) {
  final diff = DateTime.now().difference(when);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return Formatters.formatShortDate(when);
}

/// One admin↔teacher or admin↔parent conversation, live over Socket.IO.
/// Mirrors `TeacherChatThreadScreen`, in the admin accent.
class AdminChatThreadScreen extends StatefulWidget {
  const AdminChatThreadScreen({
    super.key,
    required this.otherId,
    required this.otherName,
    this.otherRole,
  });

  final String otherId;
  final String otherName;

  /// "Teacher" / "Parent" — shown under the name so the admin knows who
  /// they're answering.
  final String? otherRole;

  @override
  State<AdminChatThreadScreen> createState() => _AdminChatThreadScreenState();
}

class _AdminChatThreadScreenState extends State<AdminChatThreadScreen> {
  final _ctl = TextEditingController();
  final _scrollCtl = ScrollController();
  final _messages = <MessageModel>[];
  bool _initialLoading = true;
  bool _sending = false;
  bool _otherTyping = false;
  bool _otherOnline = false;
  Timer? _typingDebounce;

  SocketService get _socket => SocketService.instance;

  @override
  void initState() {
    super.initState();
    _loadHistory();
    _connectSocket();
  }

  Future<void> _loadHistory() async {
    try {
      final msgs = await AdminApi.instance.conversation(widget.otherId);
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(msgs);
        _initialLoading = false;
      });
      // Opening the thread is reading it — clear the unread badge.
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

    _otherOnline = _socket.onlineUsers.contains(widget.otherId);
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
    // Only messages belonging to *this* thread.
    final inThread =
        (msg.senderId == widget.otherId && msg.recipientId == me) ||
        (msg.senderId == me && msg.recipientId == widget.otherId);
    if (!inThread) return;

    setState(() {
      if (!_messages.any((m) => m.id == msg.id)) _messages.add(msg);
    });

    if (msg.senderId == widget.otherId) _socket.markRead(msg.id);
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
    _socket.onMessageSent = null;
    _ctl.dispose();
    _scrollCtl.dispose();
    _typingDebounce?.cancel();
    super.dispose();
  }

  void _onTextChanged(String _) {
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

    // Optimistic bubble, swapped for the server's copy on confirmation.
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

    _socket.sendMessage(recipientId: widget.otherId, body: text);

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

    // No confirmation in 10s → drop the optimistic bubble rather than leave a
    // message that looks sent but never was.
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
              const Text(
                'typing…',
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.adminPrimary,
                  fontStyle: FontStyle.italic,
                ),
              )
            else if (_otherOnline)
              const Text(
                'online',
                style: TextStyle(fontSize: 11, color: Colors.green),
              )
            else if (widget.otherRole != null)
              Text(
                widget.otherRole!,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
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
                    title: 'No messages yet',
                    subtitle: 'Send the first message below.',
                  )
                : ListView.builder(
                    controller: _scrollCtl,
                    reverse: true,
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final m = _messages[_messages.length - 1 - i];
                      return _bubble(m, m.senderId == me);
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
          color: mine ? AppColors.adminPrimary : AppColors.mutedGray,
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
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            Text(
              m.body,
              style: TextStyle(
                color: mine ? Colors.white : AppColors.textDark,
                fontSize: 14,
              ),
            ),
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
                hintText: 'Type a reply',
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
            color: AppColors.adminPrimary,
            onTap: _sending ? null : _send,
          ),
        ],
      ),
    );
  }
}
