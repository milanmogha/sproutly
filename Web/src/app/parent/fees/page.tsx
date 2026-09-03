'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, IndianRupee, Receipt } from 'lucide-react';
import { useState } from 'react';
import { feesApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { downloadFile } from '@/lib/api/download';
import { entityId, invoiceBalance, type Invoice } from '@/lib/api/types';
import { openCheckout } from '@/lib/payments/razorpay';
import { useAuth } from '@/lib/auth/auth-context';
import { useSchoolOnlinePayments } from '@/lib/api/school';
import { useChild } from '@/lib/parent/child-context';
import { ChildSwitcher } from '@/components/parent/child-switcher';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  StatTile,
} from '@/components/ui/primitives';
import { DetailRow, TileGrid } from '@/components/ui/data-list';
import { Segmented } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate, humanize } from '@/lib/utils';

const STATUS_TONE = {
  paid: 'success',
  pending: 'warning',
  partial: 'info',
  overdue: 'danger',
  scheduled: 'neutral',
} as const;

export default function ParentFeesPage() {
  const { selected } = useChild();
  const { session } = useAuth();
  const studentId = selected ? entityId(selected) : '';
  const [filter, setFilter] = useState<'due' | 'all'>('due');
  const [payingId, setPayingId] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const invoices = useQuery({
    queryKey: ['parent', 'invoices', studentId],
    queryFn: () => feesApi.studentInvoices(studentId),
    enabled: !!studentId,
  });

  const onlinePayments = useSchoolOnlinePayments();

  const all = invoices.data ?? [];
  const unpaid = all.filter((i) => i.status !== 'paid' && invoiceBalance(i) > 0);
  const shown = filter === 'due' ? unpaid : all;

  const totalDue = unpaid.reduce((sum, i) => sum + invoiceBalance(i), 0);
  const totalPaid = all.reduce((sum, i) => sum + (i.amountPaid ?? 0), 0);

  /**
   * Opens the school's Razorpay checkout for one invoice. The list is
   * refetched whichever way it ends, so a settled payment shows immediately
   * and an abandoned one leaves the invoice as it was.
   */
  const pay = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const order = await feesApi.checkout(entityId(invoice));
      return openCheckout({
        order,
        name: 'Sproutly',
        description: `Invoice ${invoice.invoiceNumber}`,
        prefillEmail: session?.email || undefined,
        verify: (payload) => feesApi.verifyPayment(payload),
      });
    },
    onSuccess: (outcome) => {
      if (outcome === 'paid') toast.success('Payment received. Thank you!');
      else if (outcome === 'failed') toast.error('That payment did not go through.');
      void queryClient.invalidateQueries({ queryKey: ['parent', 'invoices'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not start the payment.')),
    onSettled: () => setPayingId(null),
  });

  async function downloadReceipt(invoice: Invoice) {
    try {
      await downloadFile(
        feesApi.receiptUrl(entityId(invoice)),
        `receipt-${invoice.invoiceNumber}.pdf`,
      );
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download that receipt.'));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Fees" subtitle={selected ? `${selected.firstName}'s invoices` : undefined} />
      <ChildSwitcher />

      <TileGrid className="sm:grid-cols-2 xl:grid-cols-2">
        <StatTile
          label="Outstanding"
          value={formatCurrency(totalDue)}
          hint={`${unpaid.length} unpaid`}
          icon={<IndianRupee className="size-5" />}
          color="var(--color-coral)"
        />
        <StatTile
          label="Paid to date"
          value={formatCurrency(totalPaid)}
          icon={<Receipt className="size-5" />}
          color="var(--color-success)"
        />
      </TileGrid>

      <Segmented
        value={filter}
        onChange={(value) => setFilter(value as 'due' | 'all')}
        items={[
          { value: 'due', label: `Due (${unpaid.length})` },
          { value: 'all', label: `All (${all.length})` },
        ]}
      />

      {invoices.isLoading ? (
        <ListSkeleton />
      ) : invoices.error ? (
        <ErrorState message={errorMessage(invoices.error)} onRetry={() => invoices.refetch()} />
      ) : !shown.length ? (
        <EmptyState
          icon={<Receipt className="size-6" />}
          title={filter === 'due' ? 'Nothing due' : 'No invoices yet'}
          message={
            filter === 'due'
              ? "You're all paid up. Nice."
              : 'Invoices raised by the school will appear here.'
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((invoice) => {
            const balance = invoiceBalance(invoice);
            const id = entityId(invoice);
            return (
              <Card key={id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold">
                      {invoice.period || invoice.invoiceNumber}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {invoice.invoiceNumber}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[invoice.status] ?? 'neutral'}>
                    {humanize(invoice.status)}
                  </Badge>
                </div>

                <dl className="my-3">
                  <DetailRow label="Amount" value={formatCurrency(invoice.totalAmount)} />
                  {(invoice.amountPaid ?? 0) > 0 && (
                    <DetailRow label="Paid" value={formatCurrency(invoice.amountPaid)} />
                  )}
                  {balance > 0 && (
                    <DetailRow
                      label="Balance"
                      value={
                        <span className="text-[var(--color-coral)]">
                          {formatCurrency(balance)}
                        </span>
                      }
                    />
                  )}
                  {invoice.dueDate && (
                    <DetailRow label="Due" value={formatDate(invoice.dueDate)} />
                  )}
                </dl>

                {!!invoice.lineItems?.length && (
                  <ul className="mb-3 space-y-1 rounded-[var(--radius-input)] bg-[var(--color-canvas)] p-3">
                    {invoice.lineItems.map((line, index) => (
                      <li key={index} className="flex justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-[var(--color-text-muted)]">
                          {line.name}
                        </span>
                        <span className="shrink-0 font-bold">{formatCurrency(line.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto flex flex-wrap gap-2">
                  {balance > 0 &&
                    (onlinePayments.enabled ? (
                      <Button
                        onClick={() => {
                          setPayingId(id);
                          pay.mutate(invoice);
                        }}
                        loading={payingId === id && pay.isPending}
                        icon={<IndianRupee className="size-4" />}
                      >
                        Pay {formatCurrency(balance)}
                      </Button>
                    ) : (
                      <p className="rounded-[var(--radius-input)] bg-[var(--color-canvas)] px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)]">
                        Please pay at the school office — the receipt appears here
                        once it&apos;s recorded.
                      </p>
                    ))}
                  {(invoice.amountPaid ?? 0) > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => void downloadReceipt(invoice)}
                      icon={<Download className="size-4" />}
                    >
                      Receipt
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
