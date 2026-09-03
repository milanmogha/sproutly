'use client';

import { LeaveScreen } from '@/components/shared/leave-screen';
import { useChild } from '@/lib/parent/child-context';
import { entityId } from '@/lib/api/types';

export default function ParentLeavePage() {
  const { selected } = useChild();
  // Leave is requested for the child currently selected across the portal.
  return <LeaveScreen mode="apply" studentId={selected ? entityId(selected) : undefined} />;
}
