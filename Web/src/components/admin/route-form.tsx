'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { transportApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, routeDetails, type TransportRoute } from '@/lib/api/types';
import { Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';

interface RouteForm {
  title: string;
  routeName: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  stops: string;
  notes: string;
}

const blank = (): RouteForm => ({
  title: '',
  routeName: '',
  vehicleNumber: '',
  driverName: '',
  driverPhone: '',
  stops: '',
  notes: '',
});

/** Stops are entered one per line, with an optional time after a comma. */
function parseStops(text: string) {
  return text
    .split('\n')
    .map((line) => {
      const [name, time] = line.split(',');
      return { name: (name ?? '').trim(), time: time?.trim() || undefined };
    })
    .filter((stop) => stop.name);
}

function printStops(stops: Array<{ name: string; time?: string }> = []) {
  return stops.map((stop) => (stop.time ? `${stop.name}, ${stop.time}` : stop.name)).join('\n');
}

/**
 * Create or edit one bus route.
 *
 * Editing sends every field, blanks included: the API's PATCH replaces what it
 * is given, so omitting an emptied field would silently keep the old value and
 * make a driver impossible to remove.
 */
export function RouteFormModal({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing?: TransportRoute | null;
  onSaved?: (route: TransportRoute) => void;
}) {
  const [form, setForm] = useState<RouteForm>(blank);
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!existing;

  // Reload the fields whenever the dialog opens, so a cancelled edit does not
  // leave stale text behind for the next one.
  useEffect(() => {
    if (!open) return;
    if (!existing) {
      setForm(blank());
      return;
    }
    const details = routeDetails(existing);
    setForm({
      title: existing.title ?? '',
      routeName: details.routeName ?? '',
      vehicleNumber: details.vehicleNumber ?? '',
      driverName: details.driverName ?? '',
      driverPhone: details.driverPhone ?? '',
      stops: printStops(details.stops),
      notes: existing.notes ?? '',
    });
  }, [open, existing]);

  const set = <K extends keyof RouteForm>(key: K, value: RouteForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        routeName: form.routeName.trim(),
        vehicleNumber: form.vehicleNumber.trim(),
        driverName: form.driverName.trim(),
        driverPhone: form.driverPhone.trim(),
        notes: form.notes.trim(),
        // Stops are the one detail with no column of its own on the API.
        metadata: { stops: parseStops(form.stops) },
      };
      return isEdit
        ? transportApi.update(entityId(existing!), body)
        : transportApi.create(body);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Route updated.' : 'Route created.');
      void queryClient.invalidateQueries({ queryKey: ['transport'] });
      onSaved?.(saved);
      onClose();
    },
    onError: (error) =>
      toast.error(errorMessage(error, `Could not ${isEdit ? 'update' : 'create'} that route.`)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit route' : 'New route'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!form.title.trim()}
          >
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Route 1 — Bus KA-01"
          className="sm:col-span-2"
          required
        />
        <Input
          label="Route name"
          value={form.routeName}
          onChange={(e) => set('routeName', e.target.value)}
          placeholder="North loop"
        />
        <Input
          label="Vehicle number"
          value={form.vehicleNumber}
          onChange={(e) => set('vehicleNumber', e.target.value)}
          placeholder="KA-01-AB-1234"
        />
        <Input
          label="Driver"
          value={form.driverName}
          onChange={(e) => set('driverName', e.target.value)}
        />
        <Input
          label="Driver phone"
          type="tel"
          value={form.driverPhone}
          onChange={(e) => set('driverPhone', e.target.value)}
        />
        <Textarea
          label="Stops"
          value={form.stops}
          onChange={(e) => set('stops', e.target.value)}
          rows={5}
          hint="One per line — “Stop name, 7:45 am”"
          className="sm:col-span-2"
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          hint="Timings, pickup instructions…"
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  );
}
