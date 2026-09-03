import 'package:socket_io_client/socket_io_client.dart' as io;
import 'api_config.dart';
import 'api_models.dart';
import 'token_storage.dart';

/// Singleton Socket.IO service for real-time chat.
///
/// Connects to the server's `/chat` namespace with JWT auth.
/// Call [connect] after login, [disconnect] on logout.
///
/// Chat screens use the callbacks ([onNewMessage], [onTyping], etc.) to
/// react to real-time events, and the methods ([sendMessage], [sendTyping],
/// [markRead]) to send events.
///
/// ```dart
/// final socket = SocketService.instance;
/// await socket.connect();
/// socket.onNewMessage = (msg) { ... };
/// socket.sendMessage(recipientId: '...', body: 'Hello');
/// ```
class SocketService {
  SocketService._();
  static final SocketService instance = SocketService._();

  io.Socket? _socket;

  // ── Public callbacks ─────────────────────────────────────

  void Function(MessageModel message)? onNewMessage;
  void Function(MessageModel message)? onMessageSent;
  void Function(String userId, bool isTyping)? onTyping;
  void Function(String messageId, String readBy, DateTime? readAt)?
      onMessageRead;
  void Function(String userId)? onUserOnline;
  void Function(String userId)? onUserOffline;

  /// Set of currently-online user IDs (hydrated on connect).
  final Set<String> onlineUsers = {};

  bool get connected => _socket?.connected ?? false;

  // ── Lifecycle ─────────────────────────────────────────────

  /// Opens the socket to the /chat namespace. Safe to call multiple times.
  Future<void> connect() async {
    if (_socket?.connected == true) return;

    final token = TokenStorage.instance.accessToken;
    if (token == null) return;

    // If we have a disconnected socket, reconnect it.
    if (_socket != null) {
      _socket!.connect();
      return;
    }

    final uri = Uri.parse(ApiConfig.serverRoot);

    _socket = io.io(
      '$uri/chat', // Socket.IO namespace URL
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth(<String, dynamic>{'token': token})
          .enableAutoConnect()
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(10000)
          .enableReconnection()
          .build(),
    );

    _socket!.onConnect((_) {
      // Connected and authenticated — onlineUsers will be sent by server.
    });

    _socket!.onConnectError((err) {
      // Auth failure or network issue — caller should handle.
    });

    _socket!.on('error', (data) {
      // Server-sent errors are handled by the callbacks.
    });

    // ── Server → Client events ───────────────────────────

    _socket!.on('newMessage', (data) {
      if (onNewMessage == null || data is! Map<String, dynamic>) return;
      try {
        onNewMessage!(MessageModel.fromJson(data));
      } catch (_) {}
    });

    _socket!.on('messageSent', (data) {
      if (onMessageSent == null || data is! Map<String, dynamic>) return;
      try {
        onMessageSent!(MessageModel.fromJson(data));
      } catch (_) {}
    });

    _socket!.on('typing', (data) {
      if (onTyping == null || data is! Map<String, dynamic>) return;
      final uid = data['userId'] as String? ?? '';
      final typing = data['isTyping'] as bool? ?? false;
      if (uid.isNotEmpty) onTyping!(uid, typing);
    });

    _socket!.on('messageRead', (data) {
      if (onMessageRead == null || data is! Map<String, dynamic>) return;
      onMessageRead!(
        data['messageId'] as String? ?? '',
        data['readBy'] as String? ?? '',
        data['readAt'] != null
            ? DateTime.tryParse(data['readAt'] as String)
            : null,
      );
    });

    _socket!.on('userOnline', (data) {
      if (data is! Map<String, dynamic>) return;
      final uid = data['userId'] as String?;
      if (uid != null && uid.isNotEmpty) {
        onlineUsers.add(uid);
        onUserOnline?.call(uid);
      }
    });

    _socket!.on('userOffline', (data) {
      if (data is! Map<String, dynamic>) return;
      final uid = data['userId'] as String?;
      if (uid != null && uid.isNotEmpty) {
        onlineUsers.remove(uid);
        onUserOffline?.call(uid);
      }
    });

    _socket!.on('onlineUsers', (data) {
      onlineUsers.clear();
      if (data is List) {
        for (final id in data) {
          if (id is String) onlineUsers.add(id);
        }
      }
    });
  }

  /// Reconnects with a new token (e.g. after token refresh).
  Future<void> reconnect() async {
    disconnect();
    await connect();
  }

  /// Disconnects and cleans up. Call on logout.
  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    onlineUsers.clear();
  }

  // ── Client → Server events ──────────────────────────────

  void sendMessage({
    required String recipientId,
    required String body,
    String? subject,
    String? relatedStudent,
  }) {
    final data = <String, dynamic>{
      'recipientId': recipientId,
      'body': body,
    };
    if (subject != null && subject.isNotEmpty) data['subject'] = subject;
    if (relatedStudent != null) data['relatedStudent'] = relatedStudent;
    _socket?.emit('sendMessage', data);
  }

  void sendTyping({required String recipientId, required bool isTyping}) {
    _socket?.emit('typing', {
      'recipientId': recipientId,
      'isTyping': isTyping,
    });
  }

  void markRead(String messageId) {
    _socket?.emit('markRead', {'messageId': messageId});
  }
}
