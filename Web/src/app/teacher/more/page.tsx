'use client';

import {
  Baby,
  BarChart3,
  Bell,
  Bus,
  CalendarDays,
  Images,
  Megaphone,
  MessageSquare,
  PartyPopper,
  Plane,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { MoreHub, type MoreGroup } from '@/components/shared/more-hub';

const GROUPS: MoreGroup[] = [
  {
    title: 'Daily',
    links: [
      {
        href: '/teacher/more/daycare',
        label: 'Daily logs',
        description: 'Meals, naps, activities, health',
        icon: <Baby className="size-5" />,
        color: 'var(--color-teal)',
      },
      {
        href: '/teacher/more/gallery',
        label: 'Gallery',
        description: 'Share classroom photos',
        icon: <Images className="size-5" />,
        color: 'var(--color-pink)',
      },
    ],
  },
  {
    title: 'Communication',
    links: [
      {
        href: '/teacher/more/messages',
        label: 'Messages',
        description: 'Talk to parents and the office',
        icon: <MessageSquare className="size-5" />,
        color: 'var(--color-blue)',
      },
      {
        href: '/teacher/more/circulars',
        label: 'Circulars',
        description: 'Read and post notices',
        icon: <Megaphone className="size-5" />,
        color: 'var(--color-gold)',
      },
      {
        href: '/teacher/more/ptm',
        label: 'Parent meetings',
        description: 'Schedule the requests sent to you',
        icon: <Users className="size-5" />,
        color: 'var(--color-grape)',
      },
    ],
  },
  {
    title: 'School',
    links: [
      {
        href: '/teacher/more/events',
        label: 'Events',
        description: "What's coming up",
        icon: <PartyPopper className="size-5" />,
        color: 'var(--color-coral)',
      },
      {
        href: '/teacher/more/holidays',
        label: 'Holidays',
        description: 'The school calendar',
        icon: <CalendarDays className="size-5" />,
        color: 'var(--color-lime)',
      },
      {
        href: '/teacher/more/leave',
        label: 'My leave',
        description: 'Apply and track your leave',
        icon: <Plane className="size-5" />,
        color: 'var(--color-sky)',
      },
      {
        href: '/teacher/more/transport',
        label: 'Transport',
        description: 'The route you ride',
        icon: <Bus className="size-5" />,
        color: 'var(--color-gold)',
      },
      {
        href: '/teacher/more/reports',
        label: 'Reports',
        description: 'Attendance and results by class',
        icon: <BarChart3 className="size-5" />,
        color: 'var(--color-purple)',
      },
    ],
  },
  {
    title: 'Account',
    links: [
      {
        href: '/teacher/notifications',
        label: 'Notifications',
        description: 'Everything you were told',
        icon: <Bell className="size-5" />,
        color: 'var(--color-purple)',
      },
      {
        href: '/teacher/more/profile',
        label: 'My profile',
        description: 'Your details and alert settings',
        icon: <User className="size-5" />,
        color: 'var(--color-brand)',
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

export default function TeacherMorePage() {
  return <MoreHub groups={GROUPS} />;
}
