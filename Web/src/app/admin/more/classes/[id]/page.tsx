'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, GraduationCap, UserMinus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { classesApi, studentsApi, usersApi, MAX_PAGE_LIMIT } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  className as classLabel,
  entityId,
  listOf,
  refId,
  studentName,
  type SchoolClass,
} from '@/lib/api/types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  ListSkeleton,
  PageHeader,
  SectionTitle,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { count } from '@/lib/utils';

/**
 * One class: its teacher and its roll.
 *
 * The roster and the class record are separate reads — `/classes` carries the
 * headcount but not the children — so both are invalidated whenever an
 * allocation changes.
 */
export default function AdminClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [pickingTeacher, setPickingTeacher] = useState(false);
  const [addingStudents, setAddingStudents] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const classQuery = useQuery({
    queryKey: ['classes', id],
    queryFn: () => classesApi.get(id),
    enabled: !!id,
  });
  const schoolClass = classQuery.data;

  const roster = useQuery({
    queryKey: ['classes', id, 'students'],
    queryFn: () => classesApi.students(id),
    enabled: !!id,
  });
  const students = roster.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['classes'] });
    // The allocation picker only offers unallocated children, so it goes
    // stale the moment anyone joins or leaves a class.
    void queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const removeStudent = useMutation({
    mutationFn: (studentId: string) => classesApi.removeStudent(id, studentId),
    onSuccess: () => {
      toast.success('Removed from class.');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that student.')),
  });

  const teacherId = refId(schoolClass?.classTeacher);
  const capacity = schoolClass?.capacity ?? 0;
  const full = capacity > 0 && students.length >= capacity;

  const summary = schoolClass
    ? [
        schoolClass.academicYear,
        schoolClass.room ? `Room ${schoolClass.room}` : null,
        capacity ? `${students.length}/${capacity} students` : count(students.length, 'student'),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/more/classes"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="size-4" />
        All classes
      </Link>

      <PageHeader
        title={schoolClass ? classLabel(schoolClass) : 'Class'}
        subtitle={summary}
      />

      {classQuery.isLoading ? (
        <ListSkeleton />
      ) : classQuery.error ? (
        <ErrorState message={errorMessage(classQuery.error)} onRetry={() => classQuery.refetch()} />
      ) : !schoolClass ? (
        <EmptyState icon={<GraduationCap className="size-6" />} title="That class no longer exists" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <SectionTitle title="Class teacher" />
            <div className="flex items-center gap-3">
              <Avatar name={teacherName(schoolClass)} id={teacherId || 'none'} size={44} />
              <p
                className={
                  teacherId
                    ? 'min-w-0 flex-1 truncate text-sm font-bold'
                    : 'min-w-0 flex-1 truncate text-sm font-bold text-[var(--color-text-muted)]'
                }
              >
                {teacherId ? teacherName(schoolClass) : 'No teacher assigned'}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setPickingTeacher(true)}>
                {teacherId ? 'Change' : 'Assign'}
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <SectionTitle
              title={`Students (${students.length})`}
              action={
                <Button
                  size="sm"
                  icon={<UserPlus className="size-4" />}
                  onClick={() => setAddingStudents(true)}
                  disabled={full}
                >
                  Add
                </Button>
              }
            />
            {full && (
              <Badge tone="warning" className="mb-3">
                Class is at full capacity.
              </Badge>
            )}
            {roster.isLoading ? (
              <ListSkeleton rows={3} />
            ) : roster.error ? (
              <ErrorState message={errorMessage(roster.error)} onRetry={() => roster.refetch()} />
            ) : !students.length ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                No students in this class yet.
              </p>
            ) : (
              <ul>
                {students.map((student) => (
                  <li
                    key={entityId(student)}
                    className="flex items-center gap-3 border-b border-[var(--color-hairline)] py-2 last:border-0"
                  >
                    <Avatar name={studentName(student)} id={entityId(student)} size={34} />
                    <Link
                      href={`/admin/students/${entityId(student)}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <span className="block truncate text-sm font-bold">
                        {studentName(student)}
                      </span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {student.admissionNumber ?? 'No admission number'}
                      </span>
                    </Link>
                    <IconButton
                      label={`Remove ${studentName(student)} from this class`}
                      onClick={() => removeStudent.mutate(entityId(student))}
                    >
                      <UserMinus className="size-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <TeacherPicker
        open={pickingTeacher}
        classId={id}
        currentTeacherId={teacherId}
        onClose={() => setPickingTeacher(false)}
      />
      <AddStudents
        open={addingStudents}
        classId={id}
        onClose={() => setAddingStudents(false)}
      />
    </div>
  );
}

/** The class teacher's name, whether the API populated them or not. */
function teacherName(schoolClass: SchoolClass): string {
  const teacher = schoolClass.classTeacher;
  if (!teacher || typeof teacher === 'string') return 'Teacher';
  return teacher.name?.trim() || teacher.email || 'Teacher';
}

function TeacherPicker({
  open,
  classId,
  currentTeacherId,
  onClose,
}: {
  open: boolean;
  classId: string;
  currentTeacherId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const teachersQuery = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: () => usersApi.list({ role: 'teacher' }),
    enabled: open,
  });
  const teachers = listOf(teachersQuery.data);

  const assign = useMutation({
    mutationFn: (teacherId: string | null) => classesApi.assignTeacher(classId, teacherId),
    onSuccess: (_data, teacherId) => {
      toast.success(teacherId ? 'Class teacher assigned.' : 'Class teacher removed.');
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not change the class teacher.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign class teacher"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="space-y-3">
        {!!currentTeacherId && (
          <Button
            variant="secondary"
            block
            icon={<X className="size-4" />}
            onClick={() => assign.mutate(null)}
            loading={assign.isPending && assign.variables === null}
            className="text-[var(--color-danger)]"
          >
            Remove current teacher
          </Button>
        )}
        {teachersQuery.isLoading ? (
          <ListSkeleton rows={4} />
        ) : !teachers.length ? (
          <EmptyState
            title="No teacher accounts yet"
            message="Add teachers from Staff management first."
          />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {teachers.map((teacher) => {
              const teacherId = entityId(teacher);
              const current = teacherId === currentTeacherId;
              return (
                <li key={teacherId}>
                  <button
                    type="button"
                    onClick={() => !current && assign.mutate(teacherId)}
                    disabled={current || assign.isPending}
                    className="flex w-full items-center gap-3 rounded-[var(--radius-input)] px-2 py-2 text-left hover:bg-[var(--color-canvas)] disabled:cursor-default"
                  >
                    <Avatar name={teacher.name ?? teacher.email} id={teacherId} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {teacher.name?.trim() || teacher.email}
                      </span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {teacher.email}
                      </span>
                    </span>
                    {current && <Check className="size-4 shrink-0 text-[var(--color-success)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** Adds children who are in no class yet — a student sits in only one. */
function AddStudents({
  open,
  classId,
  onClose,
}: {
  open: boolean;
  classId: string;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const term = search.trim();
  const studentsQuery = useQuery({
    queryKey: ['students', 'unassigned', term],
    queryFn: () =>
      studentsApi.list({
        limit: MAX_PAGE_LIMIT,
        status: 'active',
        unassigned: true,
        search: term || undefined,
      }),
    enabled: open,
  });
  const rows = listOf(studentsQuery.data);

  const allocate = useMutation({
    mutationFn: () => classesApi.allocate(classId, picked),
    onSuccess: () => {
      toast.success(`${count(picked.length, 'student')} allocated.`);
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      setPicked([]);
      setSearch('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not allocate those students.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add students"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => allocate.mutate()}
            loading={allocate.isPending}
            disabled={!picked.length}
          >
            Add {picked.length || ''}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Only students not yet in a class are shown.
        </p>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students"
          aria-label="Search students"
        />
        {studentsQuery.isLoading ? (
          <ListSkeleton rows={4} />
        ) : !rows.length ? (
          <EmptyState
            title={term ? 'No students found' : 'Every student is already in a class'}
            message={
              term
                ? 'Nobody unallocated matches that search.'
                : 'Remove a child from their class first to move them here.'
            }
          />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {rows.map((student) => {
              const id = entityId(student);
              const checked = picked.includes(id);
              return (
                <li key={id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-input)] px-2 py-2 hover:bg-[var(--color-canvas)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setPicked((current) =>
                          checked ? current.filter((x) => x !== id) : [...current, id],
                        )
                      }
                      className="size-4 accent-[var(--accent)]"
                    />
                    <Avatar name={studentName(student)} id={id} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {studentName(student)}
                      </span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {student.admissionNumber ?? 'No admission number'}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
