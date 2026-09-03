'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SERVER_ROOT } from '@/lib/api/config';
import { getAccessToken } from '@/lib/api/tokens';
import type { Message } from '@/lib/api/types';

/** Who is typing at us right now, and when we last heard from them. */
interface TypingState {
  userId: string;
  at: number;
}

export interface ChatSocket {
  /** True once the gateway has accepted the connection. */
  connected: boolean;
  /** Ids of contacts currently online. */
  onlineUserIds: string[];
  /** True while the open conversation's counterpart is typing. */
  peerTyping: boolean;
  /** Tell the other party we are (or have stopped) typing. */
  sendTyping: (recipientId: string, isTyping: boolean) => void;
}

/**
 * Live chat over the backend's Socket.IO gateway.
 *
 * The gateway pushes `newMessage` the instant a message is written, so the
 * thread updates without waiting for a poll. Delivery still goes over REST:
 * the socket is for *receiving*, which keeps one code path for sending and
 * means a dropped connection degrades to "not instant" rather than "broken".
 *
 * @param userId      the signed-in user, used to ignore our own echo
 * @param peerId      the open conversation's counterpart, or null
 * @param onMessage   called for every message that arrives or is confirmed
 */
export function useChatSocket({
  userId,
  peerId,
  onMessage,
}: {
  userId: string;
  peerId: string | null;
  onMessage: (message: Message) => void;
}): ChatSocket {
  const [connected, setConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typing, setTyping] = useState<TypingState | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Held in a ref so reconnecting is not tied to the callback's identity —
  // otherwise every parent re-render would tear the socket down and rebuild it.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!userId) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = io(`${SERVER_ROOT}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('onlineUsers', (ids: string[]) => setOnlineUserIds(ids ?? []));
    socket.on('userOnline', ({ userId: id }: { userId: string }) =>
      setOnlineUserIds((current) => (current.includes(id) ? current : [...current, id])),
    );
    socket.on('userOffline', ({ userId: id }: { userId: string }) =>
      setOnlineUserIds((current) => current.filter((x) => x !== id)),
    );

    // `newMessage` is what arrives for us; `messageSent` confirms our own,
    // which matters when the same account is open in two places.
    socket.on('newMessage', (message: Message) => onMessageRef.current(message));
    socket.on('messageSent', (message: Message) => onMessageRef.current(message));

    socket.on('typing', ({ userId: id, isTyping }: { userId: string; isTyping: boolean }) =>
      setTyping(isTyping ? { userId: id, at: Date.now() } : null),
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  // A "stopped typing" event can be lost, which would leave the indicator up
  // for good. Expire it on a timer so it can only ever be briefly wrong.
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setTyping(null), 3500);
    return () => clearTimeout(timer);
  }, [typing]);

  return {
    connected,
    onlineUserIds,
    peerTyping: !!peerId && typing?.userId === peerId,
    sendTyping: (recipientId, isTyping) => {
      socketRef.current?.emit('typing', { recipientId, isTyping });
    },
  };
}
