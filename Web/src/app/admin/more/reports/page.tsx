'use client';

import { useQuery } from '@tanstack/react-query';
import { GraduationCap, IndianRupee, LayoutGrid, TrendingUp, Users } from 'lucide-react';
import { classesApi, dashboardApi, feesApi, studentsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { className as classLabel, entityId } from '@/lib/api/types';
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  SectionTitle,
  StatTile,
} from '@/components/ui/primitives';
import { TileGrid } from '@/components/ui/data-list';
import { count, formatCurrency, toIsoDate } from '@/lib/utils';
import { useTeacherAttendance } from '@/lib/hooks/use-teacher-attendance';

/**
 * The school at a glance — attendance, money and enrolment for today.
 *
 * The dashboard answers "what needs me now"; this answers "how are we doing".
 * Every number here is read from an endpoint that already exists, so nothing
 * is computed twice: the one exception is teacher attendance, which the API
 * reports per staff member rather than as a summary.
 */
export default function AdminReportsPage() {
  const today = toIsoDate(new Date());

  const summary = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.summary });
  const studentStats = useQuery({ queryKey: ['students', 'stats'], queryFn: studentsApi.stats });
  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const collection = useQuery({
    queryKey: ['fees', 'collection'],
    queryFn: () => feesApi.collectionReport(),
  });
  const outstanding = useQuery({
    queryKey: ['fees', 'outstanding'],
    queryFn: feesApi.outstandingReport,
  });
  // Roster-and-records, not records alone: `/attendance/staff` omits anyone
  // nobody has marked, so counting it directly reports "0 unmarked" forever.
  const teachers = useTeacherAttendance(today);

  const attendance = summary.data?.attendance;

  const loading = summary.isLoading || studentStats.isLoading;
  const error = summary.error ?? studentStats.error;

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Your school today" />

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => summary.refetch()} />
      ) : loading ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-5">
          <TileGrid>
            <StatTile
              label="Students"
              value={studentStats.data?.total ?? '—'}
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
              label="Classes"
              value={classes.data?.length ?? '—'}
              icon={<LayoutGrid className="size-5" />}
              color="var(--color-gold)"
            />
          </TileGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle title="Today's student attendance" />
              {!attendance?.total ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Nobody is due to be marked today.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Pill label="Present" value={attendance.present ?? 0} tone="var(--color-success)" />
                    <Pill label="Absent" value={attendance.absent ?? 0} tone="var(--color-danger)" />
                    <Pill
                      label="Unmarked"
                      value={attendance.notMarked ?? 0}
                      tone="var(--color-gold)"
                    />
                  </div>
                  <Progress
                    label="Marked"
                    value={attendance.marked ?? 0}
                    total={attendance.total ?? 0}
                  />
                </>
              )}
            </Card>

            <Card>
              <SectionTitle title="Today's teacher attendance" />
              {teachers.isLoading ? (
                <ListSkeleton rows={2} />
              ) : !teachers.total ? (
                <p className="text-sm text-[var(--color-text-muted)]">No teacher accounts yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Pill label="Present" value={teachers.present} tone="var(--color-success)" />
                    <Pill label="Absent" value={teachers.absent} tone="var(--color-danger)" />
                    <Pill
                      label="Unmarked"
                      value={teachers.total - teachers.marked}
                      tone="var(--color-gold)"
                    />
                  </div>
                  <Progress label="Marked" value={teachers.marked} total={teachers.total} />
                </>
              )}
            </Card>

            <Card>
              <SectionTitle title="Fees" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Money
                  label="Collected"
                  amount={collection.data?.totalCollected ?? 0}
                  tone="var(--color-success)"
                  icon={<TrendingUp className="size-5" />}
                />
                <Money
                  label="Outstanding"
                  amount={outstanding.data?.totalOutstanding ?? 0}
                  tone="var(--color-danger)"
                  icon={<IndianRupee className="size-5" />}
                />
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                {count(collection.data?.paymentCount ?? 0, 'payment')} received ·{' '}
                {count(outstanding.data?.outstandingInvoices ?? 0, 'invoice')} pending
              </p>
            </Card>

            <Card>
              <SectionTitle title="Enrolment by class" />
              {classes.isLoading ? (
                <ListSkeleton rows={3} />
              ) : !classes.data?.length ? (
                <EmptyState title="No classes yet" />
              ) : (
                <div className="space-y-3">
                  {classes.data.map((schoolClass) => (
                    <Progress
                      key={entityId(schoolClass)}
                      label={classLabel(schoolClass)}
                      value={schoolClass.enrolled ?? 0}
                      total={schoolClass.capacity ?? 0}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div
      className="rounded-[var(--radius-input)] py-3 text-center"
      style={{ backgroundColor: `color-mix(in oklab, ${tone} 12%, transparent)` }}
    >
      <p className="font-display text-2xl font-extrabold" style={{ color: tone }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: tone }}>
        {label}
      </p>
    </div>
  );
}

/**
 * A labelled bar.
 *
 * A class with no capacity set has nothing to be a fraction of, so it shows
 * the count alone rather than a bar that is always full or always empty.
 */
function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : null;
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-bold">{label}</span>
        <span className="shrink-0 text-[var(--color-text-muted)]">
          {pct === null ? value : `${value}/${total}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function Money({
  label,
  amount,
  tone,
  icon,
}: {
  label: string;
  amount: number;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-[var(--radius-input)] p-3.5"
      style={{ backgroundColor: `color-mix(in oklab, ${tone} 10%, transparent)` }}
    >
      <span className="shrink-0" style={{ color: tone }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg font-bold" style={{ color: tone }}>
          {formatCurrency(amount)}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      </div>
    </div>
  );
}
