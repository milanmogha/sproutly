import { http } from './client';

/** A user-facing notification, as stored by the backend. */
export interface AppNotification {
  _id: string;
  title: string;
  body: string;
  /** Backend type, e.g. `profile_change_request` — drives icon and deep link. */
  type: string;
  /** Arbitrary payload, e.g. `{ studentId }`, used to route on click. */
  data?: Record<string, unknown>;
  read: boolean;
  sentAt?: string | null;
  createdAt?: string;
}

export const notificationsApi = {
  mine: () => http.get<AppNotification[]>('/notifications/me'),
  markRead: (id: string) => http.patch<void>(`/notifications/${id}/read`),
  markAllRead: () => http.patch<void>('/notifications/read-all'),
  remove: (id: string) => http.delete<void>(`/notifications/${id}`),
  clearRead: () => http.delete<void>('/notifications/clear-read'),
};

/** The relative bucket a notification is filed under in the list. */
export function notificationGroup(notification: AppNotification): string {
  const raw = notification.sentAt ?? notification.createdAt;
  if (!raw) return 'Earlier';
  const date = new Date(raw);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (isSameDay(date, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return 'Earlier';
}

/**
 * Where a notification should take the user when clicked, scoped to the
 * portal they're in. Returns null when the type carries nowhere to go.
 */
export function notificationLink(
  notification: AppNotification,
  rolePath: string,
): string | null {
  const studentId = notification.data?.studentId;
  switch (notification.type) {
    case 'attendance':
      return `${rolePath}/attendance`;
    case 'fee_due':
    case 'invoice_generated':
    case 'payment_received':
      return `${rolePath}/fees`;
    case 'homework':
    case 'assessment':
    case 'result':
      return `${rolePath}/academics`;
    case 'message':
      return `${rolePath}/more/messages`;
    case 'circular':
      return `${rolePath}/more/circulars`;
    case 'ptm':
      return `${rolePath}/more/ptm`;
    case 'leave':
      return `${rolePath}/more/leave`;
    case 'profile_change_request':
      return typeof studentId === 'string' ? `${rolePath}/students/${studentId}` : null;
    default:
      return null;
  }
}
