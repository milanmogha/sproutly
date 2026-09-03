'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Building2,
  CircleCheck,
  CreditCard,
  KeyRound,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { schoolsApi, subscriptionsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  schoolAddress,
  schoolCity,
  schoolOwnerName,
  type SubscriptionInvoice,
  type SubscriptionPhase,
} from '@/lib/api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  ListSkeleton,
  PageHeader,
  SectionTitle,
  StatTile,
} from '@/components/ui/primitives';
import { DetailRow, TileGrid } from '@/components/ui/data-list';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input, Select, Switch } from '@/components/ui/form';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate, humanize } from '@/lib/utils';

type Tab = 'overview' | 'billing' | 'gateway';

const PHASE_TONE: Record<SubscriptionPhase, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> =
  {
    active: 'success',
    trial: 'info',
    grace: 'warning',
    expired: 'danger',
    suspended: 'danger',
    unbilled: 'neutral',
    none: 'neutral',
  };

export default function SuperAdminSchoolPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [raisingInvoice, setRaisingInvoice] = useState(false);
  const [recording, setRecording] = useState<SubscriptionInvoice | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const school = useQuery({
    queryKey: ['schools', id],
    queryFn: () => schoolsApi.get(id),
    enabled: !!id,
  });

  const overview = useQuery({
    queryKey: ['schools', id, 'overview'],
    queryFn: () => schoolsApi.overview(id),
    enabled: !!id && tab === 'overview',
  });

  const subscription = useQuery({
    queryKey: ['subscriptions', 'school', id],
    queryFn: () => subscriptionsApi.forSchool(id),
    enabled: !!id,
  });

  const invoices = useQuery({
    queryKey: ['subscriptions', 'school', id, 'invoices'],
    queryFn: () => subscriptionsApi.schoolInvoices(id),
    enabled: !!id && tab === 'billing',
  });

  const invalidateSchool = () => {
    void queryClient.invalidateQueries({ queryKey: ['schools'] });
    void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  };

  const suspend = useMutation({
    mutationFn: () => schoolsApi.suspend(id),
    onSuccess: () => {
      toast.success('School suspended.');
      invalidateSchool();
      setSuspending(false);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not suspend that school.')),
  });

  const reactivate = useMutation({
    mutationFn: () => schoolsApi.reactivate(id),
    onSuccess: () => {
      toast.success('School reactivated.');
      invalidateSchool();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not reactivate that school.')),
  });

  const removeInvoice = useMutation({
    mutationFn: (invoiceId: string) => subscriptionsApi.removeInvoice(invoiceId),
    onSuccess: () => {
      toast.success('Invoice removed.');
      invalidateSchool();
      void invoices.refetch();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that invoice.')),
  });

  if (school.isLoading) return <ListSkeleton rows={4} />;
  if (school.error) {
    return <ErrorState message={errorMessage(school.error)} onRetry={() => school.refetch()} />;
  }
  if (!school.data) return null;

  const suspended = school.data.status === 'suspended';

  return (
    <div className="space-y-5">
      <PageHeader
        title={school.data.name}
        subtitle={`${school.data.code} · ${schoolCity(school.data)}`}
        actions={
          <>
            {suspended ? (
              <Button
                icon={<CircleCheck className="size-4" />}
                onClick={() => reactivate.mutate()}
                loading={reactivate.isPending}
              >
                Reactivate
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon={<Ban className="size-4" />}
                onClick={() => setSuspending(true)}
              >
                Suspend
              </Button>
            )}
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => setDeleting(true)}
            >
              Delete
            </Button>
          </>
        }
      />

      {suspended && (
        <Card className="border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/5">
          <p className="text-sm font-semibold text-[var(--color-danger)]">
            This school is suspended — nobody at it can sign in.
          </p>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'billing', label: 'Billing' },
          { value: 'gateway', label: 'Payment gateway' },
        ]}
      />

      {tab === 'overview' && (
        <>
          <TileGrid>
            <StatTile
              label="Students"
              value={overview.data?.students ?? '—'}
              icon={<Users className="size-5" />}
              color="var(--color-super)"
            />
            <StatTile
              label="Teachers"
              value={overview.data?.usersByRole?.teacher ?? 0}
              color="var(--color-teal)"
            />
            <StatTile
              label="Parents"
              value={overview.data?.usersByRole?.parent ?? 0}
              color="var(--color-blue)"
            />
            <StatTile
              label="Subscription"
              value={humanize(subscription.data?.phase ?? 'none')}
              hint={
                subscription.data?.periodEnd
                  ? `Ends ${formatDate(subscription.data.periodEnd)}`
                  : undefined
              }
              color={
                subscription.data?.phase === 'active'
                  ? 'var(--color-success)'
                  : 'var(--color-sunny)'
              }
            />
          </TileGrid>

          <Card className="max-w-2xl">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-tint text-accent">
                <Building2 className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{school.data.name}</p>
                <Badge tone={suspended ? 'danger' : 'success'}>
                  {humanize(school.data.status)}
                </Badge>
              </div>
            </div>
            <dl>
              <DetailRow label="Code" value={school.data.code} />
              <DetailRow label="Owner" value={schoolOwnerName(school.data)} />
              <DetailRow label="Address" value={schoolAddress(school.data)} />
              <DetailRow label="Contact email" value={school.data.contactEmail ?? '—'} />
              <DetailRow label="Contact phone" value={school.data.contactPhone ?? '—'} />
              <DetailRow label="Added" value={formatDate(school.data.createdAt)} />
            </dl>
          </Card>
        </>
      )}

      {tab === 'billing' && (
        <>
          <div className="flex justify-end">
            <Button icon={<Plus className="size-4" />} onClick={() => setRaisingInvoice(true)}>
              Raise invoice
            </Button>
          </div>

          <Card className="max-w-2xl">
            <SectionTitle title="Current period" />
            <dl>
              <DetailRow
                label="Phase"
                value={
                  <Badge tone={PHASE_TONE[subscription.data?.phase ?? 'none']}>
                    {humanize(subscription.data?.phase ?? 'none')}
                  </Badge>
                }
              />
              <DetailRow label="Ends" value={formatDate(subscription.data?.periodEnd)} />
              <DetailRow
                label="Days remaining"
                // `?? ` not `!== undefined`: an unbilled school sends null,
                // which would otherwise print the word "null".
                value={subscription.data?.daysRemaining ?? '—'}
              />
            </dl>
          </Card>

          {invoices.isLoading ? (
            <ListSkeleton />
          ) : !invoices.data?.length ? (
            <EmptyState
              icon={<CreditCard className="size-6" />}
              title="No invoices raised"
              action={
                <Button variant="secondary" onClick={() => setRaisingInvoice(true)}>
                  Raise invoice
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {invoices.data.map((invoice) => (
                <Card key={entityId(invoice)} className="flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-bold">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {invoice.durationLabel ?? `${invoice.durationDays ?? 0} days`}
                        {invoice.periodStart
                          ? ` · ${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge
                        tone={
                          invoice.status === 'paid'
                            ? 'success'
                            : invoice.status === 'overdue'
                              ? 'danger'
                              : invoice.status === 'cancelled'
                                ? 'neutral'
                                : 'warning'
                        }
                      >
                        {humanize(invoice.status)}
                      </Badge>
                      {invoice.status !== 'paid' && (
                        <IconButton
                          label="Delete invoice"
                          onClick={() => removeInvoice.mutate(entityId(invoice))}
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 font-display text-xl font-bold">
                    {formatCurrency(invoice.amount)}
                  </p>
                  {invoice.paidAt && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Paid {formatDate(invoice.paidAt)}
                      {invoice.method ? ` · ${humanize(invoice.method)}` : ''}
                    </p>
                  )}

                  {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                    <div className="mt-auto pt-3">
                      <Button size="sm" variant="secondary" onClick={() => setRecording(invoice)}>
                        Record payment
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'gateway' && <PaymentGateway schoolId={id} />}
      <RaiseInvoice
        schoolId={id}
        open={raisingInvoice}
        onClose={() => setRaisingInvoice(false)}
      />
      <RecordSubscriptionPayment invoice={recording} onClose={() => setRecording(null)} />

      <ConfirmDialog
        open={suspending}
        onClose={() => setSuspending(false)}
        onConfirm={() => suspend.mutate()}
        title="Suspend this school?"
        message="Everyone at the school — admins, teachers and parents — will be locked out until it is reactivated."
        confirmLabel="Suspend"
        destructive
        loading={suspend.isPending}
      />

      <DeleteSchoolDialog
        open={deleting}
        schoolId={id}
        name={school.data.name}
        code={school.data.code}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          invalidateSchool();
          router.replace('/super-admin/schools');
        }}
      />
    </div>
  );
}

/**
 * Deleting a school, in two deliberate steps.
 *
 * Step one states what is lost; step two asks for the school's code to be
 * typed out. The second step is the point: a misplaced click cannot get past
 * it, and typing the code forces the operator to confirm *which* school they
 * are on. This is a permanent, cascading delete — the school and every record
 * belonging to it are erased, with no undo anywhere — so the wording is blunt
 * about it rather than softened.
 */
function DeleteSchoolDialog({
  open,
  schoolId,
  name,
  code,
  onClose,
  onDeleted,
}: {
  open: boolean;
  schoolId: string;
  name: string;
  code: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const toast = useToast();

  // Always reopen on the first step, never mid-way through a previous attempt.
  useEffect(() => {
    if (open) {
      setStage(1);
      setTyped('');
    }
  }, [open]);

  const remove = useMutation({
    mutationFn: () => schoolsApi.remove(schoolId),
    onSuccess: () => {
      toast.success(`${name} and all its records were permanently deleted.`);
      onClose();
      onDeleted();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete that school.')),
  });

  const matches = typed.trim().toUpperCase() === code.toUpperCase();

  if (stage === 1) {
    return (
      <ConfirmDialog
        open={open}
        onClose={onClose}
        onConfirm={() => setStage(2)}
        title={`Delete ${name}?`}
        message={
          'This permanently erases the school and everything belonging to it — every student, ' +
          'parent, teacher and admin account, and all attendance, fees, invoices, messages and ' +
          'photos. It cannot be undone and there is no backup to restore from.'
        }
        confirmLabel="Continue"
        destructive
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Type the school code to confirm"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => remove.mutate()}
            loading={remove.isPending}
            disabled={!matches}
          >
            Delete this school
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
          This is the last step, and it cannot be undone. Type{' '}
          <span className="font-bold text-[var(--color-text)]">{code}</span> below to permanently
          delete <span className="font-bold text-[var(--color-text)]">{name}</span> and all of its
          records.
        </p>
        <Input
          label="School code"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={code}
          autoFocus
          aria-label={`Type ${code} to confirm deletion`}
        />
        {!!typed && !matches && (
          <p className="text-xs font-semibold text-[var(--color-danger)]">
            That does not match the school code.
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * The school's own Razorpay keys.
 *
 * Secrets are write-only: the API tells us whether one is stored but never
 * gives it back, so a blank field means "leave the stored one alone".
 */
function PaymentGateway({ schoolId }: { schoolId: string }) {
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [clearing, setClearing] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const gateway = useQuery({
    queryKey: ['schools', schoolId, 'payment-gateway'],
    queryFn: () => schoolsApi.paymentGateway(schoolId),
  });

  useEffect(() => {
    if (!gateway.data) return;
    setKeyId(gateway.data.keyId ?? '');
    setEnabled(gateway.data.enabled ?? true);
  }, [gateway.data]);

  const save = useMutation({
    mutationFn: () =>
      schoolsApi.savePaymentGateway(schoolId, {
        keyId: keyId.trim(),
        // Omit blank secrets so the stored ones survive an edit.
        ...(keySecret.trim() ? { keySecret: keySecret.trim() } : {}),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        enabled,
      }),
    onSuccess: () => {
      toast.success('Payment gateway saved.');
      setKeySecret('');
      setWebhookSecret('');
      void queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'payment-gateway'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save those keys.')),
  });

  const clear = useMutation({
    mutationFn: () => schoolsApi.removePaymentGateway(schoolId),
    onSuccess: () => {
      toast.success('Payment gateway cleared.');
      setKeyId('');
      setKeySecret('');
      setWebhookSecret('');
      setClearing(false);
      void queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'payment-gateway'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not clear those keys.')),
  });

  const validKeyId = /^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId.trim());

  return (
    <>
      <Card className="max-w-2xl">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-accent-tint text-accent">
            <KeyRound className="size-5" />
          </span>
          <div>
            <p className="font-display text-lg font-bold">Razorpay keys</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Fees are paid into the school&apos;s own account.
            </p>
          </div>
        </div>

        {gateway.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (
          <div className="space-y-3">
            <Input
              label="Key ID"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="rzp_live_xxxxxxxx"
              error={keyId && !validKeyId ? 'Must look like rzp_test_… or rzp_live_…' : null}
            />
            <Input
              label="Key secret"
              type="password"
              value={keySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              placeholder={gateway.data?.hasKeySecret ? '•••••••• (stored)' : 'Not set'}
              hint="Leave blank to keep the stored secret"
            />
            <Input
              label="Webhook secret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={gateway.data?.hasWebhookSecret ? '•••••••• (stored)' : 'Not set'}
              hint="Leave blank to keep the stored secret"
            />
            <Switch
              label="Accept online payments"
              description="Off means parents pay at school instead"
              checked={enabled}
              onCheckedChange={setEnabled}
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                onClick={() => save.mutate()}
                loading={save.isPending}
                disabled={!validKeyId}
              >
                Save keys
              </Button>
              {gateway.data?.keyId && (
                <Button variant="secondary" onClick={() => setClearing(true)}>
                  Clear
                </Button>
              )}
            </div>

            {gateway.data?.updatedAt && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Last updated {formatDate(gateway.data.updatedAt)}
              </p>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={() => clear.mutate()}
        title="Clear the payment gateway?"
        message="Online fee payments will stop working for this school until new keys are entered."
        confirmLabel="Clear"
        destructive
        loading={clear.isPending}
      />
    </>
  );
}

function RaiseInvoice({
  schoolId,
  open,
  onClose,
}: {
  schoolId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState('365');
  const [notes, setNotes] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const raise = useMutation({
    mutationFn: () =>
      subscriptionsApi.raiseInvoice(schoolId, {
        amount: Number(amount),
        durationDays: Number(durationDays),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Invoice raised.');
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setAmount('');
      setNotes('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not raise that invoice.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Raise a subscription invoice"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => raise.mutate()}
            loading={raise.isPending}
            disabled={!amount || Number(amount) <= 0}
          >
            Raise
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Amount"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select
          label="Covers"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          options={[
            { value: '30', label: '1 month' },
            { value: '90', label: '3 months' },
            { value: '180', label: '6 months' },
            { value: '365', label: '1 year' },
          ]}
        />
        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  );
}

/** Books a subscription payment made outside Razorpay — a transfer, say. */
function RecordSubscriptionPayment({
  invoice,
  onClose,
}: {
  invoice: SubscriptionInvoice | null;
  onClose: () => void;
}) {
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const record = useMutation({
    mutationFn: () =>
      subscriptionsApi.recordPayment(entityId(invoice!), {
        method,
        reference: reference.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Payment recorded.');
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setReference('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not record that payment.')),
  });

  return (
    <Modal
      open={!!invoice}
      onClose={onClose}
      title="Record payment"
      description={
        invoice ? `${invoice.invoiceNumber} · ${formatCurrency(invoice.amount)}` : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => record.mutate()} loading={record.isPending}>
            Record
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label="Method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: 'bank_transfer', label: 'Bank transfer' },
            { value: 'cheque', label: 'Cheque' },
            { value: 'cash', label: 'Cash' },
            { value: 'upi', label: 'UPI' },
          ]}
        />
        <Input
          label="Reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Transaction or cheque number"
        />
      </div>
    </Modal>
  );
}
