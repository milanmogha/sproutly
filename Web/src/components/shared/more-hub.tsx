'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, PageHeader } from '@/components/ui/primitives';

export interface MoreLink {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  color: string;
}

export interface MoreGroup {
  title: string;
  links: MoreLink[];
}

/**
 * The "More" tab: everything that doesn't earn a slot in the five-item nav.
 *
 * A one-column list on phones that widens to three across on desktop, so the
 * same set of destinations stays scannable at any size.
 */
export function MoreHub({
  groups,
  title = 'More',
  children,
}: {
  groups: MoreGroup[];
  title?: string;
  /** Rendered above the groups — e.g. the parent portal's child card. */
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      {children}
      {groups.map((group) => (
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
