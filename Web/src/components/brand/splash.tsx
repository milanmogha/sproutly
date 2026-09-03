'use client';

import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The Sproutly splash — the app's launch animation, played over the page
 * rather than as a route of its own, so the screen behind it loads while it
 * runs and is ready the moment it fades.
 *
 * Shown once per browser session: a reload mid-work shouldn't replay it.
 */
const SEEN_KEY = 'sproutly.splash.seen';

export function Splash() {
  const [animation, setAnimation] = useState<object | null>(null);
  const [phase, setPhase] = useState<'hidden' | 'playing' | 'leaving'>('hidden');

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // Storage blocked — just play it.
    }
    if (seen) return;

    // Respect a reduced-motion preference: skip straight past the animation.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      try {
        window.sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* ignore */
      }
      return;
    }

    setPhase('playing');
    let cancelled = false;

    // Fetched rather than imported so the ~5KB of JSON never enters the main
    // bundle, and a missing file degrades to no splash instead of a crash.
    void fetch('/sproutly-splash.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAnimation(data as object);
      })
      .catch(() => {
        /* No splash art — the timer below still clears the overlay. */
      });

    const leave = window.setTimeout(() => setPhase('leaving'), 1900);
    const done = window.setTimeout(() => {
      setPhase('hidden');
      try {
        window.sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* ignore */
      }
    }, 2350);

    return () => {
      cancelled = true;
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div
      aria-hidden
      className={cn(
        'fixed inset-0 z-[200] grid place-items-center bg-hero transition-opacity duration-500',
        phase === 'leaving' ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="size-40 sm:size-52">
          {animation ? (
            <Lottie animationData={animation} loop={false} autoplay />
          ) : (
            <div className="grid size-full place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sproutly-icon.svg" alt="" className="size-24 animate-pulse" />
            </div>
          )}
        </div>
        <p className="font-display text-2xl font-bold tracking-tight text-white">Sproutly</p>
      </div>
    </div>
  );
}
