'use client';

import { EventsScreen } from '@/components/shared/events-screen';

export default function ParentEventsPage() {
  // Parents don't create events, but they do sign up for the ones that ask.
  return <EventsScreen canRegister />;
}
