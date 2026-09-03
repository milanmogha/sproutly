import { http, resetSessionExpiry } from './client';
import { clearTokens, getRefreshToken, saveTokens } from './tokens';
import { decodeSession, type AuthSession } from '@/lib/auth/session';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function persist(pair: TokenPair): AuthSession {
  saveTokens(pair.accessToken, pair.refreshToken);
  // A brand-new session: re-arm the one-shot "session ended" notice so the
  // next expiry is announced again.
  resetSessionExpiry();
  return decodeSession(pair.accessToken);
}

export const authApi = {
  /** Credential roles: admin, teacher, super admin. */
  async login(email: string, password: string): Promise<AuthSession> {
    return persist(await http.post<TokenPair>('/auth/login', { email, password }));
  },

  /**
   * Parents: request a one-time code, delivered to their email.
   *
   * Succeeds identically whether or not the email is registered, so the screen
   * can't be used to discover which parents have accounts. A 503 means the
   * code genuinely could not be sent and the parent should retry.
   */
  async requestOtp(email: string): Promise<void> {
    await http.post<void>('/auth/otp/request', { email });
  },

  /** Parents: verify the one-time code and start a session. */
  async verifyOtp(email: string, code: string): Promise<AuthSession> {
    return persist(await http.post<TokenPair>('/auth/otp/verify', { email, code }));
  },

  /**
   * Credential roles: request a password-reset link, emailed to the account.
   * The user completes the reset in the browser via that link.
   *
   * Succeeds identically whether or not the email is registered.
   */
  async requestPasswordReset(email: string): Promise<void> {
    await http.post<void>('/auth/forgot-password', { email });
  },

  /** Completes a reset from the emailed link. */
  async resetPassword(token: string, password: string): Promise<void> {
    await http.post<void>('/auth/reset-password', { token, password });
  },

  /** Checks a reset link is still valid before showing the form. */
  async verifyResetToken(token: string): Promise<{ email?: string }> {
    return http.get<{ email?: string }>('/auth/reset-password', { token });
  },

  /** Reads an invite so the accept screen can show who it is for. */
  async getInvite(token: string): Promise<{ email?: string; role?: string; schoolName?: string }> {
    return http.get('/auth/invite', { token });
  },

  /**
   * Activates an invited account with the password they chose.
   *
   * Returns nothing — the API does not issue tokens here, so the caller sends
   * them to sign in rather than dropping them straight into a portal.
   */
  async acceptInvite(token: string, password: string): Promise<void> {
    await http.post<void>('/auth/accept-invite', { token, password });
  },

  /**
   * Ends this session on the backend, then clears local tokens.
   *
   * The refresh token names this device, so the user's other signed-in
   * devices stay logged in.
   */
  async logout(): Promise<void> {
    try {
      await http.post<void>('/auth/logout', { refreshToken: getRefreshToken() });
    } catch {
      // Clear locally regardless — the session is over either way.
    } finally {
      clearTokens();
    }
  },
};
