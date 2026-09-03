'use client';

import { CircularsScreen } from '@/components/shared/circulars-screen';

export default function AdminCircularsPage() {
  // The office can also broadcast emergency alerts, which parents see as a
  // banner on their home screen.
  return <CircularsScreen canManage allowAlerts />;
}
