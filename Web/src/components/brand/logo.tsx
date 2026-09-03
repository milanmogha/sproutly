import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The Sproutly wordmark + sprout. `tone` picks the text colour so the same
 * component works on the light canvas and on the green hero.
 */
export function Logo({
  size = 36,
  tone = 'dark',
  showWordmark = true,
  className,
}: {
  size?: number;
  tone?: 'dark' | 'light';
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {/* `unoptimized`: the image optimiser refuses SVG unless
          `dangerouslyAllowSVG` is set, and this is our own asset — serving it
          as-is is both safe and smaller than a rasterised copy. */}
      <Image
        src="/sproutly-icon.svg"
        alt=""
        width={size}
        height={size}
        priority
        unoptimized
        className="shrink-0"
      />
      {showWordmark && (
        <span
          className={cn(
            'font-display font-bold tracking-tight',
            tone === 'light' ? 'text-white' : 'text-[var(--color-text)]',
          )}
          style={{ fontSize: size * 0.62 }}
        >
          Sproutly
        </span>
      )}
    </span>
  );
}
