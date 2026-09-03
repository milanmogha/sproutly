'use client';

import { MessagesScreen } from '@/components/shared/messages-screen';

export default function AdminMessagesPage() {
  // The office sees the whole school: every teacher and parent.
  return <MessagesScreen role="admin" />;
}
