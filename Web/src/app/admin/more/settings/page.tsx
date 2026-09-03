'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Save, School } from 'lucide-react';
import { useEffect, useState } from 'react';
import { schoolsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { schoolCity, type Address } from '@/lib/api/types';
import {
  Button,
  Card,
  ErrorState,
  ListSkeleton,
  PageHeader,
  SectionTitle,
} from '@/components/ui/primitives';
import { DetailRow } from '@/components/ui/data-list';
import { Input, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { academicYearOptions } from '@/lib/utils';

/**
 * The school's own details.
 *
 * Deliberately narrow: the name, code and payment gateway are the platform's
 * to set, so they are shown read-only here and changed by Sproutly. The
 * academic year is the office's to keep current, so it is editable.
 */
export default function AdminSettingsPage() {
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [currentAcademicYear, setCurrentAcademicYear] = useState('');
  const [address, setAddress] = useState<Address>({});
  const toast = useToast();
  const queryClient = useQueryClient();

  const school = useQuery({ queryKey: ['school', 'mine'], queryFn: schoolsApi.mine });

  useEffect(() => {
    if (!school.data) return;
    setContactEmail(school.data.contactEmail ?? '');
    setContactPhone(school.data.contactPhone ?? '');
    setCurrentAcademicYear(school.data.currentAcademicYear ?? '');
    setAddress(
      typeof school.data.address === 'object' && school.data.address
        ? school.data.address
        : {},
    );
  }, [school.data]);

  const save = useMutation({
    mutationFn: () =>
      schoolsApi.updateMine({
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        currentAcademicYear: currentAcademicYear.trim() || undefined,
        address,
      }),
    onSuccess: () => {
      toast.success('School details saved.');
      void queryClient.invalidateQueries({ queryKey: ['school', 'mine'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save those details.')),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="School settings" />

      {school.isLoading ? (
        <ListSkeleton rows={3} />
      ) : school.error ? (
        <ErrorState message={errorMessage(school.error)} onRetry={() => school.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-tint text-accent">
                <School className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{school.data?.name}</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {school.data?.trustName ?? 'Your school'}
                </p>
              </div>
            </div>
            {/*
              Only what `/schools/mine` actually returns. It is a trimmed
              contact card every signed-in role may read, so it carries no
              `status` or `enabledModules` — rendering those left a blank
              badge and a permanent “—”.
            */}
            <dl>
              <DetailRow label="Code" value={school.data?.code ?? '—'} />
              <DetailRow label="City" value={schoolCity(school.data)} />
              <DetailRow
                label="Academic year"
                value={school.data?.currentAcademicYear ?? '—'}
              />
              <DetailRow
                label="Affiliation"
                value={school.data?.affiliationNumber ?? '—'}
              />
            </dl>
            <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              The school name, code and enabled modules are set by Sproutly. Contact us to
              change them.
            </p>
          </Card>

          <Card>
            <SectionTitle title="Contact details" />
            <div className="space-y-3">
              <Input
                label="Contact email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              <Input
                label="Contact phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
              <Select
                label="Academic year"
                value={currentAcademicYear}
                onChange={(e) => setCurrentAcademicYear(e.target.value)}
                options={academicYearOptions(5).map((year) => ({ value: year, label: year }))}
                hint="The session your fees and classes are billed under."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Address line 1"
                  value={address.line1 ?? ''}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  className="sm:col-span-2"
                />
                <Input
                  label="City"
                  value={address.city ?? ''}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                />
                <Input
                  label="State"
                  value={address.state ?? ''}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                />
                <Input
                  label="Postcode"
                  value={address.postalCode ?? ''}
                  onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                />
              </div>
              <Button
                icon={<Save className="size-4" />}
                onClick={() => save.mutate()}
                loading={save.isPending}
              >
                Save changes
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <SectionTitle title="Online fee payments" />
            <p className="text-sm text-[var(--color-text-muted)]">
              Fees are collected into your school&apos;s own Razorpay account — Sproutly never
              holds the money. Hand your Razorpay keys to Sproutly and we&apos;ll enable it for
              you; for security, they can&apos;t be entered or read from this portal.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
