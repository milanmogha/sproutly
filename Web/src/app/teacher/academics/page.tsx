'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, ClipboardList, NotebookPen, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { academicApi, classesApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  refId,
  studentName,
  type Assessment,
  type Syllabus,
} from '@/lib/api/types';
import { useClasses } from '@/lib/hooks/use-classes';
import { ClassPicker } from '@/components/shared/class-picker';
import {
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
import { Input, Select, Textarea } from '@/components/ui/form';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';

type Tab = 'homework' | 'assessments' | 'lessons' | 'syllabus';

/** Everything a teacher sets and marks for their class. */
export default function TeacherAcademicsPage() {
  const { classes, selectedId, select, isLoading: loadingClasses } = useClasses();
  const [tab, setTab] = useState<Tab>('homework');
  const [creating, setCreating] = useState(false);
  const [grading, setGrading] = useState<Assessment | null>(null);
  const [deletingHomework, setDeletingHomework] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const homework = useQuery({
    queryKey: ['academic', 'homework', selectedId],
    queryFn: () => academicApi.homework({ classId: selectedId }),
    enabled: !!selectedId && tab === 'homework',
  });

  const assessments = useQuery({
    queryKey: ['academic', 'assessments', selectedId],
    queryFn: () => academicApi.assessments({ classId: selectedId }),
    enabled: !!selectedId && tab === 'assessments',
  });

  const lessons = useQuery({
    queryKey: ['academic', 'lesson-plans', selectedId],
    queryFn: () => academicApi.lessonPlans({ classId: selectedId }),
    enabled: !!selectedId && tab === 'lessons',
  });

  const syllabus = useQuery({
    queryKey: ['academic', 'syllabus', selectedId],
    queryFn: () => academicApi.syllabus({ classId: selectedId }),
    enabled: !!selectedId && tab === 'syllabus',
  });

  const removeHomework = useMutation({
    mutationFn: (id: string) => academicApi.removeHomework(id),
    onSuccess: () => {
      toast.success('Homework removed.');
      void queryClient.invalidateQueries({ queryKey: ['academic', 'homework'] });
      setDeletingHomework(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that homework.')),
  });

  /**
   * The syllabus has no PATCH — it upserts on class+subject+year — so a unit
   * toggle re-sends the syllabus with that one flag flipped. The checkmark
   * moves immediately (optimistic) and rolls back if the save fails.
   */
  const toggleUnit = useMutation({
    mutationFn: ({ syllabus: subject, index }: { syllabus: Syllabus; index: number }) => {
      const units = (subject.units ?? []).map((unit, i) =>
        i === index ? { ...unit, completed: !unit.completed } : unit,
      );
      return academicApi.updateSyllabus({
        classId: refId(subject.classId),
        subject: subject.subject,
        academicYear: subject.academicYear,
        units,
      });
    },
    onMutate: ({ syllabus: subject, index }) => {
      const key = ['academic', 'syllabus', refId(subject.classId)];
      const previous = queryClient.getQueryData<Syllabus[]>(key);
      queryClient.setQueryData<Syllabus[]>(key, (current) =>
        (current ?? []).map((row) =>
          entityId(row) === entityId(subject)
            ? {
                ...row,
                units: (row.units ?? []).map((unit, i) =>
                  i === index ? { ...unit, completed: !unit.completed } : unit,
                ),
              }
            : row,
        ),
      );
      return { key, previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error(errorMessage(error, 'Could not update that unit.'));
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context?.key) void queryClient.invalidateQueries({ queryKey: context.key });
    },
  });

  const NEW_LABEL: Record<Tab, string> = {
    homework: 'Set homework',
    assessments: 'New assessment',
    lessons: 'New lesson plan',
    syllabus: 'Add syllabus',
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Academics"
        subtitle="Homework, assessments and plans"
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => setCreating(true)}
            disabled={!selectedId}
          >
            {NEW_LABEL[tab]}
          </Button>
        }
      />

      {loadingClasses ? (
        <ListSkeleton rows={2} />
      ) : !classes.length ? (
        <EmptyState
          icon={<BookOpen className="size-6" />}
          title="No classes assigned"
          message="Once the office assigns you a class, you can plan its work here."
        />
      ) : (
        <>
          <ClassPicker classes={classes} selectedId={selectedId} onSelect={select} />

          <Tabs
            value={tab}
            onChange={(value) => setTab(value as Tab)}
            items={[
              { value: 'homework', label: 'Homework' },
              { value: 'assessments', label: 'Assessments' },
              { value: 'lessons', label: 'Lesson plans' },
              { value: 'syllabus', label: 'Syllabus' },
            ]}
          />

          {tab === 'homework' && (
            <QuerySection
              query={homework}
              empty={{ icon: <BookOpen className="size-6" />, title: 'No homework set' }}
            >
              {(items) => (
                <div className="grid gap-3 lg:grid-cols-2">
                  {items.map((item) => (
                    <Card key={entityId(item)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display font-bold">{item.title}</p>
                          <p className="text-xs font-semibold text-accent">{item.subject}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {item.dueDate && (
                            <Badge tone="warning">Due {formatDate(item.dueDate)}</Badge>
                          )}
                          <IconButton
                            label="Delete homework"
                            onClick={() => setDeletingHomework(entityId(item))}
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </div>
                      </div>
                      {item.description && (
                        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                          {item.description}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </QuerySection>
          )}

          {tab === 'assessments' && (
            <QuerySection
              query={assessments}
              empty={{ icon: <ClipboardList className="size-6" />, title: 'No assessments yet' }}
            >
              {(items) => (
                <div className="grid gap-3 lg:grid-cols-2">
                  {items.map((assessment) => (
                    <Card key={entityId(assessment)} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display font-bold">{assessment.title}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {assessment.subject ?? '—'} · {formatDate(assessment.date)} · max{' '}
                          {assessment.maxScore ?? '—'}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setGrading(assessment)}>
                        Enter marks
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </QuerySection>
          )}

          {tab === 'lessons' && (
            <QuerySection
              query={lessons}
              empty={{ icon: <NotebookPen className="size-6" />, title: 'No lesson plans' }}
            >
              {(items) => (
                <div className="grid gap-3 lg:grid-cols-2">
                  {items.map((plan) => (
                    <Card key={entityId(plan)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display font-bold">{plan.title}</p>
                          <p className="text-xs font-semibold text-accent">{plan.subject}</p>
                        </div>
                        {plan.date && <Badge tone="accent">{formatDate(plan.date)}</Badge>}
                      </div>
                      {!!plan.objectives?.length && (
                        <div className="mt-2">
                          <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase">
                            Objectives
                          </p>
                          <ul className="list-inside list-disc text-sm text-[var(--color-text-muted)]">
                            {plan.objectives.map((objective, index) => (
                              <li key={index}>{objective}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!!plan.activities?.length && (
                        <div className="mt-2">
                          <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase">
                            Activities
                          </p>
                          <ul className="list-inside list-disc text-sm text-[var(--color-text-muted)]">
                            {plan.activities.map((activity, index) => (
                              <li key={index}>{activity}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </QuerySection>
          )}

          {tab === 'syllabus' && (
            <QuerySection
              query={syllabus}
              empty={{ icon: <BookOpen className="size-6" />, title: 'No syllabus yet' }}
            >
              {(items) => (
                <div className="space-y-3">
                  {items.map((subject) => {
                    const units = subject.units ?? [];
                    const done = units.filter((unit) => unit.completed).length;
                    return (
                      <Card key={entityId(subject)}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="font-display text-lg font-bold">{subject.subject}</p>
                          <Badge tone="accent">
                            {done}/{units.length} units
                          </Badge>
                        </div>
                        <ul className="space-y-1.5">
                          {units.map((unit, index) => {
                            const checked = !!unit.completed;
                            return (
                              <li key={index} className="text-sm">
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={checked}
                                  disabled={toggleUnit.isPending}
                                  aria-label={`${checked ? 'Mark not done' : 'Mark done'}: ${unit.title}`}
                                  onClick={() =>
                                    toggleUnit.mutate({
                                      syllabus: subject,
                                      index,
                                    })
                                  }
                                  className="inline-flex items-start gap-2 text-left disabled:opacity-70"
                                >
                                  <span
                                    className={
                                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition ' +
                                      (checked
                                        ? 'border-accent bg-accent text-white'
                                        : 'border-[var(--color-hairline)] bg-white text-transparent hover:border-accent')
                                    }
                                  >
                                    <Check className="size-3.5" />
                                  </span>
                                  {unit.title}
                                </button>
                                {!!unit.topics?.length && (
                                  <span className="block text-xs text-[var(--color-text-muted)]">
                                    {unit.topics.join(' · ')}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </Card>
                    );
                  })}
                </div>
              )}
            </QuerySection>
          )}
        </>
      )}

      <CreateModal
        tab={tab}
        classId={selectedId}
        open={creating}
        onClose={() => setCreating(false)}
      />

      <GradeModal assessment={grading} classId={selectedId} onClose={() => setGrading(null)} />

      <ConfirmDialog
        open={!!deletingHomework}
        onClose={() => setDeletingHomework(null)}
        onConfirm={() => deletingHomework && removeHomework.mutate(deletingHomework)}
        title="Delete this homework?"
        message="Parents will no longer see it."
        confirmLabel="Delete"
        destructive
        loading={removeHomework.isPending}
      />
    </div>
  );
}

/** Loading / error / empty branching, shared by the four tabs. */
function QuerySection<T>({
  query,
  empty,
  children,
}: {
  query: { data?: T[]; isLoading: boolean; error: unknown; refetch: () => unknown };
  empty: { icon?: React.ReactNode; title: string };
  children: (items: T[]) => React.ReactNode;
}) {
  if (query.isLoading) return <ListSkeleton />;
  if (query.error) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  if (!query.data?.length) return <EmptyState {...empty} />;
  return <>{children(query.data)}</>;
}

/** One modal, four shapes — whichever tab the teacher is on. */
function CreateModal({
  tab,
  classId,
  open,
  onClose,
}: {
  tab: Tab;
  classId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    subject: '',
    description: '',
    dueDate: '',
    date: '',
    maxScore: '',
    type: 'quiz',
    objectives: '',
    activities: '',
    academicYear: String(new Date().getFullYear()),
    units: '',
  });
  const toast = useToast();
  const queryClient = useQueryClient();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Newline-separated text → the string arrays the API expects. */
  const lines = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const create = useMutation({
    // The four tabs post to four different endpoints returning four different
    // shapes; nothing here reads the result, so widen it rather than union it.
    mutationFn: (): Promise<unknown> => {
      switch (tab) {
        case 'homework':
          return academicApi.createHomework({
            classId,
            title: form.title.trim(),
            subject: form.subject.trim(),
            description: form.description.trim() || undefined,
            dueDate: form.dueDate || undefined,
            assignedDate: new Date().toISOString(),
          });
        case 'assessments':
          return academicApi.createAssessment({
            classId,
            title: form.title.trim(),
            subject: form.subject.trim() || undefined,
            type: form.type,
            maxScore: form.maxScore ? Number(form.maxScore) : undefined,
            date: form.date || undefined,
          });
        case 'lessons':
          return academicApi.createLessonPlan({
            classId,
            title: form.title.trim(),
            subject: form.subject.trim() || undefined,
            objectives: lines(form.objectives),
            activities: lines(form.activities),
            date: form.date || undefined,
          });
        case 'syllabus':
          return academicApi.createSyllabus({
            classId,
            subject: form.subject.trim(),
            academicYear: form.academicYear.trim(),
            // One unit per line; topics after a colon, comma separated.
            units: lines(form.units).map((line) => {
              const [title, topics] = line.split(':');
              return {
                title: title.trim(),
                topics: topics ? topics.split(',').map((t) => t.trim()).filter(Boolean) : [],
                completed: false,
              };
            }),
          });
      }
    },
    onSuccess: () => {
      toast.success('Saved.');
      void queryClient.invalidateQueries({ queryKey: ['academic'] });
      setForm({
        title: '',
        subject: '',
        description: '',
        dueDate: '',
        date: '',
        maxScore: '',
        type: 'quiz',
        objectives: '',
        activities: '',
        academicYear: String(new Date().getFullYear()),
        units: '',
      });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save that.')),
  });

  const TITLES: Record<Tab, string> = {
    homework: 'Set homework',
    assessments: 'New assessment',
    lessons: 'New lesson plan',
    syllabus: 'Add syllabus',
  };

  const canSave =
    tab === 'syllabus' ? !!form.subject.trim() : !!form.title.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[tab]}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!canSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {tab !== 'syllabus' && (
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="sm:col-span-2"
            required
          />
        )}
        <Input
          label="Subject"
          value={form.subject}
          onChange={(e) => set('subject', e.target.value)}
          placeholder="English"
          required={tab === 'syllabus' || tab === 'homework'}
        />

        {tab === 'homework' && (
          <>
            <Input
              label="Due"
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
            <Textarea
              label="Instructions"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              className="sm:col-span-2"
            />
          </>
        )}

        {tab === 'assessments' && (
          <>
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              options={[
                { value: 'quiz', label: 'Quiz' },
                { value: 'test', label: 'Test' },
                { value: 'exam', label: 'Exam' },
                { value: 'project', label: 'Project' },
                { value: 'observation', label: 'Observation' },
              ]}
            />
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
            <Input
              label="Maximum score"
              type="number"
              min={1}
              value={form.maxScore}
              onChange={(e) => set('maxScore', e.target.value)}
              placeholder="100"
            />
          </>
        )}

        {tab === 'lessons' && (
          <>
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
            <Textarea
              label="Objectives"
              value={form.objectives}
              onChange={(e) => set('objectives', e.target.value)}
              rows={3}
              hint="One per line"
              className="sm:col-span-2"
            />
            <Textarea
              label="Activities"
              value={form.activities}
              onChange={(e) => set('activities', e.target.value)}
              rows={3}
              hint="One per line"
              className="sm:col-span-2"
            />
          </>
        )}

        {tab === 'syllabus' && (
          <>
            <Input
              label="Academic year"
              value={form.academicYear}
              onChange={(e) => set('academicYear', e.target.value)}
            />
            <Textarea
              label="Units"
              value={form.units}
              onChange={(e) => set('units', e.target.value)}
              rows={6}
              hint="One per line — “Unit name: topic, topic”"
              className="sm:col-span-2"
            />
          </>
        )}
      </div>
    </Modal>
  );
}

/** Enters a whole class's marks against one assessment in a single submit. */
function GradeModal({
  assessment,
  classId,
  onClose,
}: {
  assessment: Assessment | null;
  classId: string;
  onClose: () => void;
}) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const toast = useToast();
  const queryClient = useQueryClient();

  const students = useQuery({
    queryKey: ['classes', classId, 'students'],
    queryFn: () => classesApi.students(classId),
    enabled: !!assessment && !!classId,
  });

  const existing = useQuery({
    queryKey: ['academic', 'assessments', entityId(assessment ?? {}), 'results'],
    queryFn: () => academicApi.assessmentResults(entityId(assessment!)),
    enabled: !!assessment,
  });

  // Pre-fill anything already marked so a second pass edits rather than doubles.
  useEffect(() => {
    if (!existing.data) return;
    const next: Record<string, string> = {};
    existing.data.forEach((result) => {
      // The API returns the child under `student`; reading `studentId` meant
      // marks already entered never loaded back into the form.
      const studentId = refId(result.student);
      if (studentId) next[studentId] = String(result.score);
    });
    setScores(next);
  }, [existing.data]);

  const save = useMutation({
    mutationFn: () =>
      academicApi.recordResults({
        assessmentId: entityId(assessment!),
        entries: Object.entries(scores)
          .filter(([, score]) => score !== '')
          .map(([studentId, score]) => ({ studentId, score: Number(score) })),
      }),
    onSuccess: () => {
      toast.success('Marks saved.');
      void queryClient.invalidateQueries({ queryKey: ['academic'] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save those marks.')),
  });

  const max = assessment?.maxScore ?? 100;

  return (
    <Modal
      open={!!assessment}
      onClose={onClose}
      title={assessment?.title ?? 'Enter marks'}
      description={`Out of ${max}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Save className="size-4" />} onClick={() => save.mutate()} loading={save.isPending}>
            Save marks
          </Button>
        </>
      }
    >
      {students.isLoading ? (
        <ListSkeleton rows={4} />
      ) : !students.data?.length ? (
        <EmptyState title="No students in this class" />
      ) : (
        <div className="space-y-2">
          {students.data.map((student) => {
            const id = entityId(student);
            return (
              <div
                key={id}
                className="flex items-center gap-3 border-b border-[var(--color-hairline)] py-2 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                  {studentName(student)}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={max}
                  value={scores[id] ?? ''}
                  onChange={(e) => setScores({ ...scores, [id]: e.target.value })}
                  aria-label={`Score for ${studentName(student)}`}
                  className="w-24 text-center"
                />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
