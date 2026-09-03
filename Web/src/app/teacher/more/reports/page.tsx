'use client';

import { useQuery } from '@tanstack/react-query';
import { useQueries } from '@tanstack/react-query';
import { BarChart3, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { academicApi, attendanceApi, classesApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { className as classLabel, entityId } from '@/lib/api/types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  SectionTitle,
} from '@/components/ui/primitives';
import { Select } from '@/components/ui/form';
import { count, toIsoDate } from '@/lib/utils';

/**
 * How one class is doing — today's roll-call and its assessment averages.
 *
 * Both reports are per class, so the picker gates the whole page rather than
 * each card: without a class there is nothing to average.
 */
export default function TeacherReportsPage() {
  const [classId, setClassId] = useState('');
  const today = toIsoDate(new Date());

  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  const summary = useQuery({
    queryKey: ['attendance', 'summary', classId, today],
    queryFn: () => attendanceApi.classSummary(classId, { date: today }),
    enabled: !!classId,
  });

  const assessments = useQuery({
    queryKey: ['assessments', classId],
    queryFn: () => academicApi.assessments({ classId }),
    enabled: !!classId,
  });

  // One results call per assessment. They are independent, so they run
  // together rather than in sequence.
  const resultQueries = useQueries({
    queries: (assessments.data ?? []).map((assessment) => ({
      queryKey: ['assessments', entityId(assessment), 'results'],
      queryFn: () => academicApi.assessmentResults(entityId(assessment)),
    })),
  });

  const averages = (assessments.data ?? []).map((assessment, index) => {
    const results = resultQueries[index]?.data ?? [];
    const max = assessment.maxScore ?? 0;
    // An assessment nobody has been scored on, or one marked out of nothing,
    // has no average — it is not the same as an average of zero.
    const percent =
      results.length && max > 0
        ? (results.reduce((sum, result) => sum + (result.score ?? 0), 0) / results.length / max) *
          100
        : null;
    return { assessment, scored: results.length, percent };
  });

  const scored = averages.filter((row) => row.percent !== null);
  const classAverage = scored.length
    ? scored.reduce((sum, row) => sum + row.percent!, 0) / scored.length
    : null;

  const present = summary.data?.byStatus?.present ?? 0;
  const attendancePct = summary.data?.total
    ? Math.round((present / summary.data.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Attendance and results, by class" />

      <Card>
        <Select
          label="Class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          placeholder={classes.isLoading ? 'Loading…' : 'Choose a class'}
          options={(classes.data ?? []).map((schoolClass) => ({
            value: entityId(schoolClass),
            label: classLabel(schoolClass),
          }))}
        />
      </Card>

      {!classId ? (
        <EmptyState
          icon={<BarChart3 className="size-6" />}
          title="Pick a class"
          message="Choose a class above to see today's attendance and its assessment averages."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle title="Today's attendance" />
            {summary.isLoading ? (
              <ListSkeleton rows={2} />
            ) : summary.error ? (
              <ErrorState
                message={errorMessage(summary.error)}
                onRetry={() => summary.refetch()}
              />
            ) : !summary.data?.total ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Nobody is on this class&apos;s roll yet.
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-extrabold text-accent">
                    {attendancePct}%
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    present · {count(summary.data.total, 'child', 'children')} on the roll
                  </span>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${attendancePct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success">{present} present</Badge>
                  <Badge tone="danger">{summary.data.byStatus?.absent ?? 0} absent</Badge>
                  <Badge tone="warning">{summary.data.byStatus?.late ?? 0} late</Badge>
                  <Badge tone="neutral">{summary.data.notMarked} unmarked</Badge>
                </div>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle
              title="Assessment averages"
              action={
                classAverage !== null ? (
                  <Badge tone="accent">{Math.round(classAverage)}% overall</Badge>
                ) : undefined
              }
            />
            {assessments.isLoading ? (
              <ListSkeleton rows={3} />
            ) : assessments.error ? (
              <ErrorState
                message={errorMessage(assessments.error)}
                onRetry={() => assessments.refetch()}
              />
            ) : !averages.length ? (
              <EmptyState
                icon={<ClipboardList className="size-6" />}
                title="No assessments yet"
                message="Create assessments in Academics to see averages here."
              />
            ) : (
              <ul>
                {averages.map(({ assessment, scored: scoredCount, percent }) => (
                  <li
                    key={entityId(assessment)}
                    className="flex items-center gap-3 border-b border-[var(--color-hairline)] py-2.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{assessment.title}</span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {[assessment.subject, count(scoredCount, 'result')]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {percent === null ? (
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                        Not scored
                      </span>
                    ) : (
                      <span className="shrink-0 font-display text-lg font-bold text-accent">
                        {Math.round(percent)}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
