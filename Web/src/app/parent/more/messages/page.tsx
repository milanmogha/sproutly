'use client';

import { MessagesScreen } from '@/components/shared/messages-screen';
import { useChild } from '@/lib/parent/child-context';

export default function ParentMessagesPage() {
  const { children, selected } = useChild();
  // The compose picker resolves the selected child's class teacher, so the
  // parent's own children come from the portal context.
  return <MessagesScreen role="parent" children={children} selectedChild={selected} />;
}
