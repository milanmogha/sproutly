'use client';

import { MessagesScreen } from '@/components/shared/messages-screen';

export default function TeacherMessagesPage() {
  // Teachers message the parents of children in their own classes — the
  // compose picker resolves that roster from the signed-in teacher's classes.
  return <MessagesScreen role="teacher" />;
}
