'use client';

import { useQuery } from '@tanstack/react-query';
import { Mail, MapPin, Phone, School } from 'lucide-react';
import { schoolsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { schoolAddress } from '@/lib/api/types';
import {
  Card,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { DetailRow } from '@/components/ui/data-list';

/** Where to find the school, and how to reach it. */
export default function ParentSchoolPage() {
  const school = useQuery({
    queryKey: ['school', 'mine'],
    queryFn: schoolsApi.mine,
  });

  const address = school.data?.address ? schoolAddress(school.data) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="School contact" />

      {school.isLoading ? (
        <ListSkeleton rows={2} />
      ) : school.error ? (
        <ErrorState message={errorMessage(school.error)} onRetry={() => school.refetch()} />
      ) : (
        <Card className="max-w-2xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-accent-tint text-accent">
              <School className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl font-bold">{school.data?.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{school.data?.code}</p>
            </div>
          </div>

          <dl>
            {address && (
              <DetailRow
                label="Address"
                value={
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {address}
                  </span>
                }
              />
            )}
            <DetailRow
              label="Phone"
              value={
                school.data?.contactPhone ? (
                  <a
                    href={`tel:${school.data.contactPhone}`}
                    className="inline-flex items-center gap-1.5 font-bold text-accent"
                  >
                    <Phone className="size-4" />
                    {school.data.contactPhone}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <DetailRow
              label="Email"
              value={
                school.data?.contactEmail ? (
                  <a
                    href={`mailto:${school.data.contactEmail}`}
                    className="inline-flex items-center gap-1.5 font-bold text-accent"
                  >
                    <Mail className="size-4" />
                    {school.data.contactEmail}
                  </a>
                ) : (
                  '—'
                )
              }
            />
          </dl>
        </Card>
      )}
    </div>
  );
}
