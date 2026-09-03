import type { NextConfig } from 'next';

/**
 * The backend serves uploaded gallery images and documents from `/uploads` on
 * its own origin. Next's image optimiser needs that host allow-listed, and it
 * is only known at build time from the API URL, so it is derived here.
 */
const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';
const serverRoot = apiBase.replace(/\/api\/?$/, '');

let uploadsPattern: { protocol: 'http' | 'https'; hostname: string; port: string } | null =
  null;
try {
  const url = new URL(serverRoot);
  uploadsPattern = {
    protocol: url.protocol.replace(':', '') as 'http' | 'https',
    hostname: url.hostname,
    port: url.port,
  };
} catch {
  // A malformed API URL shouldn't break the build — remote images just won't
  // be optimised.
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Emits `.next/standalone` — a self-contained server with only the modules
   * it actually imports. The deploy ships that instead of the whole
   * `node_modules`, which is what keeps an rsync to the VPS small enough to be
   * quick and lets the runner skip a production install entirely.
   */
  output: 'standalone',
  images: {
    remotePatterns: uploadsPattern ? [{ ...uploadsPattern, pathname: '/uploads/**' }] : [],
  },
};

export default nextConfig;
