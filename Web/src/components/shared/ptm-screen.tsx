'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import {
  classesApi,
  communicationApi,
  studentsApi,
  MAX_PAGE_LIMIT,
} from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  className as classLabel,
  entityId,
  listOf,
  ptmRequestedBy,
  ptmStudentName,
  refId,
  studentName,
  type PtmRequest,
  type PtmStatus,
  type Student,
} from '@/lib/api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/form';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth/auth-context';
import { cn, formatDateTime, humanize } from '@/lib/utils';

const STATUS_TONE: Record<PtmStatus, 'warning' | 'success' | 'danger' | 'neutral' | 'info'> = {
  requested: 'warning',
  scheduled: 'success',
  declined: 'danger',
  completed: 'info',
  cancelled: 'neutral',
};

const STATUS_ORDER: Record<PtmStatus, number> = {
  requested: 0,
  scheduled: 1,
  declined: 2,
  completed: 3,
  cancelled: 4,
};

/**
 * Parent–teacher meetings.
 *
 * The school calls these; a parent does not. `view` is the parent's read-only
 * list of meetings called for their children — the API refuses a parent who
 * tries to create one, so there is deliberately nothing to press here.
 * `respond` is the staff view, where a request is scheduled or declined, or a
 * new meeting is called for one child or a whole class.
 */
