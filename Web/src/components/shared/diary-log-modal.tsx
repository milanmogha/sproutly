'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { daycareApi, type DaycareKind } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/primitives';
import { Input, Select, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { toIsoDate } from '@/lib/utils';

/** "13:00" → today at 13:00 as ISO-8601, which is what the nap endpoint takes. */
function isoAt(time?: string): string | undefined {
  if (!time) return undefined;
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours)) return undefined;
  const when = new Date();
  when.setHours(hours, minutes || 0, 0, 0);
  return when.toISOString();
}

/**
 * The one form for every daycare log kind, scoped to a single child.
 *
 * Shared by the class-wide "Daily logs" screen and the teacher's student
 * detail — the Diary tab's "Log" button opens the same modal, so the two
 * surfaces can never drift in which fields they send.
 */
export function DiaryLogModal({
  kind,
  open,
  studentId,
  studentName: name,
  onClose,
}: {
  kind: DaycareKind;
  open: boolean;
  studentId: string | null;
  studentName: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const toast = useToast();
  const queryClient = useQueryClient();

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const log = useMutation({
    mutationFn: () => {
      const base = { studentId: studentId!, date: toIsoDate() };
      switch (kind) {
        case 'meals':
          return daycareApi.log('meals', {
            ...base,
            mealType: form.mealType || 'lunch',
            menu: (form.menu ?? '').trim(),
            amountEaten: form.amountEaten || 'most',
            notes: form.notes?.trim() || undefined,
          });
        case 'naps':
          return daycareApi.log('naps', {
            ...base,
            // The inputs give a bare "13:00"; the API wants a full ISO
            // timestamp, so anchor each to today's date.
            startTime: isoAt(form.startTime),
            endTime: isoAt(form.endTime),
            quality: form.quality || 'sound',
            notes: form.notes?.trim() || undefined,
          });
        case 'activities':
          return daycareApi.log('activities', {
            ...base,
            title: (form.title ?? '').trim(),
            category: form.category || 'play',
            description: form.description?.trim() || undefined,
            notes: form.notes?.trim() || undefined,
          });
        case 'health':
          return daycareApi.log('health', {
            ...base,
            type: form.type || 'general',
            description: (form.description ?? '').trim(),
            temperature: form.temperature ? Number(form.temperature) : undefined,
            medication: form.medication?.trim() || undefined,
            severity: form.severity || 'info',
            notes: form.notes?.trim() || undefined,
          });
        case 'observations':
          return daycareApi.log('observations', {
            ...base,
            mood: form.mood || 'happy',
            observation: (form.observation ?? '').trim(),
            context: form.context?.trim() || undefined,
            notes: form.notes?.trim() || undefined,
          });
      }
    },
    onSuccess: () => {
      toast.success('Logged.');
      void queryClient.invalidateQueries({ queryKey: ['daycare'] });
      setForm({});
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save that log.')),
  });

  /** The one field each kind genuinely requires. */
  const required: Record<DaycareKind, string> = {
    meals: 'menu',
    naps: '',
    activities: 'title',
    health: 'description',
    observations: 'observation',
  };
  const canSave = !required[kind] || !!form[required[kind]]?.trim();

  const TITLES: Record<DaycareKind, string> = {
    meals: 'Log a meal',
    naps: 'Log a nap',
    activities: 'Log an activity',
    health: 'Log a health update',
    observations: 'Log an observation',
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[kind]}
      description={name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={<Save className="size-4" />}
            onClick={() => log.mutate()}
            loading={log.isPending}
            disabled={!canSave}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {kind === 'meals' && (
          <>
            <Select
              label="Meal"
              value={form.mealType ?? 'lunch'}
              onChange={(e) => set('mealType', e.target.value)}
              options={[
                { value: 'breakfast', label: 'Breakfast' },
                { value: 'morning_snack', label: 'Morning snack' },
                { value: 'lunch', label: 'Lunch' },
                { value: 'afternoon_snack', label: 'Afternoon snack' },
                { value: 'dinner', label: 'Dinner' },
              ]}
            />
            <Select
              label="How much"
              value={form.amountEaten ?? 'most'}
              onChange={(e) => set('amountEaten', e.target.value)}
              options={[
                { value: 'all', label: 'All of it' },
                { value: 'most', label: 'Most' },
                { value: 'some', label: 'Some' },
                { value: 'none', label: 'None' },
                { value: 'refused', label: 'Refused' },
              ]}
            />
            <Input
              label="Menu"
              value={form.menu ?? ''}
              onChange={(e) => set('menu', e.target.value)}
              placeholder="Dal, rice and beans"
              className="sm:col-span-2"
              required
            />
          </>
        )}

        {kind === 'naps' && (
          <>
            <Input
              label="From"
              type="time"
              value={form.startTime ?? ''}
              onChange={(e) => set('startTime', e.target.value)}
            />
            <Input
              label="To"
              type="time"
              value={form.endTime ?? ''}
              onChange={(e) => set('endTime', e.target.value)}
            />
            <Select
              label="Quality"
              value={form.quality ?? 'sound'}
              onChange={(e) => set('quality', e.target.value)}
              className="sm:col-span-2"
              options={[
                { value: 'sound', label: 'Slept soundly' },
                { value: 'restless', label: 'Restless' },
                { value: 'no_nap', label: "Didn't nap" },
              ]}
            />
          </>
        )}

        {kind === 'activities' && (
          <>
            <Input
              label="What they did"
              value={form.title ?? ''}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Finger painting"
              className="sm:col-span-2"
              required
            />
            <Select
              label="Category"
              value={form.category ?? 'play'}
              onChange={(e) => set('category', e.target.value)}
              className="sm:col-span-2"
              options={[
                { value: 'art', label: 'Art' },
                { value: 'music', label: 'Music' },
                { value: 'play', label: 'Play' },
                { value: 'learning', label: 'Learning' },
                { value: 'outdoor', label: 'Outdoor' },
                { value: 'story', label: 'Story' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <Textarea
              label="Description"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="sm:col-span-2"
            />
          </>
        )}

        {kind === 'health' && (
          <>
            <Select
              label="Type"
              value={form.type ?? 'general'}
              onChange={(e) => set('type', e.target.value)}
              options={[
                { value: 'general', label: 'General' },
                { value: 'temperature', label: 'Temperature' },
                { value: 'medication', label: 'Medication' },
                { value: 'incident', label: 'Incident' },
                { value: 'symptom', label: 'Symptom' },
              ]}
            />
            <Select
              label="Severity"
              value={form.severity ?? 'info'}
              onChange={(e) => set('severity', e.target.value)}
              options={[
                { value: 'info', label: 'For information' },
                { value: 'attention', label: 'Needs attention' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
            <Input
              label="Temperature (°C)"
              type="number"
              step="0.1"
              value={form.temperature ?? ''}
              onChange={(e) => set('temperature', e.target.value)}
            />
            <Input
              label="Medication"
              value={form.medication ?? ''}
              onChange={(e) => set('medication', e.target.value)}
            />
            <Textarea
              label="What happened"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="sm:col-span-2"
              required
            />
          </>
        )}

        {kind === 'observations' && (
          <>
            <Select
              label="Mood"
              value={form.mood ?? 'happy'}
              onChange={(e) => set('mood', e.target.value)}
              options={[
                { value: 'happy', label: 'Happy' },
                { value: 'calm', label: 'Calm' },
                { value: 'energetic', label: 'Energetic' },
                { value: 'tired', label: 'Tired' },
                { value: 'cranky', label: 'Cranky' },
                { value: 'upset', label: 'Upset' },
              ]}
            />
            <Input
              label="Context"
              value={form.context ?? ''}
              onChange={(e) => set('context', e.target.value)}
              placeholder="During circle time"
            />
            <Textarea
              label="Observation"
              value={form.observation ?? ''}
              onChange={(e) => set('observation', e.target.value)}
              rows={4}
              className="sm:col-span-2"
              required
            />
          </>
        )}

        <Textarea
          label="Notes"
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  );
}
