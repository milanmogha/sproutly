'use client';

import {
  BarChart3,
  Bell,
  Bus,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Images,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  PartyPopper,
  Plane,
  Settings,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { MoreHub, type MoreGroup } from '@/components/shared/more-hub';

const GROUPS: MoreGroup[] = [
  {
    title: 'School',
    links: [
      {
        href: '/admin/more/classes',
        label: 'Classes',
        description: 'Create classes and allocate students',
        icon: <LayoutGrid className="size-5" />,
        color: 'var(--color-brand)',
      },
      {
        href: '/admin/more/staff',
        label: 'Staff',
        description: 'Teachers and support staff',
        icon: <GraduationCap className="size-5" />,
        color: 'var(--color-teal)',
      },
      {
        href: '/admin/more/users',
        label: 'Users',
        description: 'Accounts and invitations',
        icon: <UsersRound className="size-5" />,
        color: 'var(--color-blue)',
      },
      {
        href: '/admin/more/admissions',
        label: 'Admissions',
        description: 'Inquiries and applications',
        icon: <UserPlus className="size-5" />,
        color: 'var(--color-grape)',
      },
      {
        href: '/admin/more/transport',
        label: 'Transport',
        description: 'Routes, vehicles and drivers',
        icon: <Bus className="size-5" />,
        color: 'var(--color-sunny)',
      },
      {
        href: '/admin/more/reports',
        label: 'Reports',
        description: 'Attendance, fees and enrolment',
        icon: <BarChart3 className="size-5" />,
        color: 'var(--color-purple)',
      },
    ],
  },
  {
    title: 'Communication',
    links: [
      {
        href: '/admin/more/messages',
        label: 'Messages',
        description: 'Talk to parents and staff',
        icon: <MessageSquare className="size-5" />,
        color: 'var(--color-blue)',
      },
      {
        href: '/admin/more/circulars',
        label: 'Circulars',
        description: 'Post notices to the school',
        icon: <Megaphone className="size-5" />,
        color: 'var(--color-gold)',
      },
      {
        href: '/admin/more/ptm',
        label: 'Parent meetings',
        description: 'Schedule and track PTMs',
        icon: <Users className="size-5" />,
        color: 'var(--color-grape)',
      },
      {
        href: '/admin/more/gallery',
        label: 'Gallery',
        description: 'Share photos with parents',
        icon: <Images className="size-5" />,
        color: 'var(--color-pink)',
      },
    ],
  },
  {
    title: 'Calendar',
    links: [
      {
        href: '/admin/more/events',
        label: 'Events',
        description: 'Plan and publish events',
        icon: <PartyPopper className="size-5" />,
        color: 'var(--color-coral)',
      },
      {
        href: '/admin/more/holidays',
        label: 'Holidays',
        description: 'Maintain the school calendar',
        icon: <CalendarDays className="size-5" />,
        color: 'var(--color-lime)',
      },
      {
        href: '/admin/more/leave',
        label: 'Leave requests',
        description: 'Approve or decline leave',
        icon: <Plane className="size-5" />,
        color: 'var(--color-sky)',
      },
    ],
  },
  {
    title: 'Account',
    links: [
      {
        href: '/admin/more/subscription',
        label: 'Subscription',
        description: 'Your Sproutly plan and invoices',
        icon: <CreditCard className="size-5" />,
        color: 'var(--color-purple)',
      },
      {
        href: '/admin/more/settings',
        label: 'School settings',
        description: 'Your school’s contact details',
        icon: <Settings className="size-5" />,
        color: 'var(--color-text-muted)',
      },
      {
        href: '/admin/notifications',
        label: 'Notifications',
        description: 'Everything you were told',
        icon: <Bell className="size-5" />,
        color: 'var(--color-purple)',
      },
      {
        href: '/admin/more/profile',
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

export default function AdminMorePage() {
  return <MoreHub groups={GROUPS} />;
}
