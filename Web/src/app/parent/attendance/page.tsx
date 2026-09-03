'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { attendanceApi, holidaysApi } from '@/lib/api/endpoints';
import { entityId, type AttendanceRecord } from '@/lib/api/types';
import { useChild } from '@/lib/parent/child-context';
import { ChildSwitcher } from '@/components/parent/child-switcher';
import { Modal } from '@/components/ui/modal';
import { DetailRow, TileGrid } from '@/components/ui/data-list';
import {
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Skeleton,
  StatTile,
} from '@/components/ui/primitives';
import { errorMessage } from '@/lib/api/client';
import { cn, formatDate, formatTime, humanize, toIsoDate } from '@/lib/utils';

/** The colour each attendance status wears, on the calendar and in the legend. */
const STATUS_COLOR: Record<string, string> = {
  present: 'var(--color-success)',
  absent: 'var(--color-danger)',
  late: 'var(--color-sunny)',
  on_leave: 'var(--color-blue)',
  half_day: 'var(--color-purple)',
  holiday: 'var(--color-info)',
};

const LEGEND = Object.entries(STATUS_COLOR);

export default function ParentAttendancePage() {
  const { selected } = useChild();
  const studentId = selected ? entityId(selected) : '';
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [picked, setPicked] = useState<{ date: Date; iso: string } | null>(null);

  const from = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1));
  const to = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  const report = useQuery({
    queryKey: ['parent', 'attendance', studentId, from, to],
    queryFn: () => attendanceApi.studentReport(studentId, { from, to }),
    enabled: !!studentId,
  });

  const holidays = useQuery({
    queryKey: ['holidays', month.getFullYear()],
    queryFn: () => holidaysApi.list({ year: month.getFullYear() }),
  });

  /** Status per `yyyy-MM-dd`, so the grid can look each day up directly. */
  const byDate = useMemo(() => {
    const map = new Map<string, string>();
    report.data?.days?.forEach((day) => map.set(day.date, day.status));
    return map;
  }, [report.data]);

  /** Holiday titles per `yyyy-MM-dd` — a school closure explains a blank day. */
  const holidayByDate = useMemo(() => {
    const map = new Map<string, string>();
    (holidays.data ?? []).forEach((holiday) => {
      if (holiday.date) map.set(holiday.date, holiday.title);
    });
    return map;
  }, [holidays.data]);

  /**
   * The status a calendar cell shows. An attendance record wins over the
   * holiday dot — schools do hold Saturday classes — and a blank day that is
   * a holiday reads as "closed", not "not marked".
   */
  const statusFor = (iso: string) => {
    const recorded = byDate.get(iso);
    if (recorded) return recorded;
    return holidayByDate.has(iso) ? 'holiday' : undefined;
  };

  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const isCurrentMonth =
    month.getFullYear() === new Date().getFullYear() &&
    month.getMonth() === new Date().getMonth();

  const pickedStatus = picked ? statusFor(picked.iso) : undefined;
  const pickedHoliday = picked ? holidayByDate.get(picked.iso) : undefined;
  const pickedRecords = (report.data?.days ?? []).filter(
    (day) => day.date === picked?.iso,
  ) as AttendanceRecord[];

  const changeMonth = (delta: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        subtitle={selected ? `${selected.firstName}'s record` : undefined}
      />
      <ChildSwitcher />

      {report.isLoading ? (
        <Skeleton className="h-24 rounded-[var(--radius-card)]" />
      ) : report.error ? (
        <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />
      ) : (
        <>
          <TileGrid>
            <StatTile
              label="Present"
              value={report.data?.present ?? 0}
              icon={<CalendarCheck className="size-5" />}
              color="var(--color-success)"
            />
            <StatTile
              label="Absent"
              value={report.data?.absent ?? 0}
              color="var(--color-danger)"
            />
            <StatTile label="Late" value={report.data?.late ?? 0} color="var(--color-sunny)" />
            <StatTile
              label="Attendance"
              value={`${report.data?.presentRate ?? 0}%`}
              hint={`${report.data?.marked ?? 0} of ${report.data?.workingDays ?? 0} days`}
              color="var(--color-teal)"
            />
          </TileGrid>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <IconButton
                label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft className="size-5" />
              </IconButton>
              <h2 className="font-display text-lg font-bold">
                {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </h2>
              <IconButton
                label="Next month"
                disabled={isCurrentMonth}
                onClick={() => changeMonth(1)}
              >
                <ChevronRight className="size-5" />
              </IconButton>
            </div>

            {/* The calendar keeps its 7 columns at every width; cells shrink
                instead of the grid wrapping into nonsense. A tap opens the
                day sheet; days without any record or holiday still open so the
                school closure / "not marked" distinction is visible. */}
            <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div
                  key={i}
                  className="pb-1 text-[10px] font-bold text-[var(--color-text-muted)] uppercase"
                >
                  {day}
                </div>
              ))}
              {grid.map((cell, i) => {
                if (!cell) return <div key={`pad-${i}`} />;
                const iso = toIsoDate(cell);
                const status = statusFor(iso);
                const color = status ? STATUS_COLOR[status] : undefined;
                return (
                  <button
                    type="button"
                    key={iso}
                    onClick={() => setPicked({ date: cell, iso })}
                    aria-label={
                      status
                        ? `${formatDate(cell)} — ${humanize(status)}`
                        : formatDate(cell)
                    }
                    className={cn(
                      'grid aspect-square place-items-center rounded-xl text-xs font-bold transition sm:text-sm',
                      'focus-visible:-translate-y-0.5 hover:-translate-y-0.5',
                      color
                        ? 'text-white'
                        : 'bg-[var(--color-canvas)] text-[var(--color-text-muted)] hover:bg-accent-tint',
                    )}
                    style={color ? { backgroundColor: color } : undefined}
                  >
                    {cell.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {LEGEND.map(([status, color]) => (
                <span key={status} className="inline-flex items-center gap-1.5 text-xs font-semibold">
                  <span className="size-3 rounded" style={{ backgroundColor: color }} />
                  {humanize(status)}
                </span>
              ))}
            </div>
          </Card>

          {!report.data?.days?.length && (
            <EmptyState
              icon={<CalendarCheck className="size-6" />}
              title="Nothing marked this month"
              message="Attendance for this month hasn't been recorded yet."
            />
          )}

          <Modal
            open={!!picked}
            onClose={() => setPicked(null)}
            title={picked ? formatDate(picked.date) : ''}
            size="sm"
          >
            {pickedStatus && (
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[pickedStatus] }}
                />
                <p className="font-display font-bold">{humanize(pickedStatus)}</p>
              </div>
            )}
            {pickedHoliday && (
              <p className="mb-3 text-sm font-semibold text-[var(--color-info)]">
                School holiday — {pickedHoliday}
              </p>
            )}
            {pickedRecords.length > 0 ? (
              <dl>
                <DetailRow label="Status" value={humanize(pickedRecords[0].status)} />
                {pickedRecords[0].checkInTime && (
                  <DetailRow
                    label="Check-in"
                    value={formatTime(pickedRecords[0].checkInTime)}
                  />
                )}
                {pickedRecords[0].checkOutTime && (
                  <DetailRow
                    label="Check-out"
                    value={formatTime(pickedRecords[0].checkOutTime)}
                  />
                )}
                {pickedRecords[0].remarks ? (
                  <DetailRow label="Note" value={pickedRecords[0].remarks} />
                ) : null}
              </dl>
            ) : pickedStatus === 'holiday' ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                The school was closed, so no attendance was taken.
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                No attendance was recorded for this day.
              </p>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}

/**
 * A month laid out as 7-column weeks, padded with nulls so the 1st lands under
 * its real weekday.
 */
function buildMonthGrid(month: Date): Array<Date | null> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  return cells;
}

