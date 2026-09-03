'use client';

import { LeaveScreen } from '@/components/shared/leave-screen';

export default function TeacherLeavePage() {
  // A teacher applies for their own leave; the office reviews it.
  return <LeaveScreen mode="apply" title="My leave" />;
}
