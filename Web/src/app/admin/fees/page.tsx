'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileText,
  IndianRupee,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { classesApi, feesApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { downloadFile } from '@/lib/api/download';
import {
  className as classLabel,
  entityId,
  invoiceBalance,
  invoiceStudentName,
  refId,
  type FeeStructure,
  type Invoice,
  type Paginated,
} from '@/lib/api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  StatTile,
} from '@/components/ui/primitives';
import { DataList, TileGrid, type Column } from '@/components/ui/data-list';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input, Select } from '@/components/ui/form';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import {
  academicYear,
  academicYearOptions,
  count,
  formatCurrency,
  formatDate,
  humanize,
} from '@/lib/utils';

type Tab = 'invoices' | 'dues' | 'structures';

const STATUS_TONE = {
  paid: 'success',
  pending: 'warning',
  partial: 'info',
  overdue: 'danger',
  scheduled: 'neutral',
} as const;

/** Fee structures, the invoices raised from them, and what's still owed. */
export default function AdminFeesPage() {
  const [tab, setTab] = useState<Tab>('invoices');
  const [status, setStatus] = useState('');
  const [creatingStructure, setCreatingStructure] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [collecting, setCollecting] = useState<Invoice | null>(null);
  const [deletingStructure, setDeletingStructure] = useState<FeeStructure | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const invoices = useQuery({
    queryKey: ['fees', 'invoices', status],
    queryFn: () => feesApi.invoices({ status: status || undefined, limit: 100 }),
    enabled: tab === 'invoices',
  });

  const dues = useQuery({
    queryKey: ['fees', 'dues'],
    queryFn: () => feesApi.dues(),
    enabled: tab === 'dues',
  });

  const structures = useQuery({
    queryKey: ['fees', 'structures'],
    queryFn: () => feesApi.structures(),
    enabled: tab === 'structures',
  });

  const collection = useQuery({
    queryKey: ['fees', 'collection'],
    queryFn: () => feesApi.collectionReport(),
  });

  const outstanding = useQuery({
    queryKey: ['fees', 'outstanding'],
    queryFn: feesApi.outstandingReport,
  });

  const removeStructure = useMutation({
    mutationFn: (id: string) => feesApi.removeStructure(id),
    onSuccess: () => {
      toast.success('Structure removed.');
      void queryClient.invalidateQueries({ queryKey: ['fees'] });
      setDeletingStructure(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that structure.')),
  });

  const invoicePayload = invoices.data;
  const invoiceRows = Array.isArray(invoicePayload)
    ? invoicePayload
    : ((invoicePayload as Paginated<Invoice>)?.data ?? []);

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

  const nameOf = invoiceStudentName;

  const invoiceColumns: Array<Column<Invoice>> = [
    {
      key: 'number',
      header: 'Invoice',
      hideOnCard: true,
      render: (invoice) => (
        <div className="min-w-0">
          <p className="truncate font-bold">{invoice.invoiceNumber}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{invoice.period ?? '—'}</p>
        </div>
      ),
    },
    // Already the card subtitle on mobile.
    { key: 'student', header: 'Student', hideOnCard: true, render: nameOf },
    {
      key: 'class',
      header: 'Class',
      secondary: true,
      render: (invoice) => classLabel(invoice.classId),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (invoice) => formatCurrency(invoice.totalAmount),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (invoice) => {
        const balance = invoiceBalance(invoice);
        return balance > 0 ? (
          <span className="font-bold text-[var(--color-coral)]">{formatCurrency(balance)}</span>
        ) : (
          '—'
        );
      },
    },
    { key: 'due', header: 'Due', secondary: true, render: (invoice) => formatDate(invoice.dueDate) },
    {
      key: 'status',
      header: 'Status',
      render: (invoice) => (
        <Badge tone={STATUS_TONE[invoice.status] ?? 'neutral'}>{humanize(invoice.status)}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fees"
        subtitle="Structures, invoices and collection"
        actions={
          tab === 'structures' ? (
            <Button icon={<Plus className="size-4" />} onClick={() => setCreatingStructure(true)}>
              New structure
            </Button>
          ) : (
            <Button icon={<Zap className="size-4" />} onClick={() => setGenerating(true)}>
              Generate invoices
            </Button>
          )
        }
      />

      <TileGrid className="sm:grid-cols-2 xl:grid-cols-2">
        <StatTile
          label="Collected"
          value={formatCurrency(collection.data?.totalCollected ?? 0)}
          hint={count(collection.data?.paymentCount ?? 0, 'payment')}
          icon={<TrendingUp className="size-5" />}
          color="var(--color-success)"
        />
        <StatTile
          label="Outstanding"
          value={formatCurrency(outstanding.data?.totalOutstanding ?? 0)}
          hint={count(outstanding.data?.outstandingInvoices ?? 0, 'invoice')}
          icon={<IndianRupee className="size-5" />}
          color="var(--color-coral)"
        />
      </TileGrid>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { value: 'invoices', label: 'Invoices' },
          { value: 'dues', label: 'Dues' },
          { value: 'structures', label: 'Structures' },
        ]}
      />

      {tab === 'invoices' && (
        <>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="sm:max-w-52"
            options={[
              { value: '', label: 'All statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'partial', label: 'Partially paid' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'scheduled', label: 'Scheduled' },
            ]}
          />
          <DataList
            rows={invoiceRows}
            columns={invoiceColumns}
            rowKey={entityId}
            loading={invoices.isLoading}
            error={
              invoices.error ? (
                <ErrorState
                  message={errorMessage(invoices.error)}
                  onRetry={() => invoices.refetch()}
                />
              ) : undefined
            }
            empty={<EmptyState icon={<Receipt className="size-6" />} title="No invoices" />}
            cardTitle={(invoice) => invoice.invoiceNumber}
            cardSubtitle={nameOf}
            cardAction={(invoice) => (
              <div className="flex items-center gap-1">
                {invoiceBalance(invoice) > 0 && (
                  <IconButton label="Record payment" onClick={() => setCollecting(invoice)}>
                    <IndianRupee className="size-4" />
                  </IconButton>
                )}
                {(invoice.amountPaid ?? 0) > 0 && (
                  <IconButton
                    label="Download receipt"
                    onClick={() => void downloadReceipt(invoice)}
                  >
                    <Download className="size-4" />
                  </IconButton>
                )}
              </div>
            )}
          />
        </>
      )}

      {tab === 'dues' && (
        <DataList
          rows={dues.data}
          columns={invoiceColumns}
          rowKey={entityId}
          loading={dues.isLoading}
          error={
            dues.error ? (
              <ErrorState message={errorMessage(dues.error)} onRetry={() => dues.refetch()} />
            ) : undefined
          }
          empty={
            <EmptyState
              icon={<Receipt className="size-6" />}
              title="Nothing outstanding"
              message="Every invoice is settled."
            />
          }
          cardTitle={(invoice) => nameOf(invoice)}
          cardSubtitle={(invoice) => invoice.invoiceNumber}
          cardAction={(invoice) => (
            <IconButton label="Record payment" onClick={() => setCollecting(invoice)}>
              <IndianRupee className="size-4" />
            </IconButton>
          )}
        />
      )}

      {tab === 'structures' && (
        <>
          {structures.isLoading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Card className="h-40 animate-pulse" />
              <Card className="h-40 animate-pulse" />
            </div>
          ) : structures.error ? (
            <ErrorState
              message={errorMessage(structures.error)}
              onRetry={() => structures.refetch()}
            />
          ) : !structures.data?.length ? (
            <EmptyState
              icon={<FileText className="size-6" />}
              title="No fee structures"
              message="A structure defines what a class pays, and how often."
              action={
                <Button variant="secondary" onClick={() => setCreatingStructure(true)}>
                  New structure
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {structures.data.map((structure) => (
                <Card key={entityId(structure)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-bold">{structure.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {classLabel(structure.classId)} · {structure.academicYear} ·{' '}
                        {humanize(structure.frequency)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge tone={structure.isActive ? 'success' : 'neutral'}>
                        {structure.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <IconButton
                        label="Delete structure"
                        onClick={() => setDeletingStructure(structure)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </div>

                  {!!structure.components?.length && (
                    <ul className="mt-3 space-y-1 rounded-[var(--radius-input)] bg-[var(--color-canvas)] p-3">
                      {structure.components.map((component, index) => (
                        <li key={index} className="flex justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-[var(--color-text-muted)]">
                            {component.name}
                          </span>
                          <span className="shrink-0 font-bold">
                            {formatCurrency(component.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-3 font-display text-xl font-bold">
                    {formatCurrency(structure.totalAmount)}
                    <span className="ml-1 text-sm font-semibold text-[var(--color-text-muted)]">
                      / {humanize(structure.frequency).toLowerCase()}
                    </span>
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <CreateStructure open={creatingStructure} onClose={() => setCreatingStructure(false)} />
      <GenerateInvoices open={generating} onClose={() => setGenerating(false)} />
      <RecordPayment invoice={collecting} onClose={() => setCollecting(null)} />

      <ConfirmDialog
        open={!!deletingStructure}
        onClose={() => setDeletingStructure(null)}
        onConfirm={() =>
          deletingStructure && removeStructure.mutate(entityId(deletingStructure))
        }
        title="Delete this structure?"
        message={`"${deletingStructure?.name}" will no longer be available for new invoices. Invoices already raised are unaffected.`}
        confirmLabel="Delete"
        destructive
        loading={removeStructure.isPending}
      />
    </div>
  );
}

function CreateStructure({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '',
    academicYear: academicYear(),
    frequency: 'monthly',
    classId: '',
    dueDayOfMonth: '5',
    components: 'Tuition: 3000\nActivity: 500',
  });
  const toast = useToast();
  const queryClient = useQueryClient();
  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list, enabled: open });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** "Tuition: 3000" per line → the component list, and its total. */
  const parsed = form.components
    .split('\n')
    .map((line) => {
      const [name, amount] = line.split(':');
      return { name: (name ?? '').trim(), amount: Number((amount ?? '').trim()) };
    })
    .filter((component) => component.name && Number.isFinite(component.amount));
  const total = parsed.reduce((sum, component) => sum + component.amount, 0);

  const create = useMutation({
    mutationFn: () =>
      feesApi.createStructure({
        name: form.name.trim(),
        academicYear: form.academicYear.trim(),
        frequency: form.frequency as FeeStructure['frequency'],
        classId: form.classId || undefined,
        dueDayOfMonth: form.dueDayOfMonth ? Number(form.dueDayOfMonth) : undefined,
        // The API sums the components itself — sending a total is rejected.
        components: parsed,
      }),
    onSuccess: () => {
      toast.success('Structure created.');
      void queryClient.invalidateQueries({ queryKey: ['fees'] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not create that structure.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New fee structure"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!form.name.trim() || !parsed.length}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Nursery — monthly"
          className="sm:col-span-2"
          required
        />
        <Select
          label="Class"
          value={form.classId}
          onChange={(e) => set('classId', e.target.value)}
          placeholder="All classes"
          options={(classes.data ?? []).map((schoolClass) => ({
            value: entityId(schoolClass),
            label: classLabel(schoolClass),
          }))}
        />
        <Select
          label="Frequency"
          value={form.frequency}
          onChange={(e) => set('frequency', e.target.value)}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'term', label: 'Per term' },
            { value: 'annual', label: 'Annual' },
          ]}
        />
        <Select
          label="Academic year"
          value={form.academicYear}
          onChange={(e) => set('academicYear', e.target.value)}
          options={academicYearOptions().map((year) => ({ value: year, label: year }))}
        />
        <Input
          label="Due day of month"
          type="number"
          min={1}
          max={28}
          value={form.dueDayOfMonth}
          onChange={(e) => set('dueDayOfMonth', e.target.value)}
        />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
            Components
          </label>
          <textarea
            value={form.components}
            onChange={(e) => set('components', e.target.value)}
            rows={5}
            className="w-full rounded-[var(--radius-input)] border border-[var(--color-hairline)] bg-white px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            One per line — “Name: amount”. Total:{' '}
            <strong className="text-[var(--color-text)]">{formatCurrency(total)}</strong>
          </p>
        </div>
      </div>
    </Modal>
  );
}

/** Raises the next period's invoices for a structure in one go. */
/**
 * Raises a whole session's invoices for one class.
 *
 * The server works out how many to raise from the structure's frequency
 * (monthly → 12, quarterly → 4, term → 2, annual → 1) and dates them itself,
 * so this only picks the structure, the class and optionally the year.
 */
function GenerateInvoices({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [structureId, setStructureId] = useState('');
  const [classId, setClassId] = useState('');
  const [year, setYear] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const structures = useQuery({
    queryKey: ['fees', 'structures'],
    queryFn: () => feesApi.structures(),
    enabled: open,
  });

  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list, enabled: open });

  // Picking a structure that is tied to a class pre-selects that class.
  const chosen = (structures.data ?? []).find((s) => entityId(s) === structureId);
  const structureClassId = chosen ? refId(chosen.classId) : '';

  const generate = useMutation({
    mutationFn: () =>
      feesApi.generateInvoices({
        feeStructureId: structureId,
        classId: classId || structureClassId,
        ...(year ? { academicYear: year } : {}),
      }),
    onSuccess: (result) => {
      toast.success(`${count(result?.created ?? 0, 'invoice')} raised.`);
      void queryClient.invalidateQueries({ queryKey: ['fees'] });
      setStructureId('');
      setClassId('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not generate invoices.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate invoices"
      description="Raises one invoice per student covered by the structure."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => generate.mutate()}
            loading={generate.isPending}
            disabled={!structureId || !(classId || structureClassId)}
          >
            Generate
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label="Fee structure"
          value={structureId}
          onChange={(e) => {
            setStructureId(e.target.value);
            setClassId('');
          }}
          placeholder={structures.isLoading ? 'Loading…' : 'Choose a structure'}
          required
          options={(structures.data ?? []).map((structure) => ({
            value: entityId(structure),
            label: `${structure.name} · ${formatCurrency(structure.totalAmount)}`,
          }))}
        />
        <Select
          label="Class"
          value={classId || structureClassId}
          onChange={(e) => setClassId(e.target.value)}
          placeholder="Choose a class"
          required
          options={(classes.data ?? []).map((schoolClass) => ({
            value: entityId(schoolClass),
            label: classLabel(schoolClass),
          }))}
        />
        <Select
          label="Academic year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Use the structure's year"
          hint="Periods and due dates are worked out by the server"
          options={academicYearOptions().map((option) => ({ value: option, label: option }))}
        />
      </div>
    </Modal>
  );
}

/** Books an offline payment — cash, cheque or a bank transfer. */
function RecordPayment({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const balance = invoice ? invoiceBalance(invoice) : 0;

  const record = useMutation({
    mutationFn: () =>
      feesApi.recordPayment({
        invoiceId: entityId(invoice!),
        amount: Number(amount || balance),
        method,
        reference: reference.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Payment recorded.');
      void queryClient.invalidateQueries({ queryKey: ['fees'] });
      setAmount('');
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
        invoice ? `${invoice.invoiceNumber} · ${formatCurrency(balance)} outstanding` : undefined
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Amount"
          type="number"
          min={1}
          max={balance || undefined}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(balance)}
          hint="Leave blank to settle in full"
        />
        <Select
          label="Method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'cheque', label: 'Cheque' },
            { value: 'bank_transfer', label: 'Bank transfer' },
            { value: 'upi', label: 'UPI' },
            { value: 'card', label: 'Card' },
          ]}
        />
        <Input
          label="Reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Cheque or transaction number"
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  );
}
