'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { classesApi, studentsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  className as classLabel,
  entityId,
  primaryGuardian,

  studentName,
  type Paginated,
  type Student,
} from '@/lib/api/types';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
} from '@/components/ui/primitives';
import { DataList, type Column } from '@/components/ui/data-list';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input, SearchInput, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatDate, humanize, toIsoDate } from '@/lib/utils';

/** Every child in the school: search, filter, enrol, open, remove. */
export default function AdminStudentsPage() {
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [enrolling, setEnrolling] = useState(false);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  const students = useQuery({
    queryKey: ['students', { search, classId, status, page }],
    queryFn: () =>
      studentsApi.list({
        page,
        limit: 25,
        search: search.trim() || undefined,
        classId: classId || undefined,
        status: status || undefined,
      }),
  });

  // The endpoint pages for admins but can hand back a bare array; accept both.
  const payload = students.data;
  const rows = Array.isArray(payload) ? payload : ((payload as Paginated<Student>)?.data ?? []);
  const totalPages = Array.isArray(payload) ? 1 : ((payload as Paginated<Student>)?.totalPages ?? 1);
  const total = Array.isArray(payload) ? payload.length : ((payload as Paginated<Student>)?.total ?? 0);

  const remove = useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => {
      toast.success('Student removed.');
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that student.')),
  });

  const columns: Array<Column<Student>> = [
    {
      key: 'name',
      header: 'Student',
      hideOnCard: true,
      render: (student) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={studentName(student)}
            id={entityId(student)}
            src={student.photoUrl}
            size={36}
          />
          <div className="min-w-0">
            <p className="truncate font-bold">{studentName(student)}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{student.admissionNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      // The list returns a bare class id, so resolve it against the classes
      // the filter above already loaded.
      render: (student) => classLabel(student.classId, classes.data),
    },
    {
      key: 'guardian',
      header: 'Guardian',
      secondary: true,
      render: (student) => primaryGuardian(student)?.name ?? '—',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (student) => {
        const phone = primaryGuardian(student)?.phone;
        return phone ? (
          <a href={`tel:${phone}`} className="font-bold text-accent">
            {phone}
          </a>
        ) : (
          '—'
        );
      },
    },
    {
      key: 'dob',
      header: 'Date of birth',
      secondary: true,
      render: (student) => formatDate(student.dateOfBirth),
    },
    {
      key: 'status',
      header: 'Status',
      render: (student) => (
        <Badge tone={student.status === 'active' ? 'success' : 'neutral'}>
          {humanize(student.status)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Students"
        subtitle={students.isLoading ? undefined : `${total} enrolled`}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEnrolling(true)}>
            Enrol student
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SearchInput
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            setPage(1); // A new search starts at the first page.
          }}
          placeholder="Search by name or admission number"
        />
        <Select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by class"
          options={[
            { value: '', label: 'All classes' },
            ...(classes.data ?? []).map((schoolClass) => ({
              value: entityId(schoolClass),
              label: classLabel(schoolClass),
            })),
          ]}
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          options={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'graduated', label: 'Graduated' },
            { value: 'withdrawn', label: 'Withdrawn' },
          ]}
        />
      </div>

      <DataList
        rows={rows}
        columns={columns}
        rowKey={entityId}
        loading={students.isLoading}
        error={
          students.error ? (
            <ErrorState
              message={errorMessage(students.error)}
              onRetry={() => students.refetch()}
            />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<Users className="size-6" />}
            title={search || classId || status ? 'No matches' : 'No students yet'}
            message={
              search || classId || status
                ? 'Try a different search or filter.'
                : 'Enrol your first student to get started.'
            }
            action={
              <Button variant="secondary" onClick={() => setEnrolling(true)}>
                Enrol student
              </Button>
            }
          />
        }
        onRowClick={(student) => router.push(`/admin/students/${entityId(student)}`)}
        cardTitle={(student) => studentName(student)}
        cardSubtitle={(student) => student.admissionNumber}
        cardLeading={(student) => (
          <Avatar
            name={studentName(student)}
            id={entityId(student)}
            src={student.photoUrl}
            size={40}
          />
        )}
        cardAction={(student) => (
          <IconButton
            label={`Remove ${studentName(student)}`}
            onClick={(e) => {
              e.stopPropagation(); // Don't open the row we're deleting.
              setDeleting(student);
            }}
          >
            <Trash2 className="size-4" />
          </IconButton>
        )}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <span className="text-sm font-bold text-[var(--color-text-muted)]">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <EnrolStudent open={enrolling} onClose={() => setEnrolling(false)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Remove this student?"
        message={`${deleting ? studentName(deleting) : 'This student'} will be removed from the school. This can't be undone.`}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

/**
 * Enrolment: the identity fields only.
 *
 * Guardians, address and medical details are the parent's to fill in once the
 * child has an account, which is why they aren't asked for here.
 */
const EMPTY_ENROLMENT = {
  firstName: '',
  lastName: '',
  admissionNumber: '',
  gender: 'male',
  dateOfBirth: '',
  classId: '',
  parentName: '',
  parentEmail: '',
  parentPhone: '',
};

function EnrolStudent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_ENROLMENT);
  const toast = useToast();
  const queryClient = useQueryClient();
  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list, enabled: open });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      studentsApi.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        // The backend generates an admission number when one isn't supplied.
        ...(form.admissionNumber.trim()
          ? { admissionNumber: form.admissionNumber.trim() }
          : {}),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        classId: form.classId || undefined,
        // The parent's login is provisioned from these: a phone is what
        // triggers it, and the email is the identity they sign in with. Sent
        // together or not at all.
        ...(form.parentPhone.trim() && form.parentEmail.trim()
          ? {
              parentName: form.parentName.trim() || undefined,
              parentEmail: form.parentEmail.trim(),
              parentPhone: form.parentPhone.trim(),
            }
          : {}),
      } as Partial<Student>),
    onSuccess: () => {
      toast.success('Student enrolled.');
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      setForm(EMPTY_ENROLMENT);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not enrol that student.')),
  });

  // The API needs both halves of the parent's contact to create their login,
  // so half-filled is worse than empty — block it rather than silently drop it.
  const parentHalfFilled =
    !!form.parentEmail.trim() !== !!form.parentPhone.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enrol a student"
      description="The parent completes the rest of the profile once they sign in."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={
              !form.firstName.trim() ||
              !form.lastName.trim() ||
              !form.dateOfBirth ||
              parentHalfFilled
            }
          >
            Enrol
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="First name"
          value={form.firstName}
          onChange={(e) => set('firstName', e.target.value)}
          required
        />
        <Input
          label="Last name"
          value={form.lastName}
          onChange={(e) => set('lastName', e.target.value)}
          required
        />
        <Input
          label="Admission number"
          value={form.admissionNumber}
          onChange={(e) => set('admissionNumber', e.target.value)}
          hint="Leave blank to generate one"
        />
        <Input
          label="Date of birth"
          type="date"
          max={toIsoDate()}
          value={form.dateOfBirth}
          onChange={(e) => set('dateOfBirth', e.target.value)}
          required
        />
        <Select
          label="Gender"
          value={form.gender}
          onChange={(e) => set('gender', e.target.value)}
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Select
          label="Class"
          value={form.classId}
          onChange={(e) => set('classId', e.target.value)}
          placeholder="Unassigned"
          options={(classes.data ?? []).map((schoolClass) => ({
            value: entityId(schoolClass),
            label: classLabel(schoolClass),
          }))}
        />
        <p className="text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase sm:col-span-2">
          Parent login
        </p>
        <Input
          label="Parent name"
          value={form.parentName}
          onChange={(e) => set('parentName', e.target.value)}
          className="sm:col-span-2"
        />
        <Input
          label="Parent email"
          type="email"
          value={form.parentEmail}
          onChange={(e) => set('parentEmail', e.target.value)}
          hint="They sign in with this"
          error={
            form.parentPhone.trim() && !form.parentEmail.trim()
              ? 'Needed to create the login'
              : null
          }
        />
        <Input
          label="Parent phone"
          type="tel"
          value={form.parentPhone}
          onChange={(e) => set('parentPhone', e.target.value)}
          hint="Both are needed, or leave both blank"
          error={
            form.parentEmail.trim() && !form.parentPhone.trim()
              ? 'Needed to create the login'
              : null
          }
        />
      </div>
    </Modal>
  );
}

