'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { refreshTokens, setSessionExpiredHandler } from '@/lib/api/client';
import { clearTokens, getAccessToken, getRefreshToken, loadTokens } from '@/lib/api/tokens';
import { currentSession, isExpired, ROLE_HOME, type AuthSession } from './session';

interface AuthContextValue {
  session: AuthSession | null;
  /** False until the persisted session has been read — guards render on this. */
  ready: boolean;
  /** Set when the backend ended the session out from under the user. */
  expiredNotice: string | null;
  dismissExpiredNotice: () => void;
  setSession: (session: AuthSession) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  /**
   * Resumes the session persisted in this browser, so a signed-in user isn't
   * sent back to the hub on every reload.
   *
   * Never waits on the network: the role comes from the stored access token
   * and a lapsed one is renewed in the background. A request that beats the
   * refresh just 401s and the interceptor retries it.
   */
  useEffect(() => {
    loadTokens();
    const access = getAccessToken();
    const refresh = getRefreshToken();

    if (access && refresh) {
      setSessionState(currentSession());
      if (isExpired(access)) {
        void refreshTokens().catch(() => {
          // A rejected refresh token trips the session-expiry handler below;
          // a network error leaves the session intact for the interceptor to
          // retry later.
        });
      }
    }
    setReady(true);
  }, []);

  /**
   * The one way a signed-in user is sent back to the hub without asking: the
   * backend rejected the refresh token (session revoked, account deactivated).
   */
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearTokens();
      setSessionState(null);
      queryClient.clear();
      setExpiredNotice('Your session ended. Please sign in again.');
      router.replace('/');
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient, router]);

  const setSession = useCallback((next: AuthSession) => {
    setExpiredNotice(null);
    setSessionState(next);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setSessionState(null);
    // Cached data belongs to the departing user — drop it before the next
    // sign-in can render against it.
    queryClient.clear();
    router.replace('/');
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      expiredNotice,
      dismissExpiredNotice: () => setExpiredNotice(null),
      setSession,
      logout,
    }),
    [session, ready, expiredNotice, setSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * The signed-in session, asserted non-null.
 *
 * Only valid below `<RequireRole>`, which does not render its children until a
 * matching session exists — so portal screens can read `session.schoolId`
 * without a null check on every line.
 */
export function useSession(): AuthSession {
  const { session } = useAuth();
  if (!session) throw new Error('useSession used outside a guarded portal');
  return session;
}

/**
 * Gates a portal on being signed in with the right role.
 *
 * Sends a signed-out visitor to the hub, and a signed-in one who wandered into
 * another role's URL back to their own portal.
 */
export function RequireRole({
  role,
  children,
}: {
  role: AuthSession['uiRole'];
  children: ReactNode;
}) {
  const { session, ready } = useAuth();
  const router = useRouter();
  const allowed = ready && session?.uiRole === role;

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
    } else if (session.uiRole !== role) {
      router.replace(session.uiRole ? ROLE_HOME[session.uiRole] : '/');
    }
  }, [ready, session, role, router]);

  if (!allowed) return <PortalBootScreen />;
  return <>{children}</>;
}

/** Shown for the instant between mount and the session resolving. */
function PortalBootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--color-canvas)]">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 animate-spin rounded-full border-4 border-[var(--color-hairline)] border-t-[var(--color-brand)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Loading your portal…</p>
      </div>
    </div>
  );
}
