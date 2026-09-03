'use client';

import Link from 'next/link';
import {
  Bell,
  Bus,
  CalendarDays,
  ChevronRight,
  Images,
  Megaphone,
  MessageSquare,
  PartyPopper,
  Plane,
  School,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, PageHeader } from '@/components/ui/primitives';
import { useChild } from '@/lib/parent/child-context';
import { entityId, studentName } from '@/lib/api/types';

interface MoreLink {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  color: string;
}

const GROUPS: Array<{ title: string; links: MoreLink[] }> = [
  {
    title: 'Communication',
    links: [
      {
        href: '/parent/more/messages',
        label: 'Messages',
        description: 'Chat with teachers and the office',
        icon: <MessageSquare className="size-5" />,
        color: 'var(--color-blue)',
      },
      {
        href: '/parent/more/circulars',
        label: 'Circulars',
        description: 'Notices from the school',
        icon: <Megaphone className="size-5" />,
        color: 'var(--color-gold)',
      },
      {
        href: '/parent/more/ptm',
        label: 'Parent–teacher meetings',
        description: 'Request and track meetings',
        icon: <Users className="size-5" />,
        color: 'var(--color-grape)',
      },
    ],
  },
  {
    title: 'School life',
    links: [
      {
        href: '/parent/more/gallery',
        label: 'Gallery',
        description: 'Photos from the classroom',
        icon: <Images className="size-5" />,
        color: 'var(--color-pink)',
      },
      {
        href: '/parent/more/events',
        label: 'Events',
        description: "What's coming up",
        icon: <PartyPopper className="size-5" />,
        color: 'var(--color-coral)',
      },
      {
        href: '/parent/more/holidays',
        label: 'Holidays',
        description: 'The school calendar',
        icon: <CalendarDays className="size-5" />,
        color: 'var(--color-teal)',
      },
      {
        href: '/parent/more/leave',
        label: 'Leave',
        description: "Apply for your child's leave",
        icon: <Plane className="size-5" />,
        color: 'var(--color-sky)',
      },
      {
        href: '/parent/more/transport',
        label: 'Transport',
        description: 'Route, bus and driver',
        icon: <Bus className="size-5" />,
        color: 'var(--color-sunny)',
      },
    ],
  },
  {
    title: 'Account',
    links: [
      {
        href: '/parent/notifications',
        label: 'Notifications',
        description: 'Everything you were told',
        icon: <Bell className="size-5" />,
        color: 'var(--color-purple)',
      },
      {
        href: '/parent/more/profile',
        label: 'My profile',
        description: 'Your details and alert settings',
        icon: <User className="size-5" />,
        color: 'var(--color-brand)',
      },
      {
        href: '/parent/more/school',
        label: 'School contact',
        description: 'Address, phone and email',
        icon: <School className="size-5" />,
        color: 'var(--color-lime)',
      },
      {
        href: '/privacy',
        label: 'Privacy policy',
        description: 'How your data is handled',
        icon: <ShieldCheck className="size-5" />,
        color: 'var(--color-text-muted)',
      },
    ],
  },
];

export default function ParentMorePage() {
  const { selected } = useChild();

  return (
    <div className="space-y-6">
      <PageHeader title="More" />

      {selected && (
        <Link href={`/parent/child/${entityId(selected)}`} className="block">
          <Card className="flex items-center gap-3 transition hover:-translate-y-0.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-tint text-accent">
              <User className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold">{studentName(selected)}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                View and update your child&apos;s profile
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-[var(--color-text-muted)]" />
          </Card>
        </Link>
      )}

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="mb-3 text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
            {group.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.links.map((link) => (
              <Link key={link.href} href={link.href} className="block">
                <Card className="flex h-full items-center gap-3 transition hover:-translate-y-0.5">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-2xl text-white"
                    style={{ backgroundColor: link.color }}
                  >
                    {link.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold">{link.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{link.description}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-[var(--color-text-muted)]" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
