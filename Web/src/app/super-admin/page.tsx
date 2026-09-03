'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Crown, TriangleAlert, UsersRound } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ownersApi, schoolsApi, subscriptionsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { listOf, type SubscriptionPhase } from '@/lib/api/types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  SectionTitle,
  StatTile,
} from '@/components/ui/primitives';
import { TileGrid } from '@/components/ui/data-list';
import { formatDate, greeting, humanize } from '@/lib/utils';

const PHASE_COLOR: Record<string, string> = {
  active: 'var(--color-success)',
  trial: 'var(--color-blue)',
  grace: 'var(--color-sunny)',
  expired: 'var(--color-danger)',
  suspended: 'var(--color-danger)',
  unbilled: 'var(--color-text-muted)',
  none: 'var(--color-hairline)',
};

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

/** The platform at a glance: every school, and who is behind on paying. */
export default function SuperAdminHomePage() {
  const stats = useQuery({ queryKey: ['schools', 'stats'], queryFn: schoolsApi.stats });
  const owners = useQuery({ queryKey: ['owners'], queryFn: ownersApi.list });
  // `/subscriptions/overview` is the per-school list; `/subscriptions` is a
  // flat ledger of every invoice, which is not what this screen counts.
  const billing = useQuery({
    queryKey: ['subscriptions', 'overview'],
    queryFn: subscriptionsApi.overview,
  });

  const rows = billing.data ?? [];

  // Anything that isn't healthy needs a human — surface it first.
  const needsAttention = rows.filter((row) =>
    ['grace', 'expired', 'suspended'].includes(row.phase ?? ''),
  );

  const phaseCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const phase = row.phase ?? 'none';
    acc[phase] = (acc[phase] ?? 0) + 1;
    return acc;
  }, {});
  const phaseData = Object.entries(phaseCounts).map(([phase, count]) => ({
    name: humanize(phase),
    phase,
    value: count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={greeting()} subtitle="Across every school on Sproutly" />

      <TileGrid>
        <StatTile
          label="Schools"
          value={stats.data?.total ?? '—'}
          icon={<Building2 className="size-5" />}
          color="var(--color-super)"
        />
        <StatTile
          label="Active"
          value={stats.data?.byStatus?.active ?? 0}
          color="var(--color-success)"
        />
        <StatTile
          label="Owners"
          value={listOf(owners.data).length}
          icon={<Crown className="size-5" />}
          color="var(--color-grape)"
        />
        <StatTile
          label="Need attention"
          value={needsAttention.length}
          hint="Grace, expired or suspended"
          icon={<TriangleAlert className="size-5" />}
          color={needsAttention.length ? 'var(--color-danger)' : 'var(--color-hairline)'}
        />
      </TileGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Subscriptions" />
          {billing.isLoading ? (
            <ListSkeleton rows={2} />
          ) : billing.error ? (
            <ErrorState message={errorMessage(billing.error)} onRetry={() => billing.refetch()} />
          ) : !phaseData.length ? (
            <EmptyState title="No subscription data" />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-48 w-full sm:w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={phaseData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                    >
                      {phaseData.map((entry) => (
                        <Cell
                          key={entry.phase}
                          fill={PHASE_COLOR[entry.phase] ?? 'var(--color-hairline)'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--color-hairline)',
                        fontSize: 13,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full flex-1 space-y-1.5">
                {phaseData.map((entry) => (
                  <li key={entry.phase} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-3 shrink-0 rounded"
                      style={{ backgroundColor: PHASE_COLOR[entry.phase] }}
                    />
                    <span className="flex-1">{entry.name}</span>
                    <span className="font-bold">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Needs attention"
            action={
              <Link href="/super-admin/schools" className="text-sm font-bold text-accent">
                All schools
              </Link>
            }
          />
          {billing.isLoading ? (
            <ListSkeleton rows={2} />
          ) : !needsAttention.length ? (
            <EmptyState title="Everything is healthy" message="No school is behind on payment." />
          ) : (
            <ul className="space-y-2">
              {needsAttention.slice(0, 6).map((row) => (
                <li key={row.school.id}>
                  <Link
                    href={`/super-admin/schools/${row.school.id}`}
                    className="flex items-center gap-3 rounded-[var(--radius-input)] px-2 py-2 transition hover:bg-[var(--color-canvas)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{row.school.name}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {row.school.code} · ends {formatDate(row.periodEnd)}
                      </span>
                    </span>
                    <Badge tone={PHASE_TONE[row.phase ?? 'none']}>
                      {humanize(row.phase)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink
          href="/super-admin/schools"
          label="Schools"
          icon={<Building2 className="size-5" />}
          color="var(--color-super)"
        />
        <QuickLink
          href="/super-admin/owners"
          label="Owners"
          icon={<Crown className="size-5" />}
          color="var(--color-grape)"
        />
        <QuickLink
          href="/super-admin/users"
          label="Users"
          icon={<UsersRound className="size-5" />}
          color="var(--color-blue)"
        />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon,
  color,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-2xl text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <span className="font-bold">{label}</span>
    </Link>
  );
}
