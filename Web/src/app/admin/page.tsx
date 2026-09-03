'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  GraduationCap,
  IndianRupee,
  Megaphone,
  Plane,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  communicationApi,
  dashboardApi,
  feesApi,
  leaveApi,
  studentsApi,
} from '@/lib/api/endpoints';
import { entityId, listOf } from '@/lib/api/types';
import {
  Badge,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  SectionTitle,
  StatTile,
} from '@/components/ui/primitives';
import { TileGrid } from '@/components/ui/data-list';
import { count, formatCurrency, formatRelative, greeting, humanize } from '@/lib/utils';

/** The school at a glance: headcount, today's attendance, money, and what's pending. */
export default function AdminHomePage() {
  const summary = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.summary });

  const studentStats = useQuery({
    queryKey: ['students', 'stats'],
    queryFn: studentsApi.stats,
  });

  const outstanding = useQuery({
    queryKey: ['fees', 'outstanding'],
    queryFn: feesApi.outstandingReport,
  });

  const collection = useQuery({
    queryKey: ['fees', 'collection'],
    queryFn: () => feesApi.collectionReport(),
  });

  const leaves = useQuery({
    queryKey: ['leave', 'admin', 'pending'],
    queryFn: () => leaveApi.list({ status: 'pending' }),
  });

  const ptm = useQuery({
    queryKey: ['ptm', 'all'],
    queryFn: () => communicationApi.allPtm({ status: 'requested' }),
  });

  const circulars = useQuery({
    queryKey: ['circulars'],
    queryFn: () => communicationApi.circulars(),
  });

  // The status breakdown makes a clean, honest bar chart — no invented series.
  const statusData = Object.entries(studentStats.data?.byStatus ?? {}).map(([status, count]) => ({
    status: humanize(status),
    count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={greeting()} subtitle="Your school today" />

      <TileGrid>
        <StatTile
          label="Students"
          value={studentStats.data?.total ?? summary.data?.students?.total ?? '—'}
          icon={<Users className="size-5" />}
          color="var(--color-brand)"
        />
        <StatTile
          label="Staff"
          value={summary.data?.staff?.total ?? '—'}
          icon={<GraduationCap className="size-5" />}
          color="var(--color-teal)"
        />
        <StatTile
          label="Collected"
          value={formatCurrency(collection.data?.totalCollected ?? 0)}
          hint={count(collection.data?.paymentCount ?? 0, 'payment')}
          icon={<TrendingUp className="size-5" />}
          color="var(--color-success)"
        />
        <StatTile
          label="Outstanding"
          value={formatCurrency(outstanding.data?.totalOutstanding ?? 0)}
          hint={count(outstanding.data?.outstandingInvoices ?? 0, 'invoice')}
          icon={<IndianRupee className="size-5" />}
          color="var(--color-coral)"
        />
      </TileGrid>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink
          href="/admin/students"
          label="Students"
          icon={<Users className="size-5" />}
          color="var(--color-brand)"
        />
        <QuickLink
          href="/admin/attendance"
          label="Attendance"
          icon={<ClipboardList className="size-5" />}
          color="var(--color-teal)"
        />
        <QuickLink
          href="/admin/fees"
          label="Fees"
          icon={<IndianRupee className="size-5" />}
          color="var(--color-coral)"
        />
        <QuickLink
          href="/admin/more/admissions"
          label="Admissions"
          icon={<UserPlus className="size-5" />}
          color="var(--color-grape)"
        />
      </div>

      <div className="fit-children grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Students by status" />
          {studentStats.isLoading ? (
            <ListSkeleton rows={2} />
          ) : !statusData.length ? (
            <EmptyState title="No students yet" />
          ) : (
            // ResponsiveContainer is what keeps the chart honest at every width.
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" vertical={false} />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-canvas)' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-hairline)',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--color-brand)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-sky)]/15 text-[var(--color-sky)]">
              <Plane className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold">
                {listOf(leaves.data).length} leave requests
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">Waiting on your decision</p>
            </div>
            <Link href="/admin/more/leave" className="shrink-0 text-sm font-bold text-accent">
              Review
            </Link>
          </Card>

          <Card className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-grape)]/15 text-[var(--color-grape)]">
              <Users className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold">{ptm.data?.length ?? 0} PTM requests</p>
              <p className="text-sm text-[var(--color-text-muted)]">Parents asking for a meeting</p>
            </div>
            <Link href="/admin/more/ptm" className="shrink-0 text-sm font-bold text-accent">
              Open
            </Link>
          </Card>
        </div>
      </div>

      <section>
        <SectionTitle
          title="Recent notices"
          action={
            <Link href="/admin/more/circulars" className="text-sm font-bold text-accent">
              See all
            </Link>
          }
        />
        {circulars.isLoading ? (
          <ListSkeleton rows={2} />
        ) : !circulars.data?.length ? (
          <EmptyState icon={<Megaphone className="size-6" />} title="No circulars posted" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {circulars.data.slice(0, 4).map((circular) => (
              <Card key={entityId(circular)} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--color-gold)]/20 text-[#8a6200]">
                  <Megaphone className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold">{circular.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatRelative(circular.publishedAt ?? circular.createdAt)}
                  </p>
                </div>
                <Badge tone="accent">{humanize(circular.audience)}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>
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
