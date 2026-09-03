import { getAccessToken } from '@/lib/api/tokens';

/** Backend role strings, as they appear in the JWT's `role` claim. */
export type BackendRole = 'parent' | 'teacher' | 'admin' | 'principal' | 'super_admin';

/**
 * The four portals the app has an interface for.
 *
 * Note there are five backend roles but four portals: a principal carries the
 * same permissions as an admin and shares their portal. See {@link portalFor}.
 */
export const ROLES = ['parent', 'teacher', 'admin', 'super_admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * The portal an account signs into, or null for a role with no interface.
 *
 * Principals are invitable from the users screen, so leaving them unmapped
 * stranded them: they could sign in, but every portal bounced them back to the
 * role picker.
 */
export function portalFor(role: BackendRole | string): Role | null {
  if (role === 'principal') return 'admin';
  return (ROLES as readonly string[]).includes(role) ? (role as Role) : null;
}

export const ROLE_LABEL: Record<Role, string> = {
  parent: 'Parent',
  teacher: 'Teacher',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

/** The path each role's portal lives at. */
export const ROLE_HOME: Record<Role, string> = {
  parent: '/parent',
  teacher: '/teacher',
  admin: '/admin',
  super_admin: '/super-admin',
};

/**
 * The signed-in identity, decoded client-side from the access token's payload.
 *
 * This is the same unverified-decode trust model the app and the existing web
 * console use — there is no `/auth/me` endpoint. The token is still verified
 * by the backend on every call; this decode only drives which UI to show.
 */
export interface AuthSession {
  userId: string;
  email: string;
  role: BackendRole;
  /** null only for super_admin, who is not scoped to one school. */
  schoolId: string | null;
  /** The portal this account signs into, or null for an unknown role. */
  uiRole: Role | null;
}

interface JwtPayload {
  sub: string;
  email?: string;
  role: BackendRole;
  schoolId?: string | null;
  exp?: number;
}

function decodePayload(jwt: string): JwtPayload {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('Malformed token');
  // base64url → base64, then pad to a multiple of 4.
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const json = decodeURIComponent(
    atob(padded)
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
  return JSON.parse(json) as JwtPayload;
}

export function decodeSession(jwt: string): AuthSession {
  const payload = decodePayload(jwt);
  const role = payload.role;
  return {
    userId: payload.sub,
    // Parents authenticate by phone and may carry an empty email claim.
    email: payload.email ?? '',
    role,
    schoolId: payload.schoolId ?? null,
    uiRole: portalFor(role),
  };
}

/**
 * The session from the currently stored access token, or null when there is
 * no token (never signed in, or signed out).
 */
export function currentSession(): AuthSession | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    return decodeSession(token);
  } catch {
    return null;
  }
}

/**
 * True once the token's `exp` has passed. The 30s skew keeps us from attaching
 * a token that dies in flight.
 */
export function isExpired(jwt: string): boolean {
  try {
    const { exp } = decodePayload(jwt);
    if (!exp) return false;
    return exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}
