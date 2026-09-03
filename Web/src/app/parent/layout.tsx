'use client';

import type { ReactNode } from 'react';
import { RoleShell } from '@/components/layout/role-shell';
import { RequireRole } from '@/lib/auth/auth-context';
import { ChildProvider } from '@/lib/parent/child-context';

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="parent">
      <ChildProvider>
        <RoleShell role="parent">{children}</RoleShell>
      </ChildProvider>
    </RequireRole>
  );
}
