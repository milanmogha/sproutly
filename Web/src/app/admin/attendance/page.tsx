'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Save, Users } from 'lucide-react';
import { useState } from 'react';
import { attendanceApi, classesApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  attendanceStudentId,
  attendanceStudentName,
  className as classLabel,
  entityId,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/lib/api/types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  StatTile,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { DataList, TileGrid, type Column } from '@/components/ui/data-list';
import { Input } from '@/components/ui/form';
import { ClassPicker } from '@/components/shared/class-picker';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import {
  useTeacherAttendance,
  type TeacherAttendanceRow,
} from '@/lib/hooks/use-teacher-attendance';
import { cn, formatDate, humanize, toIsoDate } from '@/lib/utils';

const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  on_leave: 'info',
  half_day: 'neutral',
  unmarked: 'neutral',
};

type AttendanceTab = 'students' | 'staff';

/**
 * School-wide attendance for a date: how each class did, and the register for
 * whichever class is selected — plus the staff sheet for the same date.
 */
export default function AdminAttendancePage() {
  const [tab, setTab] = useState<AttendanceTab>('students');
  const [date, setDate] = useState(toIsoDate());
  const [selectedId, setSelectedId] = useState('');
  const [reportFor, setReportFor] = useState<TeacherAttendanceRow | null>(null);

  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  const classList = classes.data ?? [];
  const activeId = selectedId || (classList[0] ? entityId(classList[0]) : '');

  // One request per class, in parallel — there is no school-wide endpoint, and
  // a preschool has few enough classes that this stays cheap.
  const perClass = useQueries({
    queries: classList.map((schoolClass) => ({
      queryKey: ['attendance', 'class', entityId(schoolClass), date],
      queryFn: () => attendanceApi.forClass(entityId(schoolClass), { date }),
      enabled: !!date,
    })),
  });

  const totals = perClass.reduce(
    (acc, query) => {
      (query.data ?? []).forEach((record) => {
        acc.marked += 1;
        if (record.status === 'present') acc.present += 1;
        else if (record.status === 'absent') acc.absent += 1;
        else if (record.status === 'late') acc.late += 1;
      });
      return acc;
    },
    { marked: 0, present: 0, absent: 0, late: 0 },
  );

  // Every teacher, marked or not — see the note in useTeacherAttendance.
  const staff = useTeacherAttendance(date, tab === 'staff');

  const activeIndex = classList.findIndex((schoolClass) => entityId(schoolClass) === activeId);
  const activeRecords = activeIndex >= 0 ? (perClass[activeIndex]?.data ?? []) : [];
  const activeLoading = activeIndex >= 0 ? perClass[activeIndex]?.isLoading : false;

  const columns: Array<Column<AttendanceRecord>> = [
    {
      key: 'student',
      header: 'Student',
      hideOnCard: true,
      render: (record) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={attendanceStudentName(record)}
            id={attendanceStudentId(record)}
            size={32}
          />
          <span className="truncate font-bold">{attendanceStudentName(record)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (record) => (
        <Badge tone={STATUS_TONE[record.status] ?? 'neutral'}>{humanize(record.status)}</Badge>
      ),
    },
    {
      key: 'in',
      header: 'Checked in',
      secondary: true,
      render: (record) => record.checkInTime ?? '—',
    },
    {
      key: 'remarks',
      header: 'Remarks',
      secondary: true,
      render: (record) => record.remarks ?? '—',
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        subtitle="Across the school"
        actions={
          <Input
            type="date"
            value={date}
            max={toIsoDate()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
            className="w-auto"
          />
        }
      />

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as AttendanceTab)}
        items={[
          { value: 'students', label: 'Students' },
          { value: 'staff', label: 'Staff' },
        ]}
      />

      {tab === 'staff' ? (
        <StaffTab staff={staff} date={date} onViewReport={setReportFor} />
      ) : (
        <>
          <TileGrid>
            <StatTile
              label="Marked"
              value={totals.marked}
              icon={<ClipboardList className="size-5" />}
              color="var(--color-brand)"
            />
            <StatTile label="Present" value={totals.present} color="var(--color-success)" />
            <StatTile label="Absent" value={totals.absent} color="var(--color-danger)" />
            <StatTile label="Late" value={totals.late} color="var(--color-sunny)" />
          </TileGrid>

          {classes.isLoading ? (
            <ListSkeleton rows={3} />
          ) : classes.error ? (
            <ErrorState message={errorMessage(classes.error)} onRetry={() => classes.refetch()} />
          ) : !classList.length ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No classes yet"
              message="Create a class before taking attendance."
            />
          ) : (
            <>
              {/* Per-class summary: which registers are done, which aren't. */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {classList.map((schoolClass, index) => {
                  const records = perClass[index]?.data ?? [];
                  const present = records.filter((r) => r.status === 'present').length;
                  const id = entityId(schoolClass);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedId(id)}
                      className={cn(
                        'rounded-[var(--radius-card)] bg-white p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5',
                        id === activeId && 'ring-2 ring-accent',
                      )}
                    >
                      <p className="font-display font-bold">{classLabel(schoolClass)}</p>
                      {perClass[index]?.isLoading ? (
                        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
                      ) : records.length ? (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {present}/{records.length} present
                        </p>
                      ) : (
                        <Badge tone="warning">Not marked</Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <ClassPicker
                  classes={classList}
                  selectedId={activeId}
                  onSelect={setSelectedId}
                  className="mb-4"
                />
                <DataList
                  rows={activeRecords}
                  columns={columns}
                  // Register rows carry no document id of their own — the child is
                  // what makes each one unique.
                  rowKey={attendanceStudentId}
                  loading={activeLoading}
                  empty={
                    <EmptyState
                      icon={<ClipboardList className="size-6" />}
                      title="Not marked yet"
                      message="This class's register hasn't been taken for the selected date."
                    />
                  }
                  cardTitle={attendanceStudentName}
                  cardLeading={(record) => (
                    <Avatar
                      name={attendanceStudentName(record)}
                      id={attendanceStudentId(record)}
                      size={40}
                    />
                  )}
                />
              </div>
            </>
          )}
        </>
      )}

      <StaffReportModal row={reportFor} onClose={() => setReportFor(null)} />
    </div>
  );
}

/** The statuses an admin may record for a teacher, in the order shown. */
const STAFF_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'on_leave', 'half_day'];

/**
 * Today's teacher register.
 *
 * Every teacher is listed whether or not they have been marked, because the
 * point of the screen is to mark the ones who haven't. An unmarked teacher
 * defaults to present — the common case — so the admin only touches the
 * exceptions before saving, which is how the mobile app behaves.
 */
function StaffTab({
  staff,
  date,
  onViewReport,
}: {
  staff: ReturnType<typeof useTeacherAttendance>;
  date: string;
  onViewReport: (row: TeacherAttendanceRow) => void;
}) {
  // Only what the admin has changed this session. Everything else falls back
  // to the stored status, then to present.
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const toast = useToast();
  const queryClient = useQueryClient();

  const statusFor = (row: TeacherAttendanceRow): AttendanceStatus =>
    draft[row.staffId] ?? row.status ?? 'present';

  const save = useMutation({
    mutationFn: () =>
      attendanceApi.staffMark({
        date,
        entries: staff.rows.map((row) => ({
          staffId: row.staffId,
          status: statusFor(row),
        })),
      }),
    onSuccess: () => {
      toast.success('Teacher attendance saved.');
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save that attendance.')),
  });

  return (
    <div className="space-y-5">
      <TileGrid>
        <StatTile
          label="Marked"
          value={`${staff.marked}/${staff.total}`}
          icon={<ClipboardList className="size-5" />}
          color="var(--color-brand)"
        />
        <StatTile label="Present" value={staff.present} color="var(--color-success)" />
        <StatTile label="Absent" value={staff.absent} color="var(--color-danger)" />
        <StatTile label="On leave" value={staff.onLeave} color="var(--color-blue)" />
      </TileGrid>

      {staff.isLoading ? (
        <ListSkeleton rows={4} />
      ) : staff.error ? (
        <ErrorState message={errorMessage(staff.error)} onRetry={staff.refetch} />
      ) : !staff.rows.length ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No teacher accounts yet"
          message="Add teachers from Users, then their attendance can be taken here."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--color-text-muted)]">
              Unmarked teachers are saved as present. Tap a name for their monthly report.
            </p>
            <Button
              icon={<Save className="size-4" />}
              onClick={() => save.mutate()}
              loading={save.isPending}
            >
              Save {formatDate(date)}
            </Button>
          </div>

          <div className="space-y-2">
            {staff.rows.map((row) => {
              const active = statusFor(row);
              return (
                <Card key={row.staffId} className="flex flex-wrap items-center gap-3">
                  <Avatar name={row.name} id={row.staffId} size={40} />
                  <button
                    type="button"
                    onClick={() => onViewReport(row)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate font-bold hover:underline">{row.name}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">
                      {row.status ? (
                        <>
                          {humanize(row.status)}
                          {row.checkInAt ? ` · in ${formatTime(row.checkInAt)}` : ''}
                          {row.checkOutAt ? ` · out ${formatTime(row.checkOutAt)}` : ''}
                        </>
                      ) : (
                        'Not marked yet'
                      )}
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {STAFF_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, [row.staffId]: status }))}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition',
                          active === status
                            ? 'bg-accent text-white'
                            : 'bg-[var(--color-canvas)] text-[var(--color-text-muted)] hover:bg-black/5',
                        )}
                      >
                        {humanize(status)}
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StaffReportModal({
  row,
  onClose,
}: {
  row: TeacherAttendanceRow | null;
  onClose: () => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const staffId = row?.staffId ?? '';

  const report = useQuery({
    queryKey: ['attendance', 'staff', staffId, 'report', month.getFullYear(), month.getMonth()],
    queryFn: () =>
      attendanceApi.staffReport(staffId, {
        from: toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1)),
        to: toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
      }),
    enabled: !!row,
  });

  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={row?.name || 'Staff report'}
      description={row ? `${row.email} · monthly report` : undefined}
      size="md"
    >
      {report.isLoading ? (
        <ListSkeleton rows={4} />
      ) : report.error ? (
        <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />
      ) : report.data ? (
        <div className="space-y-4">
          <TileGrid className="grid-cols-2">
            <StatTile label="Present" value={report.data.present} color="var(--color-success)" />
            <StatTile label="Absent" value={report.data.absent} color="var(--color-danger)" />
            <StatTile label="Late" value={report.data.late} color="var(--color-sunny)" />
            <StatTile
              label="On leave"
              value={report.data.onLeave}
              color="var(--color-blue)"
            />
          </TileGrid>

          <Card className="flex items-center justify-between py-3">
            <p className="text-xs font-semibold text-[var(--color-text-muted)]">Marked days</p>
            <p className="text-sm font-bold">
              {report.data.marked} of {report.data.workingDays}
            </p>
          </Card>

          <div className="rounded-[var(--radius-input)] bg-[var(--color-canvas)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                }
              >
                Previous
              </Button>
              <p className="font-display text-sm font-bold">
                {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={isCurrentMonth}
                onClick={() =>
                  setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                }
              >
                Next
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.data.days.map((day) => (
                <span
                  key={day.date}
                  title={`${formatDate(day.date)} — ${humanize(day.status)}`}
                  className="grid size-8 place-items-center rounded-lg text-xs font-bold text-white"
                  style={{
                    backgroundColor:
                      day.status === 'present'
                        ? 'var(--color-success)'
                        : day.status === 'absent'
                          ? 'var(--color-danger)'
                          : day.status === 'late'
                            ? 'var(--color-sunny)'
                            : day.status === 'on_leave'
                              ? 'var(--color-blue)'
                              : 'var(--color-text-muted)',
                  }}
                >
                  {new Date(day.date).getDate()}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/** The check-in/out time as "9:15 am", from an ISO or plain timestamp. */
function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
}
