import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthUser {
  userId: string;
  email: string;
  role: string;
  schoolId: string | null;
}

/**
 * Socket.IO gateway for real-time chat between teachers and parents.
 *
 * Each authenticated user joins a private room named after their userId,
 * so messages can be delivered directly to the intended recipient.
 *
 * Events (client → server):
 *  - `sendMessage`       — send a direct message
 *  - `typing`            — emit typing indicator to the other party
 *  - `markRead`          — mark a message as read (with read receipt)
 *
 * Events (server → client):
 *  - `newMessage`        — a new message has arrived
 *  - `messageSent`       — confirmation the message was persisted
 *  - `typing`            — the other party is typing
 *  - `messageRead`       — the other party read your message
 *  - `userOnline`        — a contact came online
 *  - `userOffline`       — a contact went offline
 *  - `onlineUsers`       — list of currently online contacts (sent on connection)
 */

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
  // 25s ping interval keeps connections alive through proxies;
  // 10s ping timeout means slow networks still work.
  pingInterval: 25_000,
  pingTimeout: 10_000,
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /**
   * Track online users: userId → Set of socket ids.
   * A user may have multiple sockets (phone + web), so we store a set.
   */
  private readonly online = new Map<string, Set<string>>();
  /** Reverse lookup: socket id → userId */
  private readonly socketUser = new Map<string, string>();
  /** Reverse lookup: socket id → schoolId */
  private readonly socketSchool = new Map<string, string | null>();

  constructor(
    private readonly communicationService: CommunicationService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Lifecycle ───────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    const user = this.authenticate(client);
    if (!user) return; // authenticate() already disconnected

    client.data.user = user;
    this.socketUser.set(client.id, user.userId);
    this.socketSchool.set(client.id, user.schoolId);

    // Join private room so messages can target this user directly.
    await client.join(user.userId);

    // Track online presence
    if (!this.online.has(user.userId)) {
      this.online.set(user.userId, new Set());
    }
    const wasOffline = this.online.get(user.userId)!.size === 0;
    this.online.get(user.userId)!.add(client.id);

    this.logger.log(
      `🔗 ${user.role} ${user.email} connected (${client.id})`,
    );

    // If this is the first socket for this user, broadcast presence
    if (wasOffline) {
      this.server.emit('userOnline', { userId: user.userId });
    }

    // Send the newly connected user their list of online contacts
    const onlineUserIds = Array.from(this.online.keys()).filter(
      (id) => id !== user.userId && (this.online.get(id)?.size ?? 0) > 0,
    );
    client.emit('onlineUsers', onlineUserIds);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = this.socketUser.get(client.id);
    const schoolId = this.socketSchool.get(client.id);

    this.socketUser.delete(client.id);
    this.socketSchool.delete(client.id);

    if (userId) {
      const sockets = this.online.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.online.delete(userId);
          // Last socket gone → broadcast offline
          this.server.emit('userOffline', { userId });
          this.logger.log(`🔌 ${userId} disconnected (last socket)`);
        }
      }
    }
  }

  // ── Chat events ─────────────────────────────────────────

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ): Promise<void> {
    const user = client.data.user as AuthUser;
    if (!user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // The same call the REST route makes, so the socket path gets the
      // recipient checks too rather than being a way around them.
      const msg = await this.communicationService.sendMessage(payload, user);

      // Confirm to sender
      client.emit('messageSent', msg);

      // Deliver to recipient's room (all their sockets)
      this.server.to(payload.recipientId).emit('newMessage', msg);

      this.logger.debug(
        `📩 ${user.userId.substring(0, 8)} → ${payload.recipientId.substring(0, 8)}`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send message';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { recipientId: string; isTyping: boolean },
  ): void {
    const user = client.data.user as AuthUser;
    if (!user) return;

    // Forward typing indicator to the recipient
    this.server.to(payload.recipientId).emit('typing', {
      userId: user.userId,
      userName: user.email, // client can override with display name
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string },
  ): Promise<void> {
    const user = client.data.user as AuthUser;
    if (!user) return;

    try {
      const updated = await this.communicationService.markRead(
        payload.messageId,
        user.userId,
        user.schoolId,
      );

      // Notify the sender that their message was read
      const senderId = String(updated.sender);
      this.server.to(senderId).emit('messageRead', {
        messageId: payload.messageId,
        readBy: user.userId,
        readAt: updated.readAt,
      });
    } catch {
      // Message not found or already read — no-op
    }
  }

  // ── Helpers ─────────────────────────────────────────────

  private authenticate(client: Socket): AuthUser | null {
    // Preferred: socket.io auth handshake
    const token: string | undefined = client.handshake?.auth?.token;
    // Fallback: query param
    const queryToken: string | undefined =
      client.handshake?.query?.token as string;
    // Legacy: Authorization header from extraHeaders
    const extra = client.handshake?.headers as Record<string, string> | undefined;
    const header = extra?.authorization ?? extra?.Authorization;
    const headerToken = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    const finalToken = token ?? queryToken ?? headerToken;

    if (!finalToken) {
      this.logger.warn(`Connection rejected: no token (${client.id})`);
      client.emit('error', { message: 'Unauthorized – no token provided' });
      client.disconnect();
      return null;
    }

    try {
      const payload = this.jwt.verify<{
        sub: string;
        email: string;
        role: string;
        schoolId: string | null;
      }>(finalToken, {
        secret: this.config.get<string>('jwt.secret'),
      });

      return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        schoolId: payload.schoolId ?? null,
      };
    } catch {
      this.logger.warn(`Connection rejected: invalid token (${client.id})`);
      client.emit('error', {
        message: 'Unauthorized – invalid or expired token',
      });
      client.disconnect();
      return null;
    }
  }

  // ── Public helpers for other services ───────────────────

  /** Whether a user has any active socket connections. */
  isOnline(userId: string): boolean {
    return (this.online.get(userId)?.size ?? 0) > 0;
  }

  /** All currently online user ids. */
  get onlineUserIds(): string[] {
    return Array.from(this.online.keys());
  }
}
