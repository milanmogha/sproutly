'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardList, Save, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { attendanceApi, classesApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  attendanceStudentId,
  studentName,
  type AttendanceStatus,
  type Student,
} from '@/lib/api/types';
import { useClasses } from '@/lib/hooks/use-classes';
import { ClassPicker } from '@/components/shared/class-picker';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { cn, toIsoDate } from '@/lib/utils';

/** The statuses a teacher can set, in the order they're offered. */
const STATUSES: Array<{ value: AttendanceStatus; label: string; short: string; color: string }> = [
  { value: 'present', label: 'Present', short: 'P', color: 'var(--color-success)' },
  { value: 'absent', label: 'Absent', short: 'A', color: 'var(--color-danger)' },
  { value: 'late', label: 'Late', short: 'L', color: 'var(--color-sunny)' },
  { value: 'half_day', label: 'Half day', short: 'H', color: 'var(--color-purple)' },
  { value: 'on_leave', label: 'On leave', short: 'LV', color: 'var(--color-blue)' },
];

/**
 * Roll call. Loads the class list for a date, pre-fills whatever was already
 * marked, and submits the whole class in one call.
 */
export default function TeacherAttendancePage() {
  const { classes, selectedId, select, isLoading: loadingClasses } = useClasses();
  const [date, setDate] = useState(toIsoDate());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const toast = useToast();
  const queryClient = useQueryClient();

  const students = useQuery({
    queryKey: ['classes', selectedId, 'students'],
    queryFn: () => classesApi.students(selectedId),
    enabled: !!selectedId,
  });

  const existing = useQuery({
    queryKey: ['attendance', 'class', selectedId, date],
    queryFn: () => attendanceApi.forClass(selectedId, { date }),
    enabled: !!selectedId,
  });

  // Start from what's already on the server for this date, so re-marking a day
  // shows the current state rather than a blank sheet.
  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    existing.data?.forEach((record) => {
      const id = attendanceStudentId(record);
      if (id) next[id] = record.status;
    });
    setMarks(next);
  }, [existing.data, selectedId, date]);

  const save = useMutation({
    mutationFn: () =>
      attendanceApi.mark({
        classId: selectedId,
        date,
        entries: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })),
      }),
    onSuccess: () => {
      toast.success('Attendance saved.');
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save attendance.')),
  });

  const roster = students.data ?? [];
  const markedCount = Object.keys(marks).length;
  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    Object.values(marks).forEach((status) => {
      tally[status] = (tally[status] ?? 0) + 1;
    });
    return tally;
  }, [marks]);

  /** Marks everyone present — the usual case, then correct the exceptions. */
  function markAllPresent() {
    const next: Record<string, AttendanceStatus> = {};
    roster.forEach((student) => {
      next[entityId(student)] = 'present';
    });
    setMarks(next);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        subtitle="Take the register"
        actions={
          <>
            <Input
              type="date"
              value={date}
              max={toIsoDate()}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className="w-auto"
            />
            <Button
              icon={<Save className="size-4" />}
              onClick={() => save.mutate()}
              loading={save.isPending}
              disabled={!markedCount}
            >
              Save
            </Button>
          </>
        }
      />

      {loadingClasses ? (
        <ListSkeleton rows={2} />
      ) : !classes.length ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No classes assigned"
          message="Once the office assigns you a class, you can take its register here."
        />
      ) : (
        <>
          <ClassPicker classes={classes} selectedId={selectedId} onSelect={select} />

          <Card className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold">
              {markedCount} of {roster.length} marked
            </p>
            <span className="flex flex-wrap gap-2">
              {STATUSES.filter((status) => counts[status.value]).map((status) => (
                <span
                  key={status.value}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: status.color }}
                >
                  {status.label} {counts[status.value]}
                </span>
              ))}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<Check className="size-4" />}
              onClick={markAllPresent}
              className="ml-auto"
              disabled={!roster.length}
            >
              All present
            </Button>
          </Card>

          {students.isLoading ? (
            <ListSkeleton />
          ) : students.error ? (
            <ErrorState
              message={errorMessage(students.error)}
              onRetry={() => students.refetch()}
            />
          ) : !roster.length ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="No students in this class"
            />
          ) : (
            <div className="space-y-2">
              {roster.map((student) => (
                <StudentRow
                  key={entityId(student)}
                  student={student}
                  value={marks[entityId(student)]}
                  onChange={(status) =>
                    setMarks((current) => ({ ...current, [entityId(student)]: status }))
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StudentRow({
  student,
  value,
  onChange,
}: {
  student: Student;
  value?: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
          name={studentName(student)}
          id={entityId(student)}
          src={student.photoUrl}
          size={40}
        />
        <div className="min-w-0">
          <p className="truncate font-bold">{studentName(student)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{student.admissionNumber}</p>
        </div>
      </div>

      {/* Full labels where there's room; single letters on narrow phones. */}
      <div className="flex gap-1.5" role="group" aria-label={`Attendance for ${studentName(student)}`}>
        {STATUSES.map((status) => {
          const active = value === status.value;
          return (
            <button
              key={status.value}
              type="button"
              onClick={() => onChange(status.value)}
              aria-pressed={active}
              title={status.label}
              className={cn(
                'flex-1 rounded-[var(--radius-button)] px-2 py-2 text-xs font-bold transition sm:flex-none sm:px-3',
                active
                  ? 'text-white'
                  : 'bg-[var(--color-canvas)] text-[var(--color-text-muted)] hover:bg-[var(--color-hairline)]',
              )}
              style={active ? { backgroundColor: status.color } : undefined}
            >
              <span className="hidden sm:inline">{status.label}</span>
              <span className="sm:hidden">{status.short}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
