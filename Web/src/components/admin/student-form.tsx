'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { studentsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  type Address,
  type Guardian,
  type MedicalInfo,
  type Student,
} from '@/lib/api/types';
import { Button, SectionTitle } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { toIsoDate } from '@/lib/utils';

/* The API validates each of these against an enum, so they are named exactly. */
const GENDERS = ['male', 'female', 'other'];
const STATUSES = ['active', 'inactive', 'graduated', 'withdrawn', 'suspended'];
const RELATIONSHIPS = ['father', 'mother', 'guardian', 'grandparent', 'sibling', 'other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const options = (values: string[]) =>
  values.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

interface GuardianForm {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  occupation: string;
}

const blankGuardian = (relationship: string): GuardianForm => ({
  name: '',
  relationship,
  phone: '',
  email: '',
  occupation: '',
});

const toGuardianForm = (guardian: Guardian | undefined, fallback: string): GuardianForm =>
  guardian
    ? {
        name: guardian.name ?? '',
        relationship: RELATIONSHIPS.includes(guardian.relationship)
          ? guardian.relationship
          : fallback,
        phone: guardian.phone ?? '',
        email: guardian.email ?? '',
        occupation: guardian.occupation ?? '',
      }
    : blankGuardian(fallback);

/** Comma-separated in the form, an array on the wire. */
const splitList = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** Ten digits, optionally with a +91 or 0 in front — what the API accepts. */
const validPhone = (phone: string) => /^(\+91[- ]?|0)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ''));

/**
 * Corrects a child's record.
 *
 * Enrolment asks only for an identity; everything else is filled in later, so
 * this is where a name is fixed, a guardian's number updated or a status
 * changed. Sections left entirely blank are omitted from the request rather
 * than sent empty — writing `[]` would wipe details this form never showed.
 */
