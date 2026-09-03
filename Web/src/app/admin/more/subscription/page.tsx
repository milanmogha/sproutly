'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CreditCard, Receipt, ShieldCheck } from 'lucide-react';
import { subscriptionsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  type SubscriptionInvoice,
  type SubscriptionPhase,
} from '@/lib/api/types';
import { openCheckout } from '@/lib/payments/razorpay';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  SectionTitle,
} from '@/components/ui/primitives';
import { DetailRow } from '@/components/ui/data-list';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate, humanize } from '@/lib/utils';

const PHASE_TONE: Record<SubscriptionPhase, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> =
  {
    active: 'success',
    trial: 'info',
    grace: 'warning',
    expired: 'danger',
    suspended: 'danger',
    unbilled: 'neutral',
    none: 'neutral',
  };

/** What this school owes Sproutly, and how to settle it. */
export default function AdminSubscriptionPage() {
  const { session } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const subscription = useQuery({
    queryKey: ['subscription', 'mine'],
    queryFn: subscriptionsApi.mine,
  });

  const invoices = useQuery({
    queryKey: ['subscription', 'mine', 'invoices'],
    queryFn: subscriptionsApi.myInvoices,
  });

  /**
   * Pays a platform invoice through Sproutly's own Razorpay account.
   *
   * A checkout that comes back `settled` was already paid (recorded manually,
   * say), so there is no order to open.
   */
  const pay = useMutation({
    mutationFn: async (invoice: SubscriptionInvoice) => {
      const checkout = await subscriptionsApi.checkout(entityId(invoice));
      if (checkout.settled || !checkout.order) return 'paid' as const;
      return openCheckout({
        order: checkout.order,
        name: 'Sproutly',
        description: `Subscription ${invoice.invoiceNumber}`,
        prefillEmail: session?.email || undefined,
        verify: (payload) => subscriptionsApi.verifyPayment(payload),
      });
    },
    onSuccess: (outcome) => {
      if (outcome === 'paid') toast.success('Subscription renewed. Thank you!');
      else if (outcome === 'failed') toast.error('That payment did not go through.');
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not start the payment.')),
  });

  const state = subscription.data;
  const outstanding = (invoices.data ?? []).filter((invoice) => invoice.status !== 'paid');

  return (
    <div className="space-y-5">
      <PageHeader title="Subscription" subtitle="Your school's Sproutly plan" />

      {subscription.isLoading ? (
        <ListSkeleton rows={2} />
      ) : subscription.error ? (
        <ErrorState
          message={errorMessage(subscription.error)}
          onRetry={() => subscription.refetch()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-tint text-accent">
                <ShieldCheck className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">
                  {humanize(state?.phase ?? 'none')}
                </p>
                <Badge tone={PHASE_TONE[state?.phase ?? 'none']}>
                  {state?.adminReadOnly ? 'Read-only' : 'Active access'}
                </Badge>
              </div>
            </div>
            <dl>
              <DetailRow label="Renews / ends" value={formatDate(state?.periodEnd)} />
              <DetailRow
                label="Days remaining"
                value={state?.daysRemaining ?? '—'}
              />
              <DetailRow
                label="Online payment"
                value={state?.gatewayAvailable ? 'Available' : 'Contact Sproutly'}
              />
            </dl>
          </Card>

          {state?.outstanding ? (
            <Card className="flex flex-col">
              <SectionTitle title="Amount due" />
              <p className="font-display text-3xl font-bold">
                {formatCurrency(state.outstanding.amount)}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {state.outstanding.invoiceNumber}
                {state.outstanding.durationLabel ? ` · ${state.outstanding.durationLabel}` : ''}
              </p>
              <div className="mt-auto pt-4">
                <Button
                  icon={<CreditCard className="size-4" />}
                  onClick={() => pay.mutate(state.outstanding!)}
                  loading={pay.isPending}
                  disabled={!state.gatewayAvailable}
                  block
                >
                  Pay {formatCurrency(state.outstanding.amount)}
                </Button>
                {!state.gatewayAvailable && (
                  <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
                    Online payment isn&apos;t enabled — contact Sproutly to settle this.
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <Card className="grid place-items-center">
              <div className="py-6 text-center">
                <CalendarClock className="mx-auto mb-2 size-10 text-[var(--color-success)]" />
                <p className="font-display text-lg font-bold">Nothing outstanding</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Your subscription is settled.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      <section>
        <SectionTitle title="Invoices" />
        {invoices.isLoading ? (
          <ListSkeleton />
        ) : !invoices.data?.length ? (
          <EmptyState icon={<Receipt className="size-6" />} title="No invoices yet" />
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

                {outstanding.some((row) => entityId(row) === entityId(invoice)) && (
                  <div className="mt-auto pt-3">
                    <Button
                      size="sm"
                      icon={<CreditCard className="size-4" />}
                      onClick={() => pay.mutate(invoice)}
                      loading={pay.isPending}
                      disabled={!subscription.data?.gatewayAvailable}
                    >
                      Pay now
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
