'use client';

import { useQuery } from '@tanstack/react-query';
import { attendanceApi, usersApi } from '@/lib/api/endpoints';
import { entityId, listOf, type AttendanceStatus } from '@/lib/api/types';

/** One teacher and where they stand on the chosen day. */
export interface TeacherAttendanceRow {
  staffId: string;
  name: string;
  email: string;
  /** null when nobody has marked them yet. */
  status: AttendanceStatus | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}

/**
 * The teacher roster for one day, with each teacher's status alongside.
 *
 * `GET /attendance/staff` returns attendance *records*, not people — a teacher
 * nobody has marked is simply absent from the response. Reading it alone makes
 * "unmarked" permanently zero and leaves an admin no way to see who still
 * needs marking, so the roster is taken from `/users` and the records are laid
 * over it. This is what the mobile app does, and the two must agree.
 *
 * Only teachers are marked, which is the same rule the app applies.
 */
export function useTeacherAttendance(date: string, enabled = true) {
  const roster = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: () => usersApi.list({ role: 'teacher' }),
    enabled,
  });

  const records = useQuery({
    queryKey: ['attendance', 'staff', date],
    queryFn: () => attendanceApi.staffList({ date }),
    enabled: enabled && !!date,
  });

  const byStaffId = new Map((records.data ?? []).map((row) => [row.staffId, row]));

  const rows: TeacherAttendanceRow[] = listOf(roster.data).map((teacher) => {
    const id = entityId(teacher);
    const record = byStaffId.get(id);
    return {
      staffId: id,
      name: teacher.name?.trim() || teacher.email,
      email: teacher.email,
      status: record?.status ?? null,
      checkInAt: record?.checkInAt ?? null,
      checkOutAt: record?.checkOutAt ?? null,
    };
  });

  const count = (status: AttendanceStatus) =>
    rows.filter((row) => row.status === status).length;

  return {
    rows,
    total: rows.length,
    marked: rows.filter((row) => !!row.status).length,
    present: count('present'),
    absent: count('absent'),
    late: count('late'),
    onLeave: count('on_leave'),
    isLoading: roster.isLoading || records.isLoading,
    error: roster.error ?? records.error,
    refetch: () => {
      void roster.refetch();
      void records.refetch();
    },
  };
}
