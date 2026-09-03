'use client';

import type { ReactNode } from 'react';
import { RoleShell } from '@/components/layout/role-shell';
import { RequireRole } from '@/lib/auth/auth-context';
import { SubscriptionBanner } from '@/components/admin/subscription-banner';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="admin">
      <RoleShell role="admin">
        {/* A lapsed platform subscription puts the school into read-only mode,
            so the warning belongs on every admin screen, not just billing. */}
        <SubscriptionBanner />
        {children}
      </RoleShell>
    </RequireRole>
  );
}
