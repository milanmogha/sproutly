import {
  BookOpen,
  Building2,
  CalendarCheck,
  ClipboardList,
  Crown,
  Home,
  IndianRupee,
  LayoutGrid,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Role } from '@/lib/auth/session';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

/**
 * The five destinations each portal exposes, in the same order as the app's
 * bottom navigation — so someone moving between phone and desktop finds the
 * same things in the same places.
 */
export const NAV: Record<Role, NavItem[]> = {
  parent: [
    { href: '/parent', label: 'Home', icon: <Home className="size-5" /> },
    { href: '/parent/attendance', label: 'Attendance', icon: <CalendarCheck className="size-5" /> },
    { href: '/parent/fees', label: 'Fees', icon: <IndianRupee className="size-5" /> },
    { href: '/parent/academics', label: 'Academics', icon: <BookOpen className="size-5" /> },
    { href: '/parent/more', label: 'More', icon: <LayoutGrid className="size-5" /> },
  ],
  teacher: [
    { href: '/teacher', label: 'Home', icon: <Home className="size-5" /> },
    { href: '/teacher/attendance', label: 'Attendance', icon: <ClipboardList className="size-5" /> },
    { href: '/teacher/students', label: 'Students', icon: <Users className="size-5" /> },
    { href: '/teacher/academics', label: 'Academics', icon: <BookOpen className="size-5" /> },
    { href: '/teacher/more', label: 'More', icon: <LayoutGrid className="size-5" /> },
  ],
  admin: [
    { href: '/admin', label: 'Home', icon: <Home className="size-5" /> },
    { href: '/admin/students', label: 'Students', icon: <Users className="size-5" /> },
    { href: '/admin/attendance', label: 'Attendance', icon: <ClipboardList className="size-5" /> },
    { href: '/admin/fees', label: 'Fees', icon: <IndianRupee className="size-5" /> },
    { href: '/admin/more', label: 'More', icon: <LayoutGrid className="size-5" /> },
  ],
  super_admin: [
    { href: '/super-admin', label: 'Home', icon: <Home className="size-5" /> },
    { href: '/super-admin/schools', label: 'Schools', icon: <Building2 className="size-5" /> },
    { href: '/super-admin/owners', label: 'Owners', icon: <Crown className="size-5" /> },
    { href: '/super-admin/users', label: 'Users', icon: <UsersRound className="size-5" /> },
    { href: '/super-admin/settings', label: 'Settings', icon: <Settings className="size-5" /> },
  ],
};