export function PtmScreen({ mode }: { mode: 'view' | 'respond' }) {
  const [responding, setResponding] = useState<PtmRequest | null>(null);
  const [completing, setCompleting] = useState<PtmRequest | null>(null);
  const [calling, setCalling] = useState(false);
  const { session } = useAuth();
  // Scheduling and declining are the office's call. A teacher may request a
  // meeting for their own class, and may close out a meeting once it's held.
  const isOffice = session?.role === 'admin' || session?.role === 'principal';

  const ptm = useQuery({
    queryKey: ['ptm', mode],
    queryFn: () => (mode === 'view' ? communicationApi.myPtm() : communicationApi.assignedPtm()),
  });

  // Pending requests first, so the office's open queue is what they see first.
  const sorted = [...(ptm.data ?? [])].sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99) ||
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  );
  const awaiting = sorted.filter((request) => request.status === 'requested');
  const rest = sorted.filter((request) => request.status !== 'requested');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parent–teacher meetings"
        subtitle={
          mode === 'view' ? 'Meetings the school has called' : 'Requests assigned to you'
        }
        actions={
          mode === 'respond' && (
            <Button icon={<Plus className="size-4" />} onClick={() => setCalling(true)}>
              Call a meeting
            </Button>
          )
        }
      />

      {ptm.isLoading ? (
        <ListSkeleton />
      ) : ptm.error ? (
        <ErrorState message={errorMessage(ptm.error)} onRetry={() => ptm.refetch()} />
      ) : !sorted.length ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No meetings"
          message={
            mode === 'view'
              ? 'The school has not called a meeting for your child yet.'
              : 'Nothing has been assigned to you.'
          }
        />
      ) : (
        <div className="space-y-6">
          {mode === 'respond' && isOffice && awaiting.length > 0 && (
            <section>
              <SectionHeading title="Awaiting your decision" count={awaiting.length} />
              <div className="grid gap-3 lg:grid-cols-2">
                {awaiting.map((request) => (
                  <PtmCard
                    key={entityId(request)}
                    request={request}
                    showRespond
                    onRespond={() => setResponding(request)}
                    onComplete={() => setCompleting(request)}
                  />
                ))}
              </div>
            </section>
          )}

          {(mode !== 'respond' || !isOffice || rest.length > 0) && (
            <section>
              {mode === 'respond' && isOffice && awaiting.length > 0 && (
                <SectionHeading title="Earlier meetings" />
              )}
              <div className="grid gap-3 lg:grid-cols-2">
                {sorted.map((request) => {
                  if (mode === 'respond' && isOffice && request.status === 'requested') {
                    return null;
                  }
                  return (
                    <PtmCard
                      key={entityId(request)}
                      request={request}
                      showRespond={isOffice && request.status === 'requested'}
                      isParent={mode === 'view'}
                      onRespond={() => setResponding(request)}
                      onComplete={() => setCompleting(request)}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {mode === 'respond' && (
        <CallMeeting open={calling} onClose={() => setCalling(false)} isOffice={isOffice} />
      )}

      <RespondPtm request={responding} onClose={() => setResponding(null)} />
      <CompletePtm request={completing} onClose={() => setCompleting(null)} />
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="mb-3 text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
      {title}
      {typeof count === 'number' && count > 0 ? ` · ${count}` : ''}
    </h2>
  );
}

function PtmCard({
  request,
  showRespond,
  onRespond,
  onComplete,
  isParent = false,
}: {
  request: PtmRequest;
  showRespond: boolean;
  onRespond: () => void;
  onComplete: () => void;
  /** Parent view — shows the "awaiting the school" caption on pending ones. */
  isParent?: boolean;
}) {
  const calledBy = ptmRequestedBy(request);
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-bold">{ptmStudentName(request)}</p>
          {calledBy.name && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Called by {calledBy.name}
              {calledBy.role ? ` · ${humanize(calledBy.role)}` : ''}
            </p>
          )}
        </div>
        <Badge tone={STATUS_TONE[request.status] ?? 'neutral'}>
          {humanize(request.status)}
        </Badge>
      </div>

      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{request.reason}</p>

      {request.status === 'requested' && isParent && (
        <p className="mt-2 text-xs font-semibold text-[var(--color-text-muted)] italic">
          Awaiting confirmation from the school.
        </p>
      )}

      {!!request.preferredSlots?.length && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Preferred: {request.preferredSlots.join(' · ')}
        </p>
      )}

      {request.scheduledAt && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-accent">
          <CalendarClock className="size-4 shrink-0" />
          {formatDateTime(request.scheduledAt)}
        </p>
      )}

      {request.responseNote && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)] italic">
          {request.responseNote}
        </p>
      )}

      {(showRespond || (request.status === 'scheduled' && !isParent)) && (
        <div className="mt-auto flex gap-2 pt-3">
          {showRespond && (
            <Button size="sm" onClick={onRespond}>
              Respond
            </Button>
          )}
          {request.status === 'scheduled' && !isParent && (
            <Button size="sm" variant="secondary" onClick={onComplete}>
              Mark held
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Closes out a meeting that has been held.
 *
 * Open to the office and to the meeting's own teacher, but only once the
 * scheduled day has arrived — the API refuses an early one.
 */
function CompletePtm({ request, onClose }: { request: PtmRequest | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const complete = useMutation({
    mutationFn: () =>
      communicationApi.respondToPtm(entityId(request!), {
        status: 'completed',
        responseNote: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Marked as held.');
      void queryClient.invalidateQueries({ queryKey: ['ptm'] });
      setNote('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not close that meeting.')),
  });

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title="Mark meeting as held"
      description={
        request?.scheduledAt ? `Scheduled for ${formatDateTime(request.scheduledAt)}` : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => complete.mutate()} loading={complete.isPending}>
            Mark held
          </Button>
        </>
      }
    >
      <Textarea
        label="What came out of it?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        hint="Shared with the parent"
      />
    </Modal>
  );
}

/**
 * Calls a meeting — for one child, or for whole classes at once.
 *
 * Teachers can only pick their own classes; the office sees the whole school.
 * An office call for a whole class is created already scheduled, so it asks
 * for a date and time; a teacher's is raised as a request the office decides.
 */
function CallMeeting({
  open,
  onClose,
  isOffice,
}: {
  open: boolean;
  onClose: () => void;
  isOffice: boolean;
}) {
  const [scope, setScope] = useState<'one' | 'class'>('one');
  const [studentId, setStudentId] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [slots, setSlots] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  // GET /classes is scoped by role: a teacher gets their own classes, the
  // office the whole school — which is exactly the reach each should have.
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: classesApi.list,
    enabled: open,
  });
  const classes = classesQuery.data ?? [];

  // One-student candidates. The office may pick any active child in the school;
  // a teacher is limited to the children in their own classes (the backend
  // rejects a PTM for a class they don't teach).
  const studentsQuery = useQuery({
    queryKey: ['students', 'ptm-picker'],
    // MAX_PAGE_LIMIT, not more: the API rejects a larger page outright.
    queryFn: () => studentsApi.list({ limit: MAX_PAGE_LIMIT, status: 'active' }),
    enabled: open && scope === 'one' && isOffice,
  });
  const allStudents = listOf(studentsQuery.data);

  // A teacher's candidates come from their own class rosters, which are not
  // capped the way the school-wide list is — so a child past the first page
  // still shows up for the teacher who teaches them.
  const rosterQueries = useQueries({
    queries: isOffice
      ? []
      : classes.map((schoolClass) => ({
          queryKey: ['classes', entityId(schoolClass), 'students'],
          queryFn: () => classesApi.students(entityId(schoolClass)),
          enabled: open && scope === 'one',
        })),
  });
  const rosterByClass = new Map<string, Student[]>();
  if (!isOffice) {
    classes.forEach((schoolClass, index) => {
      rosterByClass.set(entityId(schoolClass), rosterQueries[index]?.data ?? []);
    });
  }
  const loadingRosters = rosterQueries.some((q) => q.isLoading);
  const studentCandidates: Student[] = isOffice
    ? allStudents
    : [...rosterByClass.values()].flat();

  const classOf = (student: Student): string => {
    if (isOffice) return '';
    const id = refId(student.classId);
    const schoolClass = classes.find((c) => entityId(c) === id);
    return schoolClass ? classLabel(schoolClass) : '';
  };

  const findStudent = (id: string) =>
    isOffice ? allStudents.find((s) => entityId(s) === id) : studentCandidates.find((s) => entityId(s) === id);

  const toggleClass = (id: string) =>
    setClassIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );

  const call = useMutation({
    mutationFn: async () => {
      if (scope === 'class') {
        const result = await communicationApi.requestPtmForClasses({
          classIds,
          reason: reason.trim(),
          ...(isOffice && scheduledAt
            ? { scheduledAt: new Date(scheduledAt).toISOString() }
            : {}),
        });
        return `Meeting called for ${result.created} ${
          result.created === 1 ? 'child' : 'children'
        }${result.skipped ? ` · ${result.skipped} skipped (no parent linked)` : ''}.`;
      }

      const student = findStudent(studentId);
      const parentId = student ? refId(student.parentUserId) : '';
      await communicationApi.requestPtm({
        studentId,
        reason: reason.trim(),
        ...(parentId ? { parentId } : {}),
        // Free text, one slot per line — easier than a slot picker for what is
        // only ever an opening offer to the family.
        preferredSlots: slots
          .split('\n')
          .map((slot) => slot.trim())
          .filter(Boolean),
      });
      return 'Meeting called.';
    },
    onSuccess: (message) => {
      toast.success(message);
      void queryClient.invalidateQueries({ queryKey: ['ptm'] });
      reset();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not call that meeting.')),
  });

  function reset() {
    setScope('one');
    setStudentId('');
    setClassIds([]);
    setReason('');
    setScheduledAt('');
    setSlots('');
  }

  const canSave =
    reason.trim().length > 0 &&
    (scope === 'class'
      ? classIds.length > 0 && (isOffice ? !!scheduledAt : true)
      : !!studentId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Call a meeting"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => call.mutate()}
            loading={call.isPending}
            disabled={!canSave}
          >
            {scope === 'class' ? 'Call for classes' : 'Call meeting'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs
          value={scope}
          onChange={(value) => setScope(value as 'one' | 'class')}
          items={[
            { value: 'one', label: 'One child' },
            { value: 'class', label: 'Whole class' },
          ]}
        />

        {scope === 'one' && (
          <div className="space-y-3">
            <Select
              label="Child"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder={
                studentsQuery.isLoading || loadingRosters ? 'Loading…' : 'Choose a child'
              }
              required
              options={studentCandidates.map((s) => ({
                value: entityId(s),
                label: isOffice
                  ? studentName(s)
                  : `${studentName(s)}${classOf(s) ? ` · ${classOf(s)}` : ''}`,
              }))}
            />
            <Textarea
              label="What would you like to discuss?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
            />
            <Textarea
              label="Suggested times"
              value={slots}
              onChange={(e) => setSlots(e.target.value)}
              rows={3}
              hint="One per line, e.g. “Tue after 4pm”"
            />
          </div>
        )}

        {scope === 'class' && (
          <div className="space-y-3">
            {classesQuery.isLoading ? (
              <ListSkeleton rows={2} />
            ) : !classes.length ? (
              <EmptyState title="No classes available" />
            ) : (
              <>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {isOffice
                    ? 'Pick one or more classes — every child with a linked parent gets a meeting.'
                    : 'Pick from your own classes — the office will schedule the meeting.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {classes.map((schoolClass) => {
                    const id = entityId(schoolClass);
                    const active = classIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleClass(id)}
                        className={cn(
                          'rounded-full px-4 py-2 text-sm font-bold transition',
                          active
                            ? 'bg-accent text-white shadow-[0_6px_14px_rgb(0_0_0/0.12)]'
                            : 'bg-white text-[var(--color-text-muted)] hover:bg-accent-tint hover:text-accent',
                        )}
                      >
                        {classLabel(schoolClass)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {isOffice && (
              <Input
                label="Meeting time"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                hint="Whole-class meetings are created already scheduled."
              />
            )}

            <Textarea
              label="What would you like to discuss?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

function RespondPtm({ request, onClose }: { request: PtmRequest | null; onClose: () => void }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const respond = useMutation({
    mutationFn: (status: 'scheduled' | 'declined') =>
      communicationApi.respondToPtm(entityId(request!), {
        status,
        ...(status === 'scheduled' && scheduledAt
          ? { scheduledAt: new Date(scheduledAt).toISOString() }
          : {}),
        responseNote: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Response sent.');
      void queryClient.invalidateQueries({ queryKey: ['ptm'] });
      setScheduledAt('');
      setNote('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not send that response.')),
  });

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title="Respond to request"
      description={request?.reason}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => respond.mutate('declined')}
            loading={respond.isPending && respond.variables === 'declined'}
          >
            Decline
          </Button>
          <Button
            onClick={() => respond.mutate('scheduled')}
            loading={respond.isPending && respond.variables === 'scheduled'}
            disabled={!scheduledAt}
          >
            Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Meeting time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          hint="Required to schedule; not needed to decline"
        />
        <Textarea
          label="Note to the parent"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>
    </Modal>
  );
}
