'use client';

import { useQuery } from '@tanstack/react-query';
import { Baby, Croissant, HeartPulse, Moon, Palette, Smile } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { classesApi, daycareApi, type DaycareKind } from '@/lib/api/endpoints';
import { entityId, studentName } from '@/lib/api/types';
import { useClasses } from '@/lib/hooks/use-classes';
import { ClassPicker } from '@/components/shared/class-picker';
import { DiaryLogModal } from '@/components/shared/diary-log-modal';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';

/**
 * Daily logs — what parents read as their child's diary.
 *
 * Each kind has its own small form, but they all share the same shape: pick a
 * child, fill a few fields, post. The tab picks which fields to show; the form
 * itself is the shared {@link DiaryLogModal}, so logging from the class screen
 * and from a student's Diary tab can never drift apart.
 */
const KINDS: Array<{ value: DaycareKind; label: string; icon: ReactNode; color: string }> = [
  { value: 'meals', label: 'Meals', icon: <Croissant className="size-5" />, color: 'var(--color-sunny)' },
  { value: 'naps', label: 'Naps', icon: <Moon className="size-5" />, color: 'var(--color-grape)' },
  {
    value: 'activities',
    label: 'Activities',
    icon: <Palette className="size-5" />,
    color: 'var(--color-teal)',
  },
  { value: 'health', label: 'Health', icon: <HeartPulse className="size-5" />, color: 'var(--color-danger)' },
  {
    value: 'observations',
    label: 'Observations',
    icon: <Smile className="size-5" />,
    color: 'var(--color-blue)',
  },
];

export default function TeacherDaycarePage() {
  const { classes, selectedId, select, isLoading } = useClasses();
  const [kind, setKind] = useState<DaycareKind>('meals');
  const [logging, setLogging] = useState<string | null>(null);

  const students = useQuery({
    queryKey: ['classes', selectedId, 'students'],
    queryFn: () => classesApi.students(selectedId),
    enabled: !!selectedId,
  });

  const active = KINDS.find((item) => item.value === kind)!;

  return (
    <div className="space-y-5">
      <PageHeader title="Daily logs" subtitle="What parents see as the diary" />

      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : !classes.length ? (
        <EmptyState
          icon={<Baby className="size-6" />}
          title="No classes assigned"
          message="Once the office assigns you a class, you can log its day here."
        />
      ) : (
        <>
          <ClassPicker classes={classes} selectedId={selectedId} onSelect={select} />

          <Tabs
            value={kind}
            onChange={(value) => setKind(value as DaycareKind)}
            items={KINDS.map((item) => ({ value: item.value, label: item.label }))}
          />

          {students.isLoading ? (
            <ListSkeleton />
          ) : !students.data?.length ? (
            <EmptyState icon={<Baby className="size-6" />} title="No students in this class" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {students.data.map((student) => (
                <Card key={entityId(student)} className="flex items-center gap-3">
                  <Avatar
                    name={studentName(student)}
                    id={entityId(student)}
                    src={student.photoUrl}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{studentName(student)}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {student.admissionNumber}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setLogging(entityId(student))}
                    icon={active.icon}
                    aria-label={`Log ${active.label.toLowerCase()} for ${studentName(student)}`}
                  >
                    Log
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <DiaryLogModal
        kind={kind}
        open={!!logging}
        studentId={logging}
        studentName={
          students.data?.find((s) => entityId(s) === logging)
            ? studentName(students.data.find((s) => entityId(s) === logging)!)
            : ''
        }
        onClose={() => setLogging(null)}
      />
    </div>
  );
}
