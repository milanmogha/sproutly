'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  Megaphone,
  MessageSquare,
  Plane,
  Users,
} from 'lucide-react';
import {
  attendanceApi,
  communicationApi,
  dashboardApi,
  leaveApi,
} from '@/lib/api/endpoints';
import {
  className as classLabel,
  entityId,
  listOf,
  ptmStudentName,
} from '@/lib/api/types';
import { useClasses } from '@/lib/hooks/use-classes';
import { ClassPicker } from '@/components/shared/class-picker';
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
import { formatDate, formatRelative, greeting, humanize, toIsoDate } from '@/lib/utils';

/** The teacher's day at a glance: their classes, today's roll call, what's pending. */
export default function TeacherHomePage() {
  const { classes, selectedId, select, isLoading } = useClasses();
  const today = toIsoDate();

  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.summary,
  });

  const todayAttendance = useQuery({
    queryKey: ['attendance', 'class', selectedId, today],
    queryFn: () => attendanceApi.forClass(selectedId, { date: today }),
    enabled: !!selectedId,
  });

  const ptm = useQuery({
    queryKey: ['ptm', 'respond'],
    queryFn: communicationApi.assignedPtm,
  });

  const leaves = useQuery({
    queryKey: ['leave', 'class'],
    queryFn: () => leaveApi.forClass({ status: 'pending' }),
  });

  const circulars = useQuery({
    queryKey: ['circulars'],
    queryFn: () => communicationApi.circulars(),
  });

  const marked = todayAttendance.data?.length ?? 0;
  const present = (todayAttendance.data ?? []).filter((r) => r.status === 'present').length;
  const pendingPtm = (ptm.data ?? []).filter((r) => r.status === 'requested').length;

  return (
    <div className="space-y-6">
      <PageHeader title={greeting()} subtitle="Here's your day" />

      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : !classes.length ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No classes assigned"
          message="Once the office assigns you a class, it will show up here."
        />
      ) : (
        <>
          <ClassPicker classes={classes} selectedId={selectedId} onSelect={select} />

          <TileGrid>
            <StatTile
              label="Students"
              value={summary.data?.students?.total ?? '—'}
              icon={<Users className="size-5" />}
              color="var(--color-teal)"
            />
            <StatTile
              label="Marked today"
              value={marked}
              hint={marked ? `${present} present` : 'Roll call not taken'}
              icon={<ClipboardList className="size-5" />}
              color={marked ? 'var(--color-success)' : 'var(--color-sunny)'}
            />
            <StatTile
              label="PTM requests"
              value={pendingPtm}
              icon={<GraduationCap className="size-5" />}
              color="var(--color-grape)"
            />
            <StatTile
              label="Leave to review"
              value={listOf(leaves.data).length}
              icon={<Plane className="size-5" />}
              color="var(--color-coral)"
            />
          </TileGrid>

          {/* Taking the register is the teacher's main daily job — make it the
              loudest thing on the page until it's done. */}
          {marked === 0 && (
            <Link href="/teacher/attendance" className="block">
              <Card className="flex items-center gap-4 bg-hero text-white transition hover:-translate-y-0.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20">
                  <ClipboardList className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">Take today&apos;s register</p>
                  <p className="text-sm text-white/80">
                    {classLabel(classes.find((c) => entityId(c) === selectedId))} ·{' '}
                    {formatDate(today)}
                  </p>
                </div>
              </Card>
            </Link>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QuickLink
              href="/teacher/attendance"
              label="Attendance"
              icon={<ClipboardList className="size-5" />}
              color="var(--color-teal)"
            />
            <QuickLink
              href="/teacher/students"
              label="Students"
              icon={<Users className="size-5" />}
              color="var(--color-blue)"
            />
            <QuickLink
              href="/teacher/academics"
              label="Academics"
              icon={<BookOpen className="size-5" />}
              color="var(--color-grape)"
            />
            <QuickLink
              href="/teacher/more/messages"
              label="Messages"
              icon={<MessageSquare className="size-5" />}
              color="var(--color-coral)"
            />
          </div>

          <div className="fit-children grid gap-6 lg:grid-cols-2">
            <section>
              <SectionTitle
                title="Meeting requests"
                action={
                  <Link href="/teacher/more/ptm" className="text-sm font-bold text-accent">
                    See all
                  </Link>
                }
              />
              {ptm.isLoading ? (
                <ListSkeleton rows={2} />
              ) : !ptm.data?.length ? (
                <EmptyState title="No meeting requests" />
              ) : (
                <div className="space-y-2.5">
                  {ptm.data.slice(0, 3).map((request) => (
                    <Card key={entityId(request)} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold">
                          {ptmStudentName(request)}
                        </p>
                        <p className="line-clamp-1 text-sm text-[var(--color-text-muted)]">
                          {request.reason}
                        </p>
                      </div>
                      <Badge tone={request.status === 'requested' ? 'warning' : 'success'}>
                        {humanize(request.status)}
                      </Badge>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle
                title="Notices"
                action={
                  <Link href="/teacher/more/circulars" className="text-sm font-bold text-accent">
                    See all
                  </Link>
                }
              />
              {circulars.isLoading ? (
                <ListSkeleton rows={2} />
              ) : !circulars.data?.length ? (
                <EmptyState title="No notices" />
              ) : (
                <div className="space-y-2.5">
                  {circulars.data.slice(0, 3).map((circular) => (
                    <Card key={entityId(circular)} className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--color-gold)]/20 text-[#8a6200]">
                        <Megaphone className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold">{circular.title}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatRelative(circular.publishedAt ?? circular.createdAt)}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
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
