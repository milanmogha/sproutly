'use client';

import { LeaveScreen } from '@/components/shared/leave-screen';

export default function AdminLeavePage() {
  // The office decides on everyone's leave — staff and students alike.
  return <LeaveScreen mode="review" title="Leave requests" />;
}
