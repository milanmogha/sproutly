'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HeartPulse, Lock, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { classesApi, studentsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  className as classLabel,
  entityId,
  studentName,
  type Address,
  type EmergencyContact,
  type Guardian,
  type MedicalInfo,
  type Student,
} from '@/lib/api/types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  IconButton,
  ListSkeleton,
  PageHeader,
  SectionTitle,
} from '@/components/ui/primitives';
import { DetailRow } from '@/components/ui/data-list';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatDate, humanize } from '@/lib/utils';

/**
 * A child's profile as their parent sees it.
 *
 * The admin owns identity — name, date of birth, class, admission number — so
 * those are read-only here. The rest (address, guardians, emergency contacts,
 * medical) is the parent's to fill in, and locks once submitted; after that a
 * change goes through the office as a request.
 */
export default function ParentChildProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  const student = useQuery({
    queryKey: ['students', id],
    queryFn: () => studentsApi.get(id),
    enabled: !!id,
  });

  if (student.isLoading) return <ListSkeleton rows={4} />;
  if (student.error) {
    return (
      <ErrorState message={errorMessage(student.error)} onRetry={() => student.refetch()} />
    );
  }
  if (!student.data) return null;

  const child = student.data;
  const locked = !!child.profileCompleted;
  const medical = child.medicalInfo ?? {};

  return (
    <div className="space-y-5">
      <PageHeader
        title={studentName(child)}
        subtitle={`${classLabel(child.classId, classes.data)} · ${child.admissionNumber}`}
        actions={
          locked ? (
            <Button
              variant="secondary"
              icon={<Pencil className="size-4" />}
              onClick={() => setRequesting(true)}
            >
              Request a change
            </Button>
          ) : (
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Complete profile
            </Button>
          )
        }
      />

      {!locked && (
        <Card className="border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10">
          <p className="text-sm font-semibold text-[#8a6200]">
            This profile isn&apos;t complete yet. Add your address, guardians, emergency
            contacts and medical details so the school can reach you quickly.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <Avatar
              name={studentName(child)}
              id={entityId(child)}
              src={child.photoUrl}
              size={56}
            />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">{studentName(child)}</p>
              <Badge tone={child.status === 'active' ? 'success' : 'neutral'}>
                {humanize(child.status)}
              </Badge>
            </div>
          </div>
          <dl>
            <DetailRow label="Admission no." value={child.admissionNumber} />
            <DetailRow label="Class" value={classLabel(child.classId, classes.data)} />
            <DetailRow label="Date of birth" value={formatDate(child.dateOfBirth)} />
            <DetailRow label="Gender" value={humanize(child.gender)} />
          </dl>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <Lock className="size-3.5" />
            Set by the school — ask the office to change these.
          </p>
        </Card>

        <Card>
          <SectionTitle title="Address" />
          {child.address ? (
            <dl>
              <DetailRow label="Line 1" value={child.address.line1 ?? '—'} />
              {child.address.line2 && (
                <DetailRow label="Line 2" value={child.address.line2} />
              )}
              <DetailRow label="City" value={child.address.city ?? '—'} />
              <DetailRow label="State" value={child.address.state ?? '—'} />
              <DetailRow label="Postcode" value={child.address.postalCode ?? '—'} />
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No address on file.</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Guardians" />
          {child.guardians?.length ? (
            <ul className="space-y-3">
              {child.guardians.map((guardian, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Avatar name={guardian.name} id={guardian.phone} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {guardian.name}
                      {guardian.isPrimary && (
                        <Badge tone="accent" className="ml-2">
                          Primary
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {humanize(guardian.relationship)}
                      {guardian.occupation ? ` · ${guardian.occupation}` : ''}
                    </p>
                    <a
                      href={`tel:${guardian.phone}`}
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-accent"
                    >
                      <Phone className="size-3.5" />
                      {guardian.phone}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No guardians listed.</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Emergency contacts" />
          {child.emergencyContacts?.length ? (
            <ul className="space-y-2">
              {child.emergencyContacts.map((contact, index) => (
                <li key={index} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-bold">{contact.name}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {humanize(contact.relationship)}
                    </span>
                  </span>
                  <a
                    href={`tel:${contact.phone}`}
                    className="shrink-0 text-sm font-bold text-accent"
                  >
                    {contact.phone}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              No emergency contacts listed.
            </p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="Medical" />
          <div className="grid gap-4 sm:grid-cols-2">
            <dl>
              <DetailRow label="Blood group" value={medical.bloodGroup ?? '—'} />
              <DetailRow
                label="Allergies"
                value={medical.allergies?.length ? medical.allergies.join(', ') : 'None recorded'}
              />
              <DetailRow
                label="Conditions"
                value={
                  medical.conditions?.length ? medical.conditions.join(', ') : 'None recorded'
                }
              />
              <DetailRow
                label="Medications"
                value={
                  medical.medications?.length ? medical.medications.join(', ') : 'None recorded'
                }
              />
              <DetailRow label="Physician" value={medical.physicianName ?? '—'} />
              <DetailRow label="Physician phone" value={medical.physicianPhone ?? '—'} />
            </dl>
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
                <HeartPulse className="size-4" />
                Vaccinations
              </p>
              {medical.vaccinations?.length ? (
                <ul className="space-y-1.5">
                  {medical.vaccinations.map((vaccination, index) => (
                    <li key={index} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        {vaccination.name}
                        {vaccination.doseLabel ? ` · ${vaccination.doseLabel}` : ''}
                      </span>
                      <Badge tone={vaccination.administered ? 'success' : 'warning'}>
                        {vaccination.administered
                          ? formatDate(vaccination.administeredOn)
                          : `Due ${formatDate(vaccination.dueOn)}`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">None recorded.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <CompleteProfileModal
        open={editing}
        onClose={() => setEditing(false)}
        student={child}
      />
      <ChangeRequestModal
        open={requesting}
        onClose={() => setRequesting(false)}
        studentId={entityId(child)}
      />
    </div>
  );
}

/** The one-time form a parent fills to complete their child's profile. */
function CompleteProfileModal({
  open,
  onClose,
  student,
}: {
  open: boolean;
  onClose: () => void;
  student: Student;
}) {
  const [address, setAddress] = useState<Address>({});
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [medical, setMedical] = useState<MedicalInfo>({});
  const toast = useToast();
  const queryClient = useQueryClient();

  // Start from whatever the school already has, so nothing is retyped.
  useEffect(() => {
    if (!open) return;
    setAddress(student.address ?? {});
    setGuardians(
      student.guardians?.length
        ? student.guardians
        : [{ name: '', relationship: 'mother', phone: '', isPrimary: true }],
    );
    setContacts(student.emergencyContacts ?? []);
    setMedical(student.medicalInfo ?? {});
  }, [open, student]);

  const save = useMutation({
    mutationFn: () =>
      studentsApi.updateProfile(entityId(student), {
        address,
        // Drop half-filled rows — the API validates each one it receives.
        guardians: guardians.filter((g) => g.name.trim() && g.phone.trim()),
        emergencyContacts: contacts.filter((c) => c.name.trim() && c.phone.trim()),
        medicalInfo: medical,
      }),
    onSuccess: () => {
      toast.success('Profile saved.');
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save that profile.')),
  });

  const setGuardian = (index: number, patch: Partial<Guardian>) =>
    setGuardians((current) =>
      current.map((guardian, i) => (i === index ? { ...guardian, ...patch } : guardian)),
    );

  const setContact = (index: number, patch: Partial<EmergencyContact>) =>
    setContacts((current) =>
      current.map((contact, i) => (i === index ? { ...contact, ...patch } : contact)),
    );

  /** Comma-separated text ⇄ the string arrays the API expects. */
  const listValue = (values?: string[]) => (values ?? []).join(', ');
  const parseList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Complete profile"
      description="This locks once saved — later changes go through the school office."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save profile
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="font-display font-bold">Address</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Line 1"
              value={address.line1 ?? ''}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              className="sm:col-span-2"
            />
            <Input
              label="Line 2"
              value={address.line2 ?? ''}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
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
            <Input
              label="Country"
              value={address.country ?? ''}
              onChange={(e) => setAddress({ ...address, country: e.target.value })}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold">Guardians</h3>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="size-4" />}
              disabled={guardians.length >= 6}
              onClick={() =>
                setGuardians([
                  ...guardians,
                  { name: '', relationship: 'father', phone: '', isPrimary: false },
                ])
              }
            >
              Add
            </Button>
          </div>
          {guardians.map((guardian, index) => (
            <div
              key={index}
              className="rounded-[var(--radius-input)] border border-[var(--color-hairline)] p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] uppercase">
                  <Users className="size-3.5" />
                  Guardian {index + 1}
                </span>
                {guardians.length > 1 && (
                  <IconButton
                    label="Remove guardian"
                    onClick={() => setGuardians(guardians.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Name"
                  value={guardian.name}
                  onChange={(e) => setGuardian(index, { name: e.target.value })}
                />
                <Input
                  label="Relationship"
                  value={guardian.relationship}
                  onChange={(e) => setGuardian(index, { relationship: e.target.value })}
                  placeholder="mother / father / guardian"
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={guardian.phone}
                  onChange={(e) => setGuardian(index, { phone: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  value={guardian.email ?? ''}
                  onChange={(e) => setGuardian(index, { email: e.target.value })}
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="radio"
                  name="primary-guardian"
                  checked={!!guardian.isPrimary}
                  onChange={() =>
                    // Exactly one primary: setting this one clears the others.
                    setGuardians(
                      guardians.map((g, i) => ({ ...g, isPrimary: i === index })),
                    )
                  }
                  className="size-4 accent-[var(--accent)]"
                />
                Primary contact
              </label>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold">Emergency contacts</h3>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="size-4" />}
              disabled={contacts.length >= 6}
              onClick={() => setContacts([...contacts, { name: '', relationship: '', phone: '' }])}
            >
              Add
            </Button>
          </div>
          {contacts.map((contact, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input
                label="Name"
                value={contact.name}
                onChange={(e) => setContact(index, { name: e.target.value })}
              />
              <Input
                label="Relationship"
                value={contact.relationship}
                onChange={(e) => setContact(index, { relationship: e.target.value })}
              />
              <Input
                label="Phone"
                type="tel"
                value={contact.phone}
                onChange={(e) => setContact(index, { phone: e.target.value })}
              />
              <div className="flex items-end pb-1">
                <IconButton
                  label="Remove contact"
                  onClick={() => setContacts(contacts.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="font-display font-bold">Medical</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Blood group"
              value={medical.bloodGroup ?? ''}
              onChange={(e) => setMedical({ ...medical, bloodGroup: e.target.value })}
              placeholder="O+"
            />
            <Input
              label="Physician"
              value={medical.physicianName ?? ''}
              onChange={(e) => setMedical({ ...medical, physicianName: e.target.value })}
            />
            <Input
              label="Physician phone"
              type="tel"
              value={medical.physicianPhone ?? ''}
              onChange={(e) => setMedical({ ...medical, physicianPhone: e.target.value })}
            />
            <Input
              label="Allergies"
              value={listValue(medical.allergies)}
              onChange={(e) => setMedical({ ...medical, allergies: parseList(e.target.value) })}
              hint="Comma separated"
            />
            <Input
              label="Conditions"
              value={listValue(medical.conditions)}
              onChange={(e) => setMedical({ ...medical, conditions: parseList(e.target.value) })}
              hint="Comma separated"
            />
            <Input
              label="Medications"
              value={listValue(medical.medications)}
              onChange={(e) => setMedical({ ...medical, medications: parseList(e.target.value) })}
              hint="Comma separated"
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}

function ChangeRequestModal({
  open,
  onClose,
  studentId,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
}) {
  const [message, setMessage] = useState('');
  const toast = useToast();

  const request = useMutation({
    mutationFn: () => studentsApi.requestChange(studentId, { message: message.trim() }),
    onSuccess: () => {
      toast.success('Request sent to the school office.');
      setMessage('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not send that request.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request a change"
      description="An admin will review this and update the profile."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => request.mutate()}
            loading={request.isPending}
            disabled={message.trim().length < 3}
          >
            Send request
          </Button>
        </>
      }
    >
      <Textarea
        label="What needs changing?"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        maxLength={500}
        placeholder="e.g. Our phone number has changed to…"
        hint={`${message.length}/500`}
        required
      />
    </Modal>
  );
}
