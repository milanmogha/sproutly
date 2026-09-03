'use client';

import type { ReactNode } from 'react';
import { RoleShell } from '@/components/layout/role-shell';
import { RequireRole } from '@/lib/auth/auth-context';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="super_admin">
      <RoleShell role="super_admin">{children}</RoleShell>
    </RequireRole>
  );
}
