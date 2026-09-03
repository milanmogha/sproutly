'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Baby,
  BookOpen,
  CalendarCheck,
  Images,
  IndianRupee,
  Megaphone,
  PartyPopper,
  TriangleAlert,
} from 'lucide-react';
import {
  academicApi,
  classesApi,
  communicationApi,
  daycareApi,
  eventsApi,
  feesApi,
} from '@/lib/api/endpoints';
import {
  className as classLabel,
  diaryEntries,
  entityId,
  invoiceBalance,
  listOf,
  refId,
  studentName,
  type Invoice,
} from '@/lib/api/types';
import { useChild } from '@/lib/parent/child-context';
import { ChildSwitcher } from '@/components/parent/child-switcher';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  InkCard,
  ListSkeleton,
  SectionTitle,
  Skeleton,
} from '@/components/ui/primitives';
import { formatCurrency, formatDate, formatRelative, greeting, toIsoDate } from '@/lib/utils';

/**
 * The parent's landing screen: who their child is, what happened today, and
 * anything that needs them — an unpaid invoice, a new circular, an alert.
 */
export default function ParentHomePage() {
  const { selected, loading } = useChild();
  const studentId = selected ? entityId(selected) : '';
  const classId = refId(selected?.classId);

  const diary = useQuery({
    queryKey: ['parent', 'diary', studentId],
    queryFn: () => daycareApi.diary(studentId, { date: toIsoDate() }),
    enabled: !!studentId,
  });

  const invoices = useQuery({
    queryKey: ['parent', 'invoices', studentId],
    queryFn: () => feesApi.studentInvoices(studentId),
    enabled: !!studentId,
  });

  const homework = useQuery({
    queryKey: ['parent', 'homework', classId],
    queryFn: () => academicApi.homework({ classId }),
    enabled: !!classId,
  });

  const circulars = useQuery({
    queryKey: ['parent', 'circulars'],
    queryFn: () => communicationApi.circulars(),
  });

  const alerts = useQuery({
    queryKey: ['parent', 'alerts'],
    queryFn: () => communicationApi.alerts(),
  });

  const events = useQuery({
    queryKey: ['parent', 'events'],
    queryFn: () => eventsApi.list({ upcoming: true }),
  });

  // The parent's student record carries a bare class id, so the class list is
  // what turns it into "Nursery A".
  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  const outstanding = (invoices.data ?? []).filter(
    (invoice) => invoice.status !== 'paid' && invoiceBalance(invoice) > 0,
  );
  const owed = outstanding.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);

  // The API groups the day's logs by kind; flatten them into one timeline.
  const diaryLog = diaryEntries(diary.data);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-[var(--radius-card)]" />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (!selected) {
    return (
      <EmptyState
        icon={<Baby className="size-6" />}
        title="No children linked yet"
        message="Your school hasn't linked a child to this account. Please contact the school office."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ChildSwitcher />

      {/* Hero: the child, front and centre. */}
      <section className="overflow-hidden rounded-[var(--radius-card)] bg-hero p-5 text-white shadow-[var(--shadow-card)] sm:p-7">
        <p className="text-sm font-semibold text-white/80">{greeting()}</p>
        <div className="mt-3 flex items-center gap-4">
          <Avatar
            name={studentName(selected)}
            id={entityId(selected)}
            src={selected.photoUrl}
            size={64}
            className="ring-4 ring-white/30"
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">
              {studentName(selected)}
            </h1>
            <p className="text-sm text-white/80">
              {classLabel(selected.classId, classes.data)} · {selected.admissionNumber}
            </p>
          </div>
        </div>
      </section>

      {/* Anything urgent gets its own band, above the fold. */}
      {!!alerts.data?.length && (
        <Card className="border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/5">
          <div className="flex gap-3">
            <TriangleAlert className="size-5 shrink-0 text-[var(--color-danger)]" />
            <div className="min-w-0">
              <p className="font-display font-bold text-[var(--color-danger)]">
                {alerts.data[0].title}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">{alerts.data[0].message}</p>
            </div>
          </div>
        </Card>
      )}

      {owed > 0 && <FeesDueCard total={owed} invoices={outstanding} />}

      {/* Quick links — the four things parents open most. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickLink
          href="/parent/attendance"
          label="Attendance"
          icon={<CalendarCheck className="size-5" />}
          color="var(--color-teal)"
        />
        <QuickLink
          href="/parent/fees"
          label="Fees"
          icon={<IndianRupee className="size-5" />}
          color="var(--color-coral)"
        />
        <QuickLink
          href="/parent/academics"
          label="Academics"
          icon={<BookOpen className="size-5" />}
          color="var(--color-blue)"
        />
        <QuickLink
          href="/parent/more/gallery"
          label="Gallery"
          icon={<Images className="size-5" />}
          color="var(--color-pink)"
        />
      </div>

      {/* Today's diary — the reason most parents open the app at all. */}
      <section>
        <SectionTitle title="Today at school" />
        {diary.isLoading ? (
          <ListSkeleton rows={2} />
        ) : !diaryLog.length ? (
          <EmptyState
            icon={<Baby className="size-6" />}
            title="Nothing logged yet"
            message="Your child's teacher hasn't posted today's updates."
          />
        ) : (
          <div className="space-y-2.5">
            {diaryLog.map((entry, index) => (
              <Card key={`${entry.kind}-${index}`} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-tint text-accent">
                  <Baby className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold">{entry.title}</p>
                  {entry.subtitle && (
                    <p className="text-sm text-[var(--color-text-muted)]">{entry.subtitle}</p>
                  )}
                </div>
                {entry.when && (
                  <span className="shrink-0 text-xs font-bold text-[var(--color-text-muted)]">
                    {formatRelative(entry.when)}
                  </span>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="fit-children grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle
            title="Homework"
            action={
              <Link href="/parent/academics" className="text-sm font-bold text-accent">
                See all
              </Link>
            }
          />
          {homework.isLoading ? (
            <ListSkeleton rows={2} />
          ) : !homework.data?.length ? (
            <EmptyState title="No homework set" />
          ) : (
            <div className="space-y-2.5">
              {homework.data.slice(0, 3).map((item) => (
                <Card key={entityId(item)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display font-bold">{item.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{item.subject}</p>
                    </div>
                    {item.dueDate && (
                      <Badge tone="warning">Due {formatDate(item.dueDate)}</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            title="Notices"
            action={
              <Link href="/parent/more/circulars" className="text-sm font-bold text-accent">
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
                    <p className="line-clamp-2 text-sm text-[var(--color-text-muted)]">
                      {circular.body}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {!!listOf(events.data).length && (
        <section>
          <SectionTitle
            title="Coming up"
            action={
              <Link href="/parent/more/events" className="text-sm font-bold text-accent">
                See all
              </Link>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {listOf(events.data).slice(0, 2).map((event) => (
              <InkCard key={entityId(event)} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10">
                  <PartyPopper className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display font-bold">{event.title}</p>
                  <p className="text-sm text-[var(--color-on-ink)]/70">
                    {formatDate(event.startDate)}
                    {event.venue ? ` · ${event.venue}` : ''}
                  </p>
                </div>
              </InkCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FeesDueCard({ total, invoices }: { total: number; invoices: Invoice[] }) {
  return (
    <Link href="/parent/fees" className="block">
      <Card className="flex items-center gap-4 border border-[var(--color-coral)]/25 transition hover:-translate-y-0.5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-coral)]/15 text-[var(--color-coral)]">
          <IndianRupee className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold">{formatCurrency(total)} due</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {invoices.length} unpaid {invoices.length === 1 ? 'invoice' : 'invoices'} · tap to pay
          </p>
        </div>
      </Card>
    </Link>
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
      className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-white p-4 text-center shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
    >
      <span
        className="grid size-11 place-items-center rounded-2xl text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <span className="text-sm font-bold">{label}</span>
    </Link>
  );
}
