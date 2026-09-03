import type { Metadata, Viewport } from 'next';
import { Fredoka, Nunito } from 'next/font/google';
import { Providers } from '@/lib/providers';
import './globals.css';

// The brand faces, self-hosted by next/font so there is no render-blocking
// request to Google and no layout shift when they land.
const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Sproutly',
    template: '%s · Sproutly',
  },
  description:
    'Sproutly — preschool management for parents, teachers, admins and super admins.',
  icons: { icon: '/sproutly-icon.svg', apple: '/icon.png' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#2e7d32',
  width: 'device-width',
  initialScale: 1,
  // The portals are dense on phones; pinch-zoom must stay available.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
