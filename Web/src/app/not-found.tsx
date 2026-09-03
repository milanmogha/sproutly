import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <Logo size={36} className="justify-center" />
        <p className="mt-8 font-display text-6xl font-bold text-[var(--color-brand)]">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Nothing here</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          That page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button>Back to sign in</Button>
        </Link>
      </div>
    </main>
  );
}
