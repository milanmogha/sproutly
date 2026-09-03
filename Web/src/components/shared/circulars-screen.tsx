'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pin, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { communicationApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, type Alert, type Circular } from '@/lib/api/types';
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
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateTime, humanize } from '@/lib/utils';

/**
 * School circulars — and, for the office, emergency alerts. Everyone reads
 * them; staff with `canManage` can also post and remove them, which is the
 * only difference between the portals. `allowAlerts` additionally unlocks the
 * alert composer, which only the office may use (the backend returns a 403 for
 * a teacher).
 */
export function CircularsScreen({
  canManage = false,
  allowAlerts = false,
}: {
  canManage?: boolean;
  /** Office-only: compose and review emergency alerts too. */
  allowAlerts?: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [composeKind, setComposeKind] = useState<'circular' | 'alert'>('circular');
  const [deleting, setDeleting] = useState<Circular | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const circulars = useQuery({
    queryKey: ['circulars'],
    queryFn: () => communicationApi.circulars(),
  });

  const alerts = useQuery({
    queryKey: ['alerts'],
    queryFn: () => communicationApi.alerts(),
    enabled: allowAlerts,
  });

  const remove = useMutation({
    mutationFn: (id: string) => communicationApi.removeCircular(id),
    onSuccess: () => {
      toast.success('Circular removed.');
      void queryClient.invalidateQueries({ queryKey: ['circulars'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that circular.')),
  });

  // Pinned circulars float to the top, then newest first.
  const sorted = [...(circulars.data ?? [])].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (
      new Date(b.publishedAt ?? b.createdAt ?? 0).getTime() -
      new Date(a.publishedAt ?? a.createdAt ?? 0).getTime()
    );
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notices"
        subtitle="Circulars and alerts from the school"
        actions={
          canManage && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => {
                setComposeKind('circular');
                setComposing(true);
              }}
            >
              New circular
            </Button>
          )
        }
      />

      {circulars.isLoading ? (
        <ListSkeleton />
      ) : circulars.error ? (
        <ErrorState message={errorMessage(circulars.error)} onRetry={() => circulars.refetch()} />
      ) : !sorted.length ? (
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="No circulars"
          message="Notices posted by the school will show up here."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sorted.map((circular) => (
            <Card key={entityId(circular)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {circular.pinned && <Pin className="size-4 shrink-0 text-accent" />}
                    <p className="truncate font-display text-lg font-bold">{circular.title}</p>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatDate(circular.publishedAt ?? circular.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge tone="accent">{humanize(circular.audience)}</Badge>
                  {canManage && (
                    <IconButton label="Delete circular" onClick={() => setDeleting(circular)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-text-muted)]">
                {circular.body}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Alerts the office has broadcast — parents see these on their home. */}
      {allowAlerts && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
              Emergency alerts
            </h2>
            <Button
              size="sm"
              variant="secondary"
              icon={<TriangleAlert className="size-4" />}
              onClick={() => {
                setComposeKind('alert');
                setComposing(true);
              }}
            >
              New alert
            </Button>
          </div>
          {alerts.isLoading ? (
            <ListSkeleton rows={1} />
          ) : !alerts.data?.length ? (
            <p className="rounded-[var(--radius-input)] bg-white p-4 text-sm text-[var(--color-text-muted)] shadow-[var(--shadow-card)]">
              No emergency alerts sent yet.
            </p>
          ) : (
            <div className="space-y-2">
              {alerts.data.map((alert) => (
                <AlertRow key={entityId(alert)} alert={alert} />
              ))}
            </div>
          )}
        </section>
      )}

      {canManage && (
        <ComposeNotice
          open={composing}
          initialKind={composeKind}
          allowAlerts={allowAlerts}
          onClose={() => setComposing(false)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Delete this circular?"
        message={`"${deleting?.title}" will be removed for everyone. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

const ALERT_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
};

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <Card
      className={
        alert.severity === 'critical'
          ? 'border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/5'
          : ''
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <TriangleAlert
            className={
              alert.severity === 'critical'
                ? 'mt-0.5 size-5 shrink-0 text-[var(--color-danger)]'
                : 'mt-0.5 size-5 shrink-0 text-[var(--color-warning)]'
            }
          />
          <div className="min-w-0">
            <p className="truncate font-display font-bold">{alert.title}</p>
            <p className="text-sm whitespace-pre-wrap text-[var(--color-text-muted)]">
              {alert.message}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={ALERT_TONE[alert.severity ?? ''] ?? 'warning'}>
            {humanize(alert.severity)}
          </Badge>
          <Badge tone="accent">{humanize(alert.audience)}</Badge>
        </div>
      </div>
      {alert.sentAt && (
        <p className="mt-2 text-[10px] font-bold text-[var(--color-text-muted)]">
          {formatDateTime(alert.sentAt)}
        </p>
      )}
    </Card>
  );
}

/**
 * One composer, two kinds. A circular is a routine notice with a pin option;
 * an alert is an urgent, severity-tagged message parents see as a banner on
 * their home screen.
 */
function ComposeNotice({
  open,
  initialKind,
  allowAlerts,
  onClose,
}: {
  open: boolean;
  initialKind: 'circular' | 'alert';
  allowAlerts: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<'circular' | 'alert'>('circular');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [pinned, setPinned] = useState(false);
  const [severity, setSeverity] = useState('warning');
  const toast = useToast();
  const queryClient = useQueryClient();

  // Each time the modal opens, adopt the kind the header button asked for and
  // clear any residue from a previous compose.
  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setTitle('');
    setBody('');
    setAudience('all');
    setPinned(false);
    setSeverity('warning');
  }, [open, initialKind]);

  const isAlert = kind === 'alert';

  // The two kinds post to two different endpoints returning two different
  // shapes; nothing reads the result, so widen it rather than union it.
  const create = useMutation({
    mutationFn: (): Promise<unknown> => {
      if (isAlert) {
        return communicationApi.createAlert({
          title: title.trim(),
          message: body.trim(),
          severity,
          audience,
        });
      }
      return communicationApi.createCircular({
        title: title.trim(),
        body: body.trim(),
        audience,
        pinned,
      });
    },
    onSuccess: () => {
      toast.success(isAlert ? 'Alert sent.' : 'Circular posted.');
      void queryClient.invalidateQueries({
        queryKey: isAlert ? ['alerts'] : ['circulars'],
      });
      setTitle('');
      setBody('');
      setPinned(false);
      onClose();
    },
    onError: (error) =>
      toast.error(errorMessage(error, isAlert ? 'Could not send that alert.' : 'Could not post that circular.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAlert ? 'New emergency alert' : 'New circular'}
      description={
        isAlert
          ? 'Shown to parents as an urgent banner. Use for genuine emergencies only.'
          : 'Posted to everyone in the audience you pick.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!title.trim() || !body.trim()}
          >
            {isAlert ? 'Send alert' : 'Post'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {allowAlerts && (
          <div className="flex gap-1 rounded-full bg-[var(--color-canvas)] p-1">
            {(
              [
                { value: 'circular', label: 'Circular' },
                { value: 'alert', label: 'Emergency alert' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition ${
                  kind === option.value
                    ? 'bg-white text-accent shadow-[var(--shadow-card)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isAlert ? 'School closed tomorrow' : 'Annual day rehearsal'}
          required
        />
        {isAlert ? (
          <Select
            label="Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
        ) : null}
        <Select
          label="Audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'parents', label: 'Parents' },
            { value: 'teachers', label: 'Teachers' },
            { value: 'staff', label: 'Staff' },
          ]}
        />
        <Textarea
          label={isAlert ? 'Message' : 'Message'}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder={
            isAlert ? 'What do parents need to know, right now?' : 'What do people need to know?'
          }
          required
        />
        {!isAlert && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Pin to the top
          </label>
        )}
      </div>
    </Modal>
  );
}
