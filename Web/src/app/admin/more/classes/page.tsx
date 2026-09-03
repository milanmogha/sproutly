'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LayoutGrid, Plus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { classesApi, studentsApi, usersApi, MAX_PAGE_LIMIT } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  className as classLabel,
  entityId,
  listOf,
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
} from '@/components/ui/primitives';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/form';
import { academicYear, academicYearOptions, count } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

/** Classes, their teachers, and who sits in them. */
export default function AdminClassesPage() {
  const [creating, setCreating] = useState(false);
  const [allocating, setAllocating] = useState<SchoolClass | null>(null);
  const [deleting, setDeleting] = useState<SchoolClass | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  const remove = useMutation({
    mutationFn: (id: string) => classesApi.remove(id),
    onSuccess: () => {
      toast.success('Class deleted.');
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete that class.')),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Classes"
        subtitle={classes.isLoading ? undefined : `${count(classes.data?.length ?? 0, 'class', 'classes')} in the school`}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New class
          </Button>
        }
      />

      {classes.isLoading ? (
        <ListSkeleton />
      ) : classes.error ? (
        <ErrorState message={errorMessage(classes.error)} onRetry={() => classes.refetch()} />
      ) : !classes.data?.length ? (
        <EmptyState
          icon={<LayoutGrid className="size-6" />}
          title="No classes yet"
          message="Create a class, then allocate students to it."
          action={
            <Button variant="secondary" onClick={() => setCreating(true)}>
              New class
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classes.data.map((schoolClass) => (
            <Card key={entityId(schoolClass)} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">{classLabel(schoolClass)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {schoolClass.academicYear ?? '—'}
                  </p>
                </div>
                <IconButton label="Delete class" onClick={() => setDeleting(schoolClass)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="accent">{count(schoolClass.enrolled ?? 0, 'student')}</Badge>
                {schoolClass.capacity ? (
                  <Badge tone="neutral">Capacity {schoolClass.capacity}</Badge>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                <Button
                  size="sm"
                  icon={<UserPlus className="size-4" />}
                  onClick={() => setAllocating(schoolClass)}
                >
                  Allocate
                </Button>
                <Link
                  href={`/admin/more/classes/${entityId(schoolClass)}`}
                  className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline"
                >
                  Roster &amp; teacher
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateClass open={creating} onClose={() => setCreating(false)} />
      <AllocateStudents schoolClass={allocating} onClose={() => setAllocating(null)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Delete this class?"
        message={`${deleting ? classLabel(deleting) : 'This class'} will be removed. Students in it become unassigned.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

const emptyClass = () => ({
  name: '',
  section: '',
  academicYear: academicYear(),
  capacity: '',
  room: '',
  classTeacher: '',
});

function CreateClass({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(emptyClass);
  const toast = useToast();
  const queryClient = useQueryClient();
  // The class teacher is a login account, not a staff record — the API wants a
  // user id here.
  const teacherQuery = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: () => usersApi.list({ role: 'teacher' }),
    enabled: open,
  });
  const teachers = listOf(teacherQuery.data);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      classesApi.create({
        name: form.name.trim(),
        section: form.section.trim() || undefined,
        academicYear: form.academicYear.trim(),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        room: form.room.trim() || undefined,
        classTeacher: form.classTeacher || undefined,
      }),
    onSuccess: () => {
      toast.success('Class created.');
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      setForm(emptyClass());
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not create that class.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New class"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!form.name.trim()}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Nursery"
          required
        />
        <Input
          label="Section"
          value={form.section}
          onChange={(e) => set('section', e.target.value)}
          placeholder="A"
        />
        <Select
          label="Academic year"
          value={form.academicYear}
          onChange={(e) => set('academicYear', e.target.value)}
          options={academicYearOptions().map((year) => ({ value: year, label: year }))}
        />
        <Input
          label="Capacity"
          type="number"
          min={1}
          value={form.capacity}
          onChange={(e) => set('capacity', e.target.value)}
        />
        <Input
          label="Room"
          value={form.room}
          onChange={(e) => set('room', e.target.value)}
        />
        <Select
          label="Class teacher"
          value={form.classTeacher}
          onChange={(e) => set('classTeacher', e.target.value)}
          placeholder="Unassigned"
          options={teachers.map((teacher) => ({
            value: entityId(teacher),
            label: teacher.name ?? teacher.email,
          }))}
        />
      </div>
    </Modal>
  );
}

/** Moves unassigned (or reassignable) students into a class, several at a time. */
function AllocateStudents({
  schoolClass,
  onClose,
}: {
  schoolClass: SchoolClass | null;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  // A child sits in exactly one class, so only the unallocated are on offer —
  // otherwise the list keeps showing children who are already placed, and
  // picking one would quietly move them out of their current class.
  //
  // Both the filter and the search run on the server: the API caps a page at
  // MAX_PAGE_LIMIT, so narrowing a fetched page would hide everyone past it.
  const term = search.trim();
  const students = useQuery({
    queryKey: ['students', 'unassigned', term],
    queryFn: () =>
      studentsApi.list({
        limit: MAX_PAGE_LIMIT,
        status: 'active',
        unassigned: true,
        search: term || undefined,
      }),
    enabled: !!schoolClass,
  });

  const rows = listOf(students.data);

  const allocate = useMutation({
    mutationFn: () => classesApi.allocate(entityId(schoolClass!), picked),
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
      open={!!schoolClass}
      onClose={onClose}
      title={`Allocate to ${schoolClass ? classLabel(schoolClass) : ''}`}
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
            Allocate {picked.length || ''}
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
        {students.isLoading ? (
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
