'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Baby,
  CalendarCheck,
  Croissant,
  GraduationCap,
  HeartPulse,
  Moon,
  Palette,
  Pencil,
  Phone,
  Plus,
  Smile,
  Sparkles,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import {
  academicApi,
  attendanceApi,
  classesApi,
  daycareApi,
  studentsApi,
  type DaycareKind,
} from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  className as classLabel,
  diaryEntries,
  entityId,
  resultAssessment,
  resultMaxScore,
  studentName,
  type MilestoneStatus,
} from '@/lib/api/types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  SectionTitle,
  StatTile,
} from '@/components/ui/primitives';
import { DetailRow, TileGrid } from '@/components/ui/data-list';
import { Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/form';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { DiaryLogModal } from '@/components/shared/diary-log-modal';
import { EditStudentModal } from '@/components/admin/student-form';
import { formatDate, formatRelative, humanize, toIsoDate } from '@/lib/utils';

type Tab = 'overview' | 'attendance' | 'academics' | 'diary';

const MILESTONE_TONE: Record<MilestoneStatus, 'success' | 'warning' | 'neutral'> = {
  achieved: 'success',
  emerging: 'warning',
  not_started: 'neutral',
};

/**
 * One child, in full — shared by the teacher and admin portals.
 *
 * `canRecord` gates the staff actions (adding remarks and milestones); the
 * reading half is identical for both, so it lives here once.
 */
export function StudentDetail({
  studentId,
  canRecord = false,
  canLogDiary = false,
  canEdit = false,
}: {
  studentId: string;
  /** Staff actions — adding remarks and milestones. */
  canRecord?: boolean;
  /** Also allow posting a daily diary log straight from the Diary tab. */
  canLogDiary?: boolean;
  /**
   * Admin-only: correcting the record itself — names, status, guardians,
   * medical details. Teachers read those; they do not rewrite them.
   */
  canEdit?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [addingRemark, setAddingRemark] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [diaryKind, setDiaryKind] = useState<DaycareKind | null>(null);

  const student = useQuery({
    queryKey: ['students', studentId],
    queryFn: () => studentsApi.get(studentId),
    enabled: !!studentId,
  });

  const monthStart = toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const report = useQuery({
    queryKey: ['attendance', 'student', studentId, monthStart],
    queryFn: () => attendanceApi.studentReport(studentId, { from: monthStart, to: toIsoDate() }),
    enabled: !!studentId && tab === 'attendance',
  });

  const results = useQuery({
    queryKey: ['academic', 'progress', studentId],
    queryFn: () => academicApi.studentProgress(studentId),
    enabled: !!studentId && tab === 'academics',
  });

  const milestones = useQuery({
    queryKey: ['academic', 'milestones', studentId],
    queryFn: () => academicApi.milestones(studentId),
    enabled: !!studentId && tab === 'academics',
  });

  const remarks = useQuery({
    queryKey: ['academic', 'remarks', studentId],
    queryFn: () => academicApi.remarks(studentId),
    enabled: !!studentId && tab === 'academics',
  });

  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  const diary = useQuery({
    queryKey: ['daycare', 'diary', studentId],
    queryFn: () => daycareApi.diary(studentId, { date: toIsoDate() }),
    enabled: !!studentId && tab === 'diary',
  });

  if (student.isLoading) return <ListSkeleton rows={4} />;
  if (student.error) {
    return <ErrorState message={errorMessage(student.error)} onRetry={() => student.refetch()} />;
  }
  if (!student.data) return null;

  const child = student.data;
  // The API groups the day's logs by kind; flatten them into one timeline.
  const diaryLog = diaryEntries(diary.data);
  const medical = child.medicalInfo ?? {};

  return (
    <div className="space-y-5">
      <PageHeader
        title={studentName(child)}
        subtitle={`${classLabel(child.classId, classes.data)} · ${child.admissionNumber}`}
        actions={
          canRecord && (
            <>
              {canEdit && (
                <Button
                  variant="secondary"
                  icon={<Pencil className="size-4" />}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              )}
              <Button
                variant="secondary"
                icon={<Sparkles className="size-4" />}
                onClick={() => setAddingRemark(true)}
              >
                Add remark
              </Button>
              <Button icon={<Target className="size-4" />} onClick={() => setAddingMilestone(true)}>
                Add milestone
              </Button>
            </>
          )
        }
      />

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'attendance', label: 'Attendance' },
          { value: 'academics', label: 'Academics' },
          { value: 'diary', label: 'Diary' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <Avatar
                name={studentName(child)}
                id={entityId(child)}
                src={child.photoUrl}
                size={56}
              />
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{studentName(child)}</p>
                <Badge tone={child.status === 'active' ? 'success' : 'neutral'}>
                  {humanize(child.status)}
                </Badge>
              </div>
            </div>
            <dl>
              <DetailRow label="Admission no." value={child.admissionNumber} />
              <DetailRow label="Class" value={classLabel(child.classId, classes.data)} />
              <DetailRow label="Date of birth" value={formatDate(child.dateOfBirth)} />
              <DetailRow label="Gender" value={humanize(child.gender)} />
              <DetailRow
                label="Profile"
                value={
                  child.profileCompleted ? (
                    <Badge tone="success">Complete</Badge>
                  ) : (
                    <Badge tone="warning">Incomplete</Badge>
                  )
                }
              />
            </dl>
          </Card>

          <Card>
            <SectionTitle title="Guardians" />
            {child.guardians?.length ? (
              <ul className="space-y-3">
                {child.guardians.map((guardian, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Avatar name={guardian.name} id={guardian.phone} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {guardian.name}
                        {guardian.isPrimary && (
                          <Badge tone="accent" className="ml-2">
                            Primary
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {humanize(guardian.relationship)}
                      </p>
                      <a
                        href={`tel:${guardian.phone}`}
                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-accent"
                      >
                        <Phone className="size-3.5" />
                        {guardian.phone}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No guardians on file.</p>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <SectionTitle title="Medical" />
            <div className="grid gap-4 sm:grid-cols-2">
              <dl>
                <DetailRow label="Blood group" value={medical.bloodGroup ?? '—'} />
                <DetailRow
                  label="Allergies"
                  value={
                    medical.allergies?.length ? (
                      <span className="font-bold text-[var(--color-danger)]">
                        {medical.allergies.join(', ')}
                      </span>
                    ) : (
                      'None recorded'
                    )
                  }
                />
                <DetailRow
                  label="Conditions"
                  value={medical.conditions?.length ? medical.conditions.join(', ') : 'None'}
                />
                <DetailRow label="Physician" value={medical.physicianName ?? '—'} />
              </dl>
              <div>
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
                  <HeartPulse className="size-4" />
                  Vaccinations
                </p>
                {medical.vaccinations?.length ? (
                  <ul className="space-y-1.5">
                    {medical.vaccinations.map((vaccination, index) => (
                      <li key={index} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{vaccination.name}</span>
                        <Badge tone={vaccination.administered ? 'success' : 'warning'}>
                          {vaccination.administered ? 'Done' : 'Due'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">None recorded.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'attendance' && (
        <>
          {report.isLoading ? (
            <ListSkeleton rows={2} />
          ) : report.error ? (
            <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />
          ) : (
            <>
              <TileGrid>
                <StatTile
                  label="Present"
                  value={report.data?.present ?? 0}
                  icon={<CalendarCheck className="size-5" />}
                  color="var(--color-success)"
                />
                <StatTile label="Absent" value={report.data?.absent ?? 0} color="var(--color-danger)" />
                <StatTile label="Late" value={report.data?.late ?? 0} color="var(--color-sunny)" />
                <StatTile
                  label="Rate"
                  value={`${report.data?.presentRate ?? 0}%`}
                  hint="This month"
                  color="var(--color-teal)"
                />
              </TileGrid>

              <Card>
                <SectionTitle title="This month" />
                {report.data?.days?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {report.data.days.map((day) => (
                      <span
                        key={day.date}
                        title={`${formatDate(day.date)} — ${humanize(day.status)}`}
                        className="grid size-8 place-items-center rounded-lg text-xs font-bold text-white"
                        style={{
                          backgroundColor:
                            day.status === 'present'
                              ? 'var(--color-success)'
                              : day.status === 'absent'
                                ? 'var(--color-danger)'
                                : day.status === 'late'
                                  ? 'var(--color-sunny)'
                                  : 'var(--color-blue)',
                        }}
                      >
                        {new Date(day.date).getDate()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Nothing marked this month.
                  </p>
                )}
              </Card>
            </>
          )}
        </>
      )}

      {tab === 'academics' && (
        <div className="space-y-6">
          <section>
            <SectionTitle title="Results" />
            {results.isLoading ? (
              <ListSkeleton rows={2} />
            ) : !results.data?.length ? (
              <EmptyState icon={<GraduationCap className="size-6" />} title="No results yet" />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {results.data.map((result) => {
                  const assessment = resultAssessment(result);
                  const max = resultMaxScore(result);
                  return (
                    <Card key={entityId(result)} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">
                          {assessment?.title ?? 'Assessment'}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">{assessment?.subject}</p>
                      </div>
                      <p className="shrink-0 font-display text-xl font-bold">
                        {result.score}
                        <span className="text-sm text-[var(--color-text-muted)]">/{max}</span>
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <SectionTitle title="Milestones" />
            {milestones.isLoading ? (
              <ListSkeleton rows={2} />
            ) : !milestones.data?.length ? (
              <EmptyState icon={<Target className="size-6" />} title="No milestones tracked" />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {milestones.data.map((milestone) => (
                  <Card key={entityId(milestone)} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{milestone.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {humanize(milestone.category)}
                      </p>
                    </div>
                    <Badge tone={MILESTONE_TONE[milestone.status] ?? 'neutral'}>
                      {humanize(milestone.status)}
                    </Badge>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle title="Remarks" />
            {remarks.isLoading ? (
              <ListSkeleton rows={2} />
            ) : !remarks.data?.length ? (
              <EmptyState icon={<Sparkles className="size-6" />} title="No remarks yet" />
            ) : (
              <div className="space-y-3">
                {remarks.data.map((remark) => (
                  <Card key={entityId(remark)}>
                    <p className="text-sm leading-relaxed">{remark.remark}</p>
                    <p className="mt-2 text-xs font-semibold text-[var(--color-text-muted)]">
                      {formatDate(remark.date)}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'diary' && (
        <>
          {canLogDiary && (
            <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
              {DIARY_KINDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDiaryKind(item.value)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--color-text-muted)] shadow-[var(--shadow-card)] transition hover:bg-accent-tint hover:text-accent"
                >
                  <item.icon className="size-4" />
                  Log {item.label.toLowerCase()}
                </button>
              ))}
            </div>
          )}

          {diary.isLoading ? (
            <ListSkeleton rows={3} />
          ) : !diaryLog.length ? (
            <EmptyState
              icon={<Baby className="size-6" />}
              title="Nothing logged today"
              message="Meals, naps, activities and observations show up here."
            />
          ) : (
            <div className="space-y-2.5">
              {diaryLog.map((entry, index) => (
                <Card key={`${entry.kind}-${index}`} className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-tint text-accent">
                    <Baby className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{entry.title}</p>
                    {entry.subtitle && (
                      <p className="text-sm text-[var(--color-text-muted)]">{entry.subtitle}</p>
                    )}
                  </div>
                  {entry.when && (
                    <span className="shrink-0 text-xs font-bold text-[var(--color-text-muted)]">
                      {formatRelative(entry.when)}
                    </span>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {canEdit && (
        <EditStudentModal
          open={editing}
          student={child}
          onClose={() => setEditing(false)}
        />
      )}

      {canRecord && (
        <>
          <AddRemark
            open={addingRemark}
            onClose={() => setAddingRemark(false)}
            studentId={studentId}
          />
          <AddMilestone
            open={addingMilestone}
            onClose={() => setAddingMilestone(false)}
            studentId={studentId}
          />
        </>
      )}

      {canLogDiary && (
        <DiaryLogModal
          kind={diaryKind ?? 'meals'}
          open={!!diaryKind}
          studentId={studentId}
          studentName={studentName(child)}
          onClose={() => setDiaryKind(null)}
        />
      )}
    </div>
  );
}

/** What a teacher can add to a child's day, in the same order as Daily logs. */
const DIARY_KINDS: Array<{
  value: DaycareKind;
  label: string;
  icon: typeof Croissant;
}> = [
  { value: 'meals', label: 'Meal', icon: Croissant },
  { value: 'naps', label: 'Nap', icon: Moon },
  { value: 'activities', label: 'Activity', icon: Palette },
  { value: 'health', label: 'Health', icon: HeartPulse },
  { value: 'observations', label: 'Observation', icon: Smile },
];

function AddRemark({
  open,
  onClose,
  studentId,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
}) {
  const [remark, setRemark] = useState('');
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('general');
  const toast = useToast();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      academicApi.createRemark({
        studentId,
        remark: remark.trim(),
        term: term.trim() || undefined,
        category,
        // No `date` — the API timestamps it.
      }),
    onSuccess: () => {
      toast.success('Remark added.');
      void queryClient.invalidateQueries({ queryKey: ['academic', 'remarks'] });
      setRemark('');
      setTerm('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not add that remark.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add remark"
      description="Parents see this on their child's academics screen."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!remark.trim()}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea
          label="Remark"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={5}
          placeholder="How are they getting on?"
          required
        />
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { value: 'general', label: 'General' },
            { value: 'academic', label: 'Academic' },
            { value: 'behavior', label: 'Behaviour' },
            { value: 'appreciation', label: 'Appreciation' },
            { value: 'concern', label: 'Concern' },
          ]}
        />
        <Input
          label="Term"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Term 1"
        />
      </div>
    </Modal>
  );
}

function AddMilestone({
  open,
  onClose,
  studentId,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('motor');
  const [status, setStatus] = useState<MilestoneStatus>('emerging');
  const [notes, setNotes] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      academicApi.createMilestone({
        studentId,
        title: title.trim(),
        category,
        status,
        notes: notes.trim() || undefined,
        // No date — the API stamps `achievedDate` itself when the status says
        // achieved, and rejects the field if it's sent.
      }),
    onSuccess: () => {
      toast.success('Milestone added.');
      void queryClient.invalidateQueries({ queryKey: ['academic', 'milestones'] });
      setTitle('');
      setNotes('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not add that milestone.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add milestone"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!title.trim()}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Milestone"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Holds a pencil correctly"
          className="sm:col-span-2"
          required
        />
        <Select
          label="Area"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { value: 'motor', label: 'Motor skills' },
            { value: 'language', label: 'Language' },
            { value: 'social', label: 'Social & emotional' },
            { value: 'cognitive', label: 'Cognitive' },
            { value: 'self_help', label: 'Self-help' },
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
          options={[
            { value: 'not_started', label: 'Not started' },
            { value: 'emerging', label: 'Emerging' },
            { value: 'achieved', label: 'Achieved' },
          ]}
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  );
}
