'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell, ShieldCheck, TrendingUp } from 'lucide-react';
import { subscriptionsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import type { PlatformBillingRow, SubscriptionPhase } from '@/lib/api/types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionTitle,
  StatTile,
} from '@/components/ui/primitives';
import { DataList, TileGrid, type Column } from '@/components/ui/data-list';
import { ProfileScreen } from '@/components/shared/profile-screen';
import { formatDate, humanize } from '@/lib/utils';

const PHASE_TONE: Record<SubscriptionPhase, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> =
  {
    active: 'success',
    trial: 'info',
    grace: 'warning',
    expired: 'danger',
    suspended: 'danger',
    unbilled: 'neutral',
    none: 'neutral',
  };

/** Platform billing across every school, plus the super admin's own account. */
export default function SuperAdminSettingsPage() {
  // One row per school, each carrying its own billing phase. (`/subscriptions`
  // is a flat invoice ledger — using it here keyed every row on the same
  // school object and rendered them blank.)
  const billing = useQuery({
    queryKey: ['subscriptions', 'overview'],
    queryFn: subscriptionsApi.overview,
  });

  const rows = billing.data ?? [];

  const columns: Array<Column<PlatformBillingRow>> = [
    {
      key: 'school',
      header: 'School',
      hideOnCard: true,
      render: (row) => (
        <Link href={`/super-admin/schools/${row.school.id}`} className="min-w-0 block">
          <span className="block truncate font-bold">{row.school.name}</span>
          <span className="block text-xs text-[var(--color-text-muted)]">{row.school.code}</span>
        </Link>
      ),
    },
    {
      key: 'phase',
      header: 'Phase',
      render: (row) => <Badge tone={PHASE_TONE[row.phase]}>{humanize(row.phase)}</Badge>,
    },
    { key: 'ends', header: 'Ends', render: (row) => formatDate(row.periodEnd) },
    {
      key: 'days',
      header: 'Days left',
      align: 'right',
      render: (row) => row.daysRemaining ?? '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Platform billing and your account" />

      <section>
        <SectionTitle title="Subscriptions" />
        <TileGrid className="mb-4">
          <StatTile
            label="Schools"
            value={rows.length}
            icon={<TrendingUp className="size-5" />}
            color="var(--color-super)"
          />
          <StatTile
            label="Active"
            value={rows.filter((r) => r.phase === 'active').length}
            color="var(--color-success)"
          />
          <StatTile
            label="In grace"
            value={rows.filter((r) => r.phase === 'grace').length}
            color="var(--color-sunny)"
          />
          <StatTile
            label="Expired"
            value={rows.filter((r) => r.phase === 'expired').length}
            color="var(--color-danger)"
          />
        </TileGrid>

        <DataList
          rows={rows}
          columns={columns}
          rowKey={(row) => row.school.id}
          loading={billing.isLoading}
          error={
            billing.error ? (
              <ErrorState message={errorMessage(billing.error)} onRetry={() => billing.refetch()} />
            ) : undefined
          }
          empty={<EmptyState icon={<ShieldCheck className="size-6" />} title="No schools yet" />}
          cardTitle={(row) => row.school.name}
          cardSubtitle={(row) => row.school.code}
        />
      </section>

      {/* The super admin's own profile lives here rather than behind a "More"
          tab, since this portal's fifth slot is Settings. */}
      <ProfileScreen />

      <Card className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-tint text-accent">
          <Bell className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">Notifications</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Everything the platform has told you
          </p>
        </div>
        <Link href="/super-admin/notifications" className="shrink-0 text-sm font-bold text-accent">
          Open
        </Link>
      </Card>
    </div>
  );
}
