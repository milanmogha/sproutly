/**
 * Backend base URL.
 *
 * Override per environment in `.env.local`:
 *   NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

/**
 * Server root (without the `/api` suffix), used for static file URLs — the
 * backend serves uploaded gallery images and documents at `/uploads/...`.
 */
export const SERVER_ROOT = API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * Resolves a stored upload path to a URL the browser can load.
 *
 * The backend hands back paths in several shapes depending on the storage
 * driver — absolute S3 URLs, `/uploads/x.png`, or a bare `x.png` — so callers
 * shouldn't have to care which.
 */
export function fileUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/uploads')) return `${SERVER_ROOT}${path}`;
  if (path.startsWith('uploads/')) return `${SERVER_ROOT}/${path}`;
  return `${SERVER_ROOT}/uploads/${path.replace(/^\/+/, '')}`;
}