export function EditStudentModal({
  open,
  student,
  onClose,
}: {
  open: boolean;
  student: Student | undefined;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const [basics, setBasics] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    status: 'active',
  });
  const [guardians, setGuardians] = useState<[GuardianForm, GuardianForm]>([
    blankGuardian('father'),
    blankGuardian('mother'),
  ]);
  const [emergency, setEmergency] = useState({ name: '', relationship: '', phone: '' });
  const [address, setAddress] = useState<Address>({});
  const [medical, setMedical] = useState({
    bloodGroup: '',
    allergies: '',
    conditions: '',
    medications: '',
    physicianName: '',
    physicianPhone: '',
  });

  // Refill from the record each time the dialog opens, so a cancelled edit
  // leaves nothing behind for the next child.
  useEffect(() => {
    if (!open || !student) return;
    setError(null);
    setBasics({
      firstName: student.firstName ?? '',
      lastName: student.lastName ?? '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
      gender: GENDERS.includes(student.gender ?? '') ? student.gender! : 'male',
      status: STATUSES.includes(student.status) ? student.status : 'active',
    });
    setGuardians([
      toGuardianForm(student.guardians?.[0], 'father'),
      toGuardianForm(student.guardians?.[1], 'mother'),
    ]);
    const contact = student.emergencyContacts?.[0];
    setEmergency({
      name: contact?.name ?? '',
      relationship: contact?.relationship ?? '',
      phone: contact?.phone ?? '',
    });
    setAddress(student.address ?? {});
    const info: MedicalInfo = student.medicalInfo ?? {};
    setMedical({
      bloodGroup: info.bloodGroup ?? '',
      allergies: (info.allergies ?? []).join(', '),
      conditions: (info.conditions ?? []).join(', '),
      medications: (info.medications ?? []).join(', '),
      physicianName: info.physicianName ?? '',
      physicianPhone: info.physicianPhone ?? '',
    });
  }, [open, student]);

  const setGuardian = (index: 0 | 1, patch: Partial<GuardianForm>) =>
    setGuardians((current) => {
      const next: [GuardianForm, GuardianForm] = [current[0], current[1]];
      next[index] = { ...next[index], ...patch };
      return next;
    });

  const save = useMutation({
    mutationFn: () => {
      // A guardian card counts once it has a name or a number; a half-filled
      // one is a mistake, not an omission, so it is refused rather than sent.
      const filled = guardians
        .map((guardian, index) => ({ guardian, isPrimary: index === 0 }))
        .filter(({ guardian }) => guardian.name.trim() || guardian.phone.trim());
      for (const { guardian } of filled) {
        if (!guardian.name.trim() || !validPhone(guardian.phone)) {
          throw new Error('Enter a name and a valid phone number for each guardian.');
        }
      }

      const emergencyTouched =
        !!emergency.name.trim() || !!emergency.relationship.trim() || !!emergency.phone.trim();
      if (
        emergencyTouched &&
        (!emergency.name.trim() || !emergency.relationship.trim() || !validPhone(emergency.phone))
      ) {
        throw new Error(
          'Complete the emergency contact — name, relation and a valid phone — or clear it.',
        );
      }

      const addressFilled = Object.values(address).some((value) => !!value?.trim());

      return studentsApi.update(entityId(student!), {
        firstName: basics.firstName.trim(),
        lastName: basics.lastName.trim(),
        dateOfBirth: basics.dateOfBirth,
        gender: basics.gender,
        status: basics.status as Student['status'],
        medicalInfo: {
          // The API validates the blood group against an enum, so an empty
          // pick has to be dropped rather than sent as ''.
          ...(medical.bloodGroup ? { bloodGroup: medical.bloodGroup } : {}),
          allergies: splitList(medical.allergies),
          conditions: splitList(medical.conditions),
          medications: splitList(medical.medications),
          physicianName: medical.physicianName.trim(),
          physicianPhone: medical.physicianPhone.trim(),
        },
        ...(filled.length
          ? {
              guardians: filled.map(({ guardian, isPrimary }) => ({
                name: guardian.name.trim(),
                relationship: guardian.relationship,
                phone: guardian.phone.trim(),
                ...(guardian.email.trim() ? { email: guardian.email.trim() } : {}),
                occupation: guardian.occupation.trim(),
                isPrimary,
              })),
            }
          : {}),
        ...(emergencyTouched
          ? {
              emergencyContacts: [
                {
                  name: emergency.name.trim(),
                  relationship: emergency.relationship.trim(),
                  phone: emergency.phone.trim(),
                },
              ],
            }
          : {}),
        ...(addressFilled ? { address } : {}),
      });
    },
    onSuccess: () => {
      toast.success('Student updated.');
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      onClose();
    },
    onError: (err) => {
      const message = errorMessage(err, 'Could not save those details.');
      setError(message);
      toast.error(message);
    },
  });

  const incomplete =
    !basics.firstName.trim() || !basics.lastName.trim() || !basics.dateOfBirth;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit student"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setError(null);
              save.mutate();
            }}
            loading={save.isPending}
            disabled={incomplete}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-[var(--radius-input)] bg-[var(--color-danger)]/10 px-3 py-2 text-sm font-bold text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <section>
          <SectionTitle title="Basics" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="First name"
              value={basics.firstName}
              onChange={(e) => setBasics({ ...basics, firstName: e.target.value })}
              required
            />
            <Input
              label="Last name"
              value={basics.lastName}
              onChange={(e) => setBasics({ ...basics, lastName: e.target.value })}
              required
            />
            <Input
              label="Date of birth"
              type="date"
              max={toIsoDate()}
              value={basics.dateOfBirth}
              onChange={(e) => setBasics({ ...basics, dateOfBirth: e.target.value })}
              required
            />
            <Select
              label="Gender"
              value={basics.gender}
              onChange={(e) => setBasics({ ...basics, gender: e.target.value })}
              options={options(GENDERS)}
            />
            <Select
              label="Status"
              value={basics.status}
              onChange={(e) => setBasics({ ...basics, status: e.target.value })}
              options={options(STATUSES)}
              hint="Only active students are marked for attendance."
            />
            <Input label="Admission number" value={student?.admissionNumber ?? ''} disabled />
          </div>
        </section>

        <section>
          <SectionTitle title="Guardians" />
          <div className="grid gap-4 sm:grid-cols-2">
            {guardians.map((guardian, index) => (
              <div key={index} className="space-y-3">
                <p className="text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
                  {index === 0 ? 'Primary' : 'Second guardian'}
                </p>
                <Input
                  label="Name"
                  value={guardian.name}
                  onChange={(e) => setGuardian(index as 0 | 1, { name: e.target.value })}
                />
                <Select
                  label="Relationship"
                  value={guardian.relationship}
                  onChange={(e) => setGuardian(index as 0 | 1, { relationship: e.target.value })}
                  options={options(RELATIONSHIPS)}
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={guardian.phone}
                  onChange={(e) => setGuardian(index as 0 | 1, { phone: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  value={guardian.email}
                  onChange={(e) => setGuardian(index as 0 | 1, { email: e.target.value })}
                />
                <Input
                  label="Occupation"
                  value={guardian.occupation}
                  onChange={(e) => setGuardian(index as 0 | 1, { occupation: e.target.value })}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Emergency contact" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Name"
              value={emergency.name}
              onChange={(e) => setEmergency({ ...emergency, name: e.target.value })}
            />
            <Input
              label="Relationship"
              value={emergency.relationship}
              onChange={(e) => setEmergency({ ...emergency, relationship: e.target.value })}
            />
            <Input
              label="Phone"
              type="tel"
              value={emergency.phone}
              onChange={(e) => setEmergency({ ...emergency, phone: e.target.value })}
            />
          </div>
        </section>

        <section>
          <SectionTitle title="Address" />
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
        </section>

        <section>
          <SectionTitle title="Medical" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Blood group"
              value={medical.bloodGroup}
              onChange={(e) => setMedical({ ...medical, bloodGroup: e.target.value })}
              placeholder="Not recorded"
              options={BLOOD_GROUPS.map((group) => ({ value: group, label: group }))}
            />
            <Input
              label="Physician"
              value={medical.physicianName}
              onChange={(e) => setMedical({ ...medical, physicianName: e.target.value })}
            />
            <Input
              label="Physician phone"
              type="tel"
              value={medical.physicianPhone}
              onChange={(e) => setMedical({ ...medical, physicianPhone: e.target.value })}
            />
            <Textarea
              label="Allergies"
              rows={2}
              value={medical.allergies}
              onChange={(e) => setMedical({ ...medical, allergies: e.target.value })}
              hint="Separate with commas"
            />
            <Textarea
              label="Conditions"
              rows={2}
              value={medical.conditions}
              onChange={(e) => setMedical({ ...medical, conditions: e.target.value })}
              hint="Separate with commas"
            />
            <Textarea
              label="Medications"
              rows={2}
              value={medical.medications}
              onChange={(e) => setMedical({ ...medical, medications: e.target.value })}
              hint="Separate with commas"
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}
