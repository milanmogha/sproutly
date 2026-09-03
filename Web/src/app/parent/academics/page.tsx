'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';
import { academicApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  refId,
  resultAssessment,
  resultMaxScore,
  type MilestoneStatus,
} from '@/lib/api/types';
import { useChild } from '@/lib/parent/child-context';
import { ChildSwitcher } from '@/components/parent/child-switcher';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { cn, formatDate, humanize } from '@/lib/utils';

type Tab = 'homework' | 'results' | 'milestones' | 'remarks' | 'syllabus';

const MILESTONE_TONE: Record<MilestoneStatus, 'success' | 'warning' | 'neutral'> = {
  achieved: 'success',
  emerging: 'warning',
  not_started: 'neutral',
};

export default function ParentAcademicsPage() {
  const { selected } = useChild();
  const [tab, setTab] = useState<Tab>('homework');
  const studentId = selected ? entityId(selected) : '';
  const classId = refId(selected?.classId);

  const homework = useQuery({
    queryKey: ['parent', 'homework', classId],
    queryFn: () => academicApi.homework({ classId }),
    enabled: !!classId && tab === 'homework',
  });

  const results = useQuery({
    queryKey: ['parent', 'progress', studentId],
    queryFn: () => academicApi.studentProgress(studentId),
    enabled: !!studentId && tab === 'results',
  });

  const milestones = useQuery({
    queryKey: ['parent', 'milestones', studentId],
    queryFn: () => academicApi.milestones(studentId),
    enabled: !!studentId && tab === 'milestones',
  });

  const remarks = useQuery({
    queryKey: ['parent', 'remarks', studentId],
    queryFn: () => academicApi.remarks(studentId),
    enabled: !!studentId && tab === 'remarks',
  });

  const syllabus = useQuery({
    queryKey: ['parent', 'syllabus', classId],
    queryFn: () => academicApi.syllabus({ classId }),
    enabled: !!classId && tab === 'syllabus',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Academics"
        subtitle={selected ? `${selected.firstName}'s learning` : undefined}
      />
      <ChildSwitcher />

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { value: 'homework', label: 'Homework' },
          { value: 'results', label: 'Results' },
          { value: 'milestones', label: 'Milestones' },
          { value: 'remarks', label: 'Remarks' },
          { value: 'syllabus', label: 'Syllabus' },
        ]}
      />

      {tab === 'homework' && (
        <Section
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
                    {item.dueDate && <Badge tone="warning">Due {formatDate(item.dueDate)}</Badge>}
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
        </Section>
      )}

      {tab === 'results' && (
        <Section
          query={results}
          empty={{ icon: <GraduationCap className="size-6" />, title: 'No results published' }}
        >
          {(items) => (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((result) => {
                const assessment = resultAssessment(result);
                const max = resultMaxScore(result);
                const pct = max > 0 ? Math.round((result.score / max) * 100) : 0;
                return (
                  <Card key={entityId(result)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display font-bold">
                          {assessment?.title ?? 'Assessment'}
                        </p>
                        {assessment?.subject && (
                          <p className="text-xs font-semibold text-accent">{assessment.subject}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-bold">
                          {result.score}
                          <span className="text-sm text-[var(--color-text-muted)]">/{max}</span>
                        </p>
                        {result.grade && <Badge tone="accent">{result.grade}</Badge>}
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    {result.remarks && (
                      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                        {result.remarks}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {tab === 'milestones' && (
        <Section
          query={milestones}
          empty={{ icon: <Target className="size-6" />, title: 'No milestones tracked yet' }}
        >
          {(items) => (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((milestone) => (
                <Card key={entityId(milestone)} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-1 size-3 shrink-0 rounded-full',
                      milestone.status === 'achieved'
                        ? 'bg-[var(--color-success)]'
                        : milestone.status === 'emerging'
                          ? 'bg-[var(--color-sunny)]'
                          : 'bg-[var(--color-hairline)]',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold">{milestone.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {humanize(milestone.category)}
                    </p>
                    {milestone.notes && (
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {milestone.notes}
                      </p>
                    )}
                  </div>
                  <Badge tone={MILESTONE_TONE[milestone.status] ?? 'neutral'}>
                    {humanize(milestone.status)}
                  </Badge>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === 'remarks' && (
        <Section
          query={remarks}
          empty={{ icon: <Sparkles className="size-6" />, title: 'No teacher remarks yet' }}
        >
          {(items) => (
            <div className="space-y-3">
              {items.map((remark) => (
                <Card key={entityId(remark)}>
                  <p className="text-sm leading-relaxed">{remark.remark}</p>
                  <p className="mt-2 text-xs font-semibold text-[var(--color-text-muted)]">
                    {formatDate(remark.date)}
                    {remark.term ? ` · ${remark.term}` : ''}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === 'syllabus' && (
        <Section
          query={syllabus}
          empty={{ icon: <BookOpen className="size-6" />, title: 'No syllabus published' }}
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
                    <ul className="space-y-2">
                      {units.map((unit, index) => (
                        <li key={index} className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              'mt-1 size-2.5 shrink-0 rounded-full',
                              unit.completed
                                ? 'bg-[var(--color-success)]'
                                : 'bg-[var(--color-hairline)]',
                            )}
                          />
                          <span className="min-w-0">
                            <span
                              className={cn(
                                'block text-sm font-bold',
                                unit.completed && 'text-[var(--color-text-muted)] line-through',
                              )}
                            >
                              {unit.title}
                            </span>
                            {!!unit.topics?.length && (
                              <span className="block text-xs text-[var(--color-text-muted)]">
                                {unit.topics.join(' · ')}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/**
 * Renders one tab's query: skeleton, error with retry, empty state, or the
 * list. Keeps the five tabs above free of duplicated branching.
 */
function Section<T>({
  query,
  empty,
  children,
}: {
  query: {
    data?: T[];
    isLoading: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  empty: { icon?: React.ReactNode; title: string; message?: string };
  children: (items: T[]) => React.ReactNode;
}) {
  if (query.isLoading) return <ListSkeleton />;
  if (query.error) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  if (!query.data?.length) return <EmptyState {...empty} />;
  return <>{children(query.data)}</>;
}
