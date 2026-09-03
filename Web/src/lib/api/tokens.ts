/**
 * Persists the JWT pair with an in-memory cache, so the axios request
 * interceptor can read it synchronously.
 *
 * The app's Flutter client uses the platform keystore; a browser has no
 * equivalent, so this is `localStorage`. That is the same trust model the
 * existing web console uses: an XSS on this origin would expose the token
 * either way, and keeping it out of a cookie avoids CSRF on every mutating
 * call. Tokens are scoped per-origin and cleared on logout.
 */
const ACCESS_KEY = 'sproutly.auth.accessToken';
const REFRESH_KEY = 'sproutly.auth.refreshToken';

let access: string | null = null;
let refresh: string | null = null;
let loaded = false;

/** True in the browser; `localStorage` doesn't exist while rendering on the server. */
const canStore = () => typeof window !== 'undefined';

/** Primes the in-memory cache from storage. Safe to call repeatedly. */
export function loadTokens(): void {
  if (loaded || !canStore()) return;
  try {
    access = window.localStorage.getItem(ACCESS_KEY);
    refresh = window.localStorage.getItem(REFRESH_KEY);
  } catch {
    // Storage can throw in private modes / when site data is blocked. The
    // session simply won't survive a reload.
  }
  loaded = true;
}

export function getAccessToken(): string | null {
  loadTokens();
  return access;
}

export function getRefreshToken(): string | null {
  loadTokens();
  return refresh;
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  access = accessToken;
  refresh = refreshToken;
  loaded = true;
  if (!canStore()) return;
  try {
    window.localStorage.setItem(ACCESS_KEY, accessToken);
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    // Non-fatal: the session lives in memory for this tab.
  }
}

export function clearTokens(): void {
  access = null;
  refresh = null;
  loaded = true;
  if (!canStore()) return;
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Nothing to do — the in-memory copy is already gone.
  }
}
