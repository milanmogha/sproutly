'use client';

import type { ReactNode } from 'react';
import { RoleShell } from '@/components/layout/role-shell';
import { RequireRole } from '@/lib/auth/auth-context';

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="teacher">
      <RoleShell role="teacher">{children}</RoleShell>
    </RequireRole>
  );
}
