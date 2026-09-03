'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { classesApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  className as classLabel,
  entityId,
  primaryGuardian,
  studentName,
  type Student,
} from '@/lib/api/types';
import { useClasses } from '@/lib/hooks/use-classes';
import { ClassPicker } from '@/components/shared/class-picker';
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { DataList, type Column } from '@/components/ui/data-list';
import { SearchInput } from '@/components/ui/form';
import { humanize } from '@/lib/utils';

/** The roster for the teacher's class, searchable, with a link into each child. */
export default function TeacherStudentsPage() {
  const { classes, selectedId, select, isLoading: loadingClasses } = useClasses();
  const [search, setSearch] = useState('');
  const router = useRouter();

  const students = useQuery({
    queryKey: ['classes', selectedId, 'students'],
    queryFn: () => classesApi.students(selectedId),
    enabled: !!selectedId,
  });

  const term = search.trim().toLowerCase();
  const rows = (students.data ?? []).filter((student) =>
    !term
      ? true
      : studentName(student).toLowerCase().includes(term) ||
        student.admissionNumber?.toLowerCase().includes(term),
  );

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
      render: (student) => classLabel(student.classId, classes),
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
        subtitle={students.isLoading ? undefined : `${rows.length} in this class`}
      />

      {loadingClasses ? (
        <ListSkeleton rows={2} />
      ) : !classes.length ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No classes assigned"
          message="Once the office assigns you a class, its students appear here."
        />
      ) : (
        <>
          <ClassPicker classes={classes} selectedId={selectedId} onSelect={select} />
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search by name or admission number"
            className="sm:max-w-sm"
          />

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
                title={term ? 'No matches' : 'No students in this class'}
              />
            }
            onRowClick={(student) => router.push(`/teacher/students/${entityId(student)}`)}
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
          />
        </>
      )}
    </div>
  );
}
